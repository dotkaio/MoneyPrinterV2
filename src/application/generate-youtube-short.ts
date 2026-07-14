import sharp from "sharp";
import { z } from "zod";

import type { Account, Artifact, ContentItem } from "../domain/model.js";
import type { ContentRepository } from "../infrastructure/database/repositories.js";
import type { ArtifactStore } from "../infrastructure/filesystem/artifact-store.js";
import type {
  ImageGenerator,
  SpeechSynthesizer,
  TextGenerator,
  Transcriber,
} from "../ports/generation.js";
import type { VideoArtifact, VideoRenderer } from "../ports/media.js";
import { AppError, errorMessage } from "../shared/errors.js";

const shortPlanSchema = z.object({
  topic: z.string().min(1),
  script: z.string().min(1).max(5000),
  title: z.string().min(1).max(100),
  description: z.string().min(1),
  scenes: z.array(
    z.object({
      narration: z.string().min(1),
      imagePrompt: z.string().min(1),
    }),
  ),
});

export type YouTubeShortPlan = z.infer<typeof shortPlanSchema>;

export interface GenerateYouTubeShortRequest {
  account: Account;
  contentItemId?: string;
  backgroundMusicPath?: string;
}

export interface GeneratedYouTubeShort {
  contentItem: ContentItem;
  plan: YouTubeShortPlan;
  video: VideoArtifact;
  artifacts: readonly Artifact[];
}

export interface GenerateYouTubeShortOptions {
  minimumScenes: number;
  maximumScenes: number;
  width: number;
  height: number;
  aspectRatio: string;
}

export interface GenerateYouTubeShortDependencies {
  content: ContentRepository;
  artifactStore: ArtifactStore;
  textGenerator: TextGenerator;
  imageGenerator: ImageGenerator;
  speechSynthesizer: SpeechSynthesizer;
  transcriber?: Transcriber;
  renderer: VideoRenderer;
}

export class GenerateYouTubeShort {
  public constructor(
    private readonly dependencies: GenerateYouTubeShortDependencies,
    private readonly options: GenerateYouTubeShortOptions,
  ) {}

  public async execute(
    request: GenerateYouTubeShortRequest,
  ): Promise<GeneratedYouTubeShort> {
    if (request.account.platform !== "youtube") {
      throw new AppError(
        "YouTube generation requires a YouTube account",
        "ACCOUNT_PLATFORM_INVALID",
      );
    }

    let contentItem =
      request.contentItemId === undefined
        ? this.dependencies.content.create(request.account.id, "youtube-short")
        : this.dependencies.content.findById(request.contentItemId);
    if (contentItem === null) {
      throw new AppError(
        `Content item not found: ${request.contentItemId}`,
        "CONTENT_NOT_FOUND",
      );
    }
    if (
      contentItem.accountId !== request.account.id ||
      contentItem.kind !== "youtube-short"
    ) {
      throw new AppError(
        "Content item does not belong to this YouTube account",
        "CONTENT_MISMATCH",
      );
    }

    try {
      contentItem = this.dependencies.content.update(contentItem.id, {
        state: "generating",
        errorCode: null,
        errorMessage: null,
      });
      const plan = await this.loadOrGeneratePlan(contentItem, request.account);
      const images = await this.generateImages(contentItem.id, plan);
      const narration = await this.generateNarration(
        contentItem.id,
        plan.script,
      );
      const narrationDuration = await this.dependencies.renderer.duration(
        narration.path,
      );
      const subtitles = await this.generateSubtitles(
        contentItem.id,
        narration.path,
        request.account.language,
      );
      const sceneDuration = narrationDuration / images.length;
      const outputPath = await this.dependencies.artifactStore.pathFor(
        contentItem.id,
        "short.mp4",
      );
      const video = this.findArtifact(contentItem.id, "video");
      const rendered =
        video === undefined
          ? await this.dependencies.renderer.renderShort({
              scenes: images.map((image) => ({
                imagePath: image.path,
                durationSeconds: sceneDuration,
              })),
              narrationPath: narration.path,
              ...(subtitles === undefined
                ? {}
                : { subtitlesPath: subtitles.path }),
              ...(request.backgroundMusicPath === undefined
                ? {}
                : { backgroundMusicPath: request.backgroundMusicPath }),
              outputPath,
            })
          : await this.dependencies.renderer.inspect(video.path);

      if (video === undefined) {
        this.dependencies.content.addArtifact({
          contentItemId: contentItem.id,
          type: "video",
          path: rendered.path,
          checksum: await this.dependencies.artifactStore.checksum(
            rendered.path,
          ),
          provider: rendered.provider,
          metadata: {
            width: rendered.width,
            height: rendered.height,
            durationSeconds: rendered.durationSeconds,
            videoCodec: rendered.videoCodec,
            audioCodec: rendered.audioCodec,
          },
        });
      }

      contentItem = this.dependencies.content.update(contentItem.id, {
        state: "ready",
      });
      return {
        contentItem,
        plan,
        video: rendered,
        artifacts: this.dependencies.content.listArtifacts(contentItem.id),
      };
    } catch (error) {
      this.dependencies.content.update(contentItem.id, {
        state: "failed",
        errorCode: error instanceof AppError ? error.code : "GENERATION_FAILED",
        errorMessage: errorMessage(error),
      });
      throw error;
    }
  }

