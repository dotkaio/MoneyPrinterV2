import { z } from "zod";

import type {
  Account,
  ContentItem,
  Platform,
  PublishedItem,
} from "../domain/model.js";
import type {
  ContentRepository,
  PublishingRepository,
} from "../infrastructure/database/repositories.js";
import type { SocialPublisher } from "../ports/publishing.js";
import { AppError, errorMessage } from "../shared/errors.js";

const socialMetadataSchema = z.union([
  z.object({ postText: z.string().min(1).max(3000) }),
  z.object({ pitchText: z.string().min(1).max(3000) }),
]);

export class PublishSocialContent {
  public constructor(
    private readonly content: ContentRepository,
    private readonly publishing: PublishingRepository,
    private readonly publisher: SocialPublisher,
    private readonly platform: Platform = "twitter",
  ) {}

  public async execute(
    account: Account,
    contentItem: ContentItem,
  ): Promise<PublishedItem> {
    if (
      account.platform !== this.platform ||
      contentItem.accountId !== account.id
    ) {
      throw new AppError(
        `${this.platform} account and content do not match`,
        "PUBLISH_CONTENT_MISMATCH",
      );
    }
    const existing = this.publishing.findPublished(contentItem.id, account.id);
    if (existing !== null) {
      return existing;
    }
    const metadata = socialMetadataSchema.parse(contentItem.metadata);
    const text =
      "postText" in metadata ? metadata.postText : metadata.pitchText;
    this.content.update(contentItem.id, { state: "publishing" });
    try {
      const published = await this.publisher.publish({
        accountId: account.id,
        text,
        idempotencyKey: `${this.platform}.publish:${contentItem.id}:${account.id}`,
      });
      const record = this.publishing.recordPublished({
        contentItemId: contentItem.id,
        accountId: account.id,
        platform: this.platform,
        platformItemId: published.platformItemId,
        publicUrl: published.publicUrl,
        privacyStatus: null,
      });
      this.content.update(contentItem.id, { state: "published" });
      return record;
    } catch (error) {
      this.content.update(contentItem.id, {
        state: "failed",
        errorCode:
          error instanceof AppError
            ? error.code
            : `${this.platform.toUpperCase()}_PUBLISH_FAILED`,
        errorMessage: errorMessage(error),
      });
      throw error;
    }
  }
}
