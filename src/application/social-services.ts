import { BlueskySocialPublisher } from "../adapters/bluesky/bluesky-social-publisher.js";
import { LinkedInSocialPublisher } from "../adapters/linkedin/linkedin-social-publisher.js";
import type { Platform } from "../domain/model.js";
import type { Runtime } from "../runtime.js";
import { AppError } from "../shared/errors.js";
import { createAccountAuthenticationService } from "./create-account-authentication-service.js";
import { PublishSocialContent } from "./publish-social-content.js";

export function createSocialPublisher(
  runtime: Runtime,
  platform: Platform,
): PublishSocialContent {
  const config = runtime.loadedConfig.config;
  const authentication = createAccountAuthenticationService(runtime);
  if (platform === "bluesky") {
    return new PublishSocialContent(
      runtime.content,
      runtime.publishing,
      new BlueskySocialPublisher(authentication, runtime.connections, {
        serviceUrl: config.publishers.bluesky.serviceUrl,
        livePublishing: config.safety.livePublishing,
      }),
      platform,
    );
  }
  if (platform === "linkedin") {
    return new PublishSocialContent(
      runtime.content,
      runtime.publishing,
      new LinkedInSocialPublisher(authentication, runtime.connections, {
        apiBaseUrl: config.publishers.linkedin.apiBaseUrl,
        apiVersion: config.publishers.linkedin.apiVersion,
        livePublishing: config.safety.livePublishing,
      }),
      platform,
    );
  }
  throw new AppError(
    `${platform} text publishing is not implemented`,
    "SOCIAL_PUBLISHER_UNAVAILABLE",
  );
}
