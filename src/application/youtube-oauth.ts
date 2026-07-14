import { YouTubeOAuthManager } from "../adapters/youtube/youtube-oauth-manager.js";
import type { Runtime } from "../runtime.js";

export function createYouTubeOAuthManager(
  runtime: Runtime,
): YouTubeOAuthManager {
  const config = runtime.loadedConfig.config.publishers.youtube;
  return new YouTubeOAuthManager({
    clientId: process.env[config.clientIdEnv] ?? "",
    clientSecret: process.env[config.clientSecretEnv] ?? "",
    redirectUri: config.redirectUri,
    dataDirectory: runtime.loadedConfig.config.dataDirectory,
  });
}
