import type { AccountAuthenticationService } from "../../application/account-authentication-service.js";
import type { AccountConnectionRepository } from "../../infrastructure/database/account-connection-repository.js";
import type {
  PublishedPost,
  SocialPostRequest,
  SocialPublisher,
} from "../../ports/publishing.js";
import { AppError } from "../../shared/errors.js";

export interface LinkedInSocialPublisherOptions {
  apiBaseUrl: string;
  apiVersion: string;
  livePublishing: boolean;
}

export class LinkedInSocialPublisher implements SocialPublisher {
  public constructor(
    private readonly authentication: AccountAuthenticationService,
    private readonly connections: AccountConnectionRepository,
    private readonly options: LinkedInSocialPublisherOptions,
  ) {}

  public async publish(request: SocialPostRequest): Promise<PublishedPost> {
    if (!this.options.livePublishing) {
      throw new AppError(
        "Live publishing is disabled; LinkedIn posts can only be previewed",
        "LIVE_PUBLISHING_DISABLED",
      );
    }
    if (request.text.length === 0 || request.text.length > 3000) {
      throw new AppError(
        "LinkedIn posts must contain 1-3000 characters",
        "LINKEDIN_LENGTH_INVALID",
      );
    }
    const connection = this.connections.findByAccountId(request.accountId);
    if (
      connection?.platform !== "linkedin" ||
      connection.externalAccountId === null
    ) {
      throw new AppError(
        "LinkedIn account is not connected or is missing its member ID",
        "ACCOUNT_NOT_AUTHORIZED",
      );
    }
    const accessToken = await this.authentication.accessToken(
      request.accountId,
    );
    const response = await fetch(
      new URL("/rest/posts", this.options.apiBaseUrl),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          "LinkedIn-Version": this.options.apiVersion,
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author: `urn:li:person:${connection.externalAccountId}`,
          commentary: request.text,
          visibility: "PUBLIC",
          distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        }),
      },
    );
    if (!response.ok) {
      throw new AppError(
        `LinkedIn publishing failed with HTTP ${response.status}`,
        "LINKEDIN_PUBLISH_FAILED",
        response.status >= 500,
      );
    }
    const postId = response.headers.get("x-restli-id");
    if (postId === null || postId.length === 0) {
      throw new AppError(
        "LinkedIn did not return a post ID",
        "LINKEDIN_POST_ID_MISSING",
      );
    }
    return {
      platformItemId: postId,
      publicUrl: null,
      provider: "linkedin-rest",
    };
  }
}
