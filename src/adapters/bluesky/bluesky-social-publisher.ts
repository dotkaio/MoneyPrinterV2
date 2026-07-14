import { z } from "zod";

import type { AccountAuthenticationService } from "../../application/account-authentication-service.js";
import type { AccountConnectionRepository } from "../../infrastructure/database/account-connection-repository.js";
import type {
  PublishedPost,
  SocialPostRequest,
  SocialPublisher,
} from "../../ports/publishing.js";
import { AppError } from "../../shared/errors.js";

const createRecordResponseSchema = z.object({
  uri: z.string().min(1),
  cid: z.string().min(1),
});

export interface BlueskySocialPublisherOptions {
  serviceUrl: string;
  livePublishing: boolean;
}

export class BlueskySocialPublisher implements SocialPublisher {
  public constructor(
    private readonly authentication: AccountAuthenticationService,
    private readonly connections: AccountConnectionRepository,
    private readonly options: BlueskySocialPublisherOptions,
  ) {}

  public async publish(request: SocialPostRequest): Promise<PublishedPost> {
    if (!this.options.livePublishing) {
      throw new AppError(
        "Live publishing is disabled; Bluesky posts can only be previewed",
        "LIVE_PUBLISHING_DISABLED",
      );
    }
    if (request.text.length === 0 || request.text.length > 300) {
      throw new AppError(
        "Bluesky posts must contain 1-300 characters",
        "BLUESKY_LENGTH_INVALID",
      );
    }
    const connection = this.connections.findByAccountId(request.accountId);
    if (
      connection?.platform !== "bluesky" ||
      connection.externalAccountId === null
    ) {
      throw new AppError(
        "Bluesky account is not connected",
        "ACCOUNT_NOT_AUTHORIZED",
      );
    }
    const accessToken = await this.authentication.accessToken(
      request.accountId,
    );
    const response = await fetch(
      new URL("/xrpc/com.atproto.repo.createRecord", this.options.serviceUrl),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          repo: connection.externalAccountId,
          collection: "app.bsky.feed.post",
          record: {
            $type: "app.bsky.feed.post",
            text: request.text,
            createdAt: new Date().toISOString(),
          },
        }),
      },
    );
    if (!response.ok) {
      throw new AppError(
        `Bluesky publishing failed with HTTP ${response.status}`,
        "BLUESKY_PUBLISH_FAILED",
        response.status >= 500,
      );
    }
    const published = createRecordResponseSchema.parse(await response.json());
    const postId = published.uri.split("/").at(-1) ?? published.cid;
    const handle = connection.displayName ?? connection.externalAccountId;
    return {
      platformItemId: published.uri,
      publicUrl: `https://bsky.app/profile/${encodeURIComponent(handle)}/post/${encodeURIComponent(postId)}`,
      provider: "bluesky-atproto",
    };
  }
}
