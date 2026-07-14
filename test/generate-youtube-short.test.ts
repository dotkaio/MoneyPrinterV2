import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { execa } from "execa";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FfmpegVideoRenderer } from "../src/adapters/ffmpeg/ffmpeg-video-renderer.js";
import { GenerateYouTubeShort } from "../src/application/generate-youtube-short.js";
import type {
  ImageGenerator,
  SpeechSynthesizer,
  TextGenerator,
} from "../src/ports/generation.js";
import { createRuntime } from "../src/runtime.js";

const directories: string[] = [];

afterEach(() => {
  delete process.env.MPV2_DATA_DIRECTORY;
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("GenerateYouTubeShort", () => {
  it("generates a bounded, resumable short through the real media renderer", async () => {
    const directory = join(tmpdir(), `mpv2-generate-${crypto.randomUUID()}`);
    directories.push(directory);
    mkdirSync(directory, { recursive: true });
    process.env.MPV2_DATA_DIRECTORY = directory;
    const runtime = createRuntime(join(directory, "missing-config.json"));
    const account = runtime.accounts.create({
      platform: "youtube",
      nickname: "Fixture Channel",
      niche: "astronomy",
      language: "English",
    });

    const textGenerate = vi.fn<TextGenerator["generate"]>().mockResolvedValue({
      text: JSON.stringify({
        topic: "Why Saturn has rings",
        script:
          "Saturn's rings are a vast field of ice. Their structure is shaped by gravity.",
        title: "Saturn's Rings Explained #shorts",
        description: "A concise tour of Saturn's rings.",
        scenes: [
          {
            narration: "Saturn's rings are ice.",
            imagePrompt: "Saturn with bright icy rings",
          },
          {
            narration: "Gravity shapes them.",
            imagePrompt: "Detailed rings divided by gravity",
          },
        ],
      }),
      provider: "fixture",
      model: "fixture-model",
      promptTokens: 10,
      completionTokens: 20,
      durationMs: 1,
    });
    const textGenerator: TextGenerator = {
      generate: textGenerate,
      healthCheck: () => Promise.resolve("fixture"),
    };
    const imageGenerate = vi
      .fn<ImageGenerator["generate"]>()
      .mockImplementation(async () => ({
        bytes: await sharp({
          create: {
            width: 360,
            height: 640,
            channels: 3,
            background: "#172554",
          },
        })
          .png()
          .toBuffer(),
        mimeType: "image/png",
        provider: "fixture",
        model: "fixture-image",
        durationMs: 1,
      }));
    const imageGenerator: ImageGenerator = { generate: imageGenerate };
    const synthesize = vi
      .fn<SpeechSynthesizer["synthesize"]>()
      .mockImplementation(async (request) => {
        mkdirSync(dirname(request.outputPath), { recursive: true });
        await execa("ffmpeg", [
          "-y",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=440:duration=2",
          request.outputPath,
        ]);
        return { path: request.outputPath, provider: "fixture" };
      });
    const speechSynthesizer: SpeechSynthesizer = { synthesize };
    const renderer = new FfmpegVideoRenderer({
      ffmpegPath: "ffmpeg",
      ffprobePath: "ffprobe",
      width: 360,
      height: 640,
      framesPerSecond: 24,
      backgroundMusicVolume: 0.1,
    });
    const generate = new GenerateYouTubeShort(
      {
        content: runtime.content,
        artifactStore: runtime.artifactStore,
        textGenerator,
        imageGenerator,
        speechSynthesizer,
        renderer,
      },
      {
        minimumScenes: 2,
        maximumScenes: 4,
        width: 360,
        height: 640,
        aspectRatio: "9:16",
      },
    );

    const first = await generate.execute({ account });
    const resumed = await generate.execute({
      account,
      contentItemId: first.contentItem.id,
    });

    expect(first.contentItem.state).toBe("ready");
    expect(first.video.videoCodec).toBe("h264");
    expect(first.artifacts.map((artifact) => artifact.type)).toEqual([
      "scene-image",
      "scene-image",
      "narration",
      "video",
    ]);
    expect(resumed.contentItem.state).toBe("ready");
    expect(textGenerate).toHaveBeenCalledOnce();
    expect(imageGenerate).toHaveBeenCalledTimes(2);
    expect(synthesize).toHaveBeenCalledOnce();
    runtime.close();
  });
});