  private async loadOrGeneratePlan(
    contentItem: ContentItem,
    account: Account,
  ): Promise<YouTubeShortPlan> {
    const existing = shortPlanSchema.safeParse(contentItem.metadata.plan);
    if (existing.success) {
      return existing.data;
    }

    const result = await this.dependencies.textGenerator.generate({
      system:
        "You create concise, factual vertical-video scripts. Return only data matching the requested JSON schema.",
      prompt: [
        `Create a YouTube Short for the niche: ${account.niche}.`,
        `Write in ${account.language}.`,
        `Create between ${this.options.minimumScenes} and ${this.options.maximumScenes} visual scenes.`,
        "The script must be concise, immediately engaging, and must not mention these instructions.",
        "Each scene must contain the narration fragment and a detailed vertical image prompt.",
      ].join("\n"),
      responseSchema: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "script", "title", "description", "scenes"],
        properties: {
          topic: { type: "string" },
          script: { type: "string" },
          title: { type: "string", maxLength: 100 },
          description: { type: "string" },
          scenes: {
            type: "array",
            minItems: this.options.minimumScenes,
            maxItems: this.options.maximumScenes,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["narration", "imagePrompt"],
              properties: {
                narration: { type: "string" },
                imagePrompt: { type: "string" },
              },
            },
          },
        },
      },
      temperature: 0.7,
    });
    const parsed = shortPlanSchema.parse(JSON.parse(result.text) as unknown);
    if (
      parsed.scenes.length < this.options.minimumScenes ||
      parsed.scenes.length > this.options.maximumScenes
    ) {
      throw new AppError(
        `Generated ${parsed.scenes.length} scenes; expected ${this.options.minimumScenes}-${this.options.maximumScenes}`,
        "SCENE_COUNT_INVALID",
        true,
      );
    }

    this.dependencies.content.update(contentItem.id, {
      topic: parsed.topic,
      script: parsed.script,
      metadata: {
        plan: parsed,
        textGeneration: {
          provider: result.provider,
          model: result.model,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          durationMs: result.durationMs,
        },
      },
    });
    return parsed;
  }

  private async generateImages(
    contentItemId: string,
    plan: YouTubeShortPlan,
  ): Promise<readonly Artifact[]> {
    const existing = this.dependencies.content
      .listArtifacts(contentItemId)
      .filter((artifact) => artifact.type === "scene-image");
    const images: Artifact[] = [];

    for (const [index, scene] of plan.scenes.entries()) {
      const existingImage = existing.find(
        (artifact) => artifact.metadata.sceneIndex === index,
      );
      if (existingImage !== undefined) {
        images.push(existingImage);
        continue;
      }

      const generated = await this.dependencies.imageGenerator.generate({
        prompt: scene.imagePrompt,
        aspectRatio: this.options.aspectRatio,
      });
      const normalized = await sharp(generated.bytes)
        .resize(this.options.width, this.options.height, { fit: "cover" })
        .png()
        .toBuffer();
      const stored = await this.dependencies.artifactStore.writeBytes(
        contentItemId,
        `scene-${String(index + 1).padStart(2, "0")}.png`,
        normalized,
      );
      images.push(
        this.dependencies.content.addArtifact({
          contentItemId,
          type: "scene-image",
          path: stored.path,
          checksum: stored.checksum,
          provider: generated.provider,
          metadata: {
            sceneIndex: index,
            prompt: scene.imagePrompt,
            model: generated.model,
            durationMs: generated.durationMs,
          },
        }),
      );
    }

    return images;
  }

  private async generateNarration(
    contentItemId: string,
    script: string,
  ): Promise<Artifact> {
    const existing = this.findArtifact(contentItemId, "narration");
    if (existing !== undefined) {
      return existing;
    }
    const path = await this.dependencies.artifactStore.pathFor(
      contentItemId,
      "narration.wav",
    );
    const generated = await this.dependencies.speechSynthesizer.synthesize({
      text: script,
      outputPath: path,
    });
    return this.dependencies.content.addArtifact({
      contentItemId,
      type: "narration",
      path: generated.path,
      checksum: await this.dependencies.artifactStore.checksum(generated.path),
      provider: generated.provider,
    });
  }

  private async generateSubtitles(
    contentItemId: string,
    narrationPath: string,
    language: string,
  ): Promise<Artifact | undefined> {
    if (this.dependencies.transcriber === undefined) {
      return undefined;
    }
    const existing = this.findArtifact(contentItemId, "subtitles");
    if (existing !== undefined) {
      return existing;
    }
    const path = await this.dependencies.artifactStore.pathFor(
      contentItemId,
      "subtitles.srt",
    );
    const generated = await this.dependencies.transcriber.transcribe({
      audioPath: narrationPath,
      outputPath: path,
      language,
    });
    return this.dependencies.content.addArtifact({
      contentItemId,
      type: "subtitles",
      path: generated.path,
      checksum: await this.dependencies.artifactStore.checksum(generated.path),
      provider: generated.provider,
      metadata: { format: generated.format },
    });
  }

  private findArtifact(
    contentItemId: string,
    type: string,
  ): Artifact | undefined {
    return this.dependencies.content
      .listArtifacts(contentItemId)
      .find((artifact) => artifact.type === type);
  }
}
