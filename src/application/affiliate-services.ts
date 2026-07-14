import { OllamaTextGenerator } from "../adapters/ollama/ollama-text-generator.js";
import { PlaywrightAmazonProductSource } from "../adapters/amazon/playwright-amazon-product-source.js";
import type { Runtime } from "../runtime.js";
import { RunAffiliateCampaign } from "./run-affiliate-campaign.js";

export function createAffiliateCampaign(
  runtime: Runtime,
): RunAffiliateCampaign {
  const config = runtime.loadedConfig.config;
  return new RunAffiliateCampaign(
    runtime.affiliate,
    runtime.content,
    new PlaywrightAmazonProductSource({ headless: config.browser.headless }),
    new OllamaTextGenerator({
      baseUrl: config.providers.llm.baseUrl,
      model: config.providers.llm.model,
    }),
  );
}
