import { YouTubeApiPublisher } from "../adapters/youtube/youtube-api-publisher.js";
import type { Runtime } from "../runtime.js";
import { PublishYouTubeShort } from "./publish-youtube-short.js";
import { createAccountAuthenticationService } from "./create-account-authentication-service.js";

export function createYouTubePublisher(runtime: Runtime): PublishYouTubeShort {
  const config = runtime.loadedConfig.config;
  return new PublishYouTubeShort({
    content: runtime.content,
    publishing: runtime.publishing,
    publisher: new YouTubeApiPublisher(
      createAccountAuthenticationService(runtime),
      runtime.publishing,
      {
        uploadBaseUrl: config.publishers.youtube.uploadBaseUrl,
        livePublishing: config.safety.livePublishing,
      },
    ),
  });
}
