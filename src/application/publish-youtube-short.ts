import { z } from "zod";

import type { Account, ContentItem, PublishedItem } from "../domain/model.js";
import type {
  ContentRepository,
  PublishingRepository,
} from "../infrastructure/database/repositories.js";
import type { VideoPublisher } from "../ports/publishing.js";
import { AppError, errorMessage } from "../shared/errors.js";

const metadataPlanSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1),
});

export interface PublishYouTubeShortDependencies {
  content: ContentRepository;
  publishing: PublishingRepository;
  publisher: VideoPublisher;
}

export class PublishYouTubeShort {
  public constructor(
    private readonly dependencies: PublishYouTubeShortDependencies,
  ) {}

  public async execute(
    account: Account,
    contentItem: ContentItem,
    privacyStatus: "private" | "unlisted" | "public",
  ): Promise<PublishedItem> {
    if (
      account.platform !== "youtube" ||
      contentItem.accountId !== account.id
    ) {
      throw new AppError(
        "Account and content do not match",
        "PUBLISH_CONTENT_MISMATCH",
      );
    }
    const existing = this.dependencies.publishing.findPublished(
      contentItem.id,
      account.id,
    );
    if (existing !== null) {
      return existing;
    }
    const video = this.dependencies.content
      .listArtifacts(contentItem.id)
      .find((artifact) => artifact.type === "video");
    if (video === undefined) {
      throw new AppError(
        "Content has no rendered video",
        "PUBLISH_VIDEO_MISSING",
      );
    }
    const plan = metadataPlanSchema.parse(contentItem.metadata.plan);

    this.dependencies.content.update(contentItem.id, {
      state: "publishing",
      errorCode: null,
      errorMessage: null,
    });
    try {
      const published = await this.dependencies.publisher.publish({
        accountId: account.id,
        videoPath: video.path,
        title: plan.title,
        description: plan.description,
        privacyStatus,
        idempotencyKey: `youtube.publish:${contentItem.id}:${account.id}`,
      });
      const record = this.dependencies.publishing.recordPublished({
        contentItemId: contentItem.id,
        accountId: account.id,
        platform: "youtube",
        platformItemId: published.platformItemId,
        publicUrl: published.publicUrl,
        privacyStatus: published.privacyStatus,
      });
      this.dependencies.content.update(contentItem.id, { state: "published" });
      return record;
    } catch (error) {
      this.dependencies.content.update(contentItem.id, {
        state: "failed",
        errorCode: error instanceof AppError ? error.code : "PUBLISH_FAILED",
        errorMessage: errorMessage(error),
      });
      throw error;
    }
  }
}
