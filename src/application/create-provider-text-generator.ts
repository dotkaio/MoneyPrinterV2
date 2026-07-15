import { OpenAiCompatibleTextGenerator } from "../adapters/ai/openai-compatible-text-generator.js";
import { AnthropicTextGenerator } from "../adapters/anthropic/anthropic-text-generator.js";
import { GeminiTextGenerator } from "../adapters/gemini/gemini-text-generator.js";
import { OpenAiTextGenerator } from "../adapters/openai/openai-text-generator.js";
import { OpenRouterTextGenerator } from "../adapters/openrouter/openrouter-text-generator.js";
import type { AiProviderKind } from "../domain/model.js";
import type { TextGenerator } from "../ports/generation.js";
import { requireAiProviderDefinition } from "./ai-provider-catalog.js";

export interface ProviderTextGeneratorOptions {
  kind: AiProviderKind;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export type ProviderTextGeneratorFactory = (
  options: ProviderTextGeneratorOptions,
) => TextGenerator;

export const createProviderTextGenerator: ProviderTextGeneratorFactory = (
  options,
) => {
  switch (options.kind) {
    case "openai":
      return new OpenAiTextGenerator(options);
    case "anthropic":
      return new AnthropicTextGenerator(options);
    case "gemini":
      return new GeminiTextGenerator(options);
    case "openrouter":
      return new OpenRouterTextGenerator(options);
    case "groq":
    case "xai":
    case "mistral":
    case "deepseek":
    case "together":
    case "cerebras":
    case "cohere":
    case "nvidia":
    case "fireworks": {
      const definition = requireAiProviderDefinition(options.kind);
      return new OpenAiCompatibleTextGenerator({
        ...options,
        providerName: definition.name,
        ...(definition.healthCheckUrl === undefined
          ? {}
          : { healthCheckUrl: definition.healthCheckUrl }),
      });
    }
  }
};
