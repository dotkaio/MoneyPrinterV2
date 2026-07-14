import { PlaywrightTwitterPublisher } from "../adapters/twitter/playwright-twitter-publisher.js";
import { OllamaTextGenerator } from "../adapters/ollama/ollama-text-generator.js";
import type { Runtime } from "../runtime.js";
import { GenerateTwitterPost } from "./generate-twitter-post.js";
import { PublishSocialContent } from "./publish-social-content.js";

export function createTwitterGenerator(runtime: Runtime): GenerateTwitterPost {
  const config = runtime.loadedConfig.config.providers.llm;
  return new GenerateTwitterPost(
    runtime.content,
    new OllamaTextGenerator({ baseUrl: config.baseUrl, model: config.model }),
  );
}

export function createTwitterPublisher(runtime: Runtime): PublishSocialContent {
  const config = runtime.loadedConfig.config;
  return new PublishSocialContent(
    runtime.content,
    runtime.publishing,
    new PlaywrightTwitterPublisher(runtime.accounts, {
      baseUrl: config.publishers.twitter.baseUrl,
      headless: config.browser.headless,
      livePublishing: config.safety.livePublishing,
      dataDirectory: config.dataDirectory,
    }),
  );
}
