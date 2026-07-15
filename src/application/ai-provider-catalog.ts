import type { AiProviderKind } from "../domain/model.js";

export interface AiProviderDefinition {
  kind: AiProviderKind;
  name: string;
  description: string;
  access: "free-tier" | "paid";
  accessNote: string;
  baseUrl: string;
  defaultModel: string;
  models: readonly string[];
  keyPlaceholder: string;
  keyUrl: string;
  healthCheckUrl?: string;
}

export const aiProviderCatalog: readonly AiProviderDefinition[] = [
  {
    kind: "groq",
    name: "Groq",
    description: "Very fast inference across leading open models.",
    access: "free-tier",
    accessNote: "Free plan available; provider rate limits apply.",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "openai/gpt-oss-120b",
    models: ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"],
    keyPlaceholder: "gsk_…",
    keyUrl: "https://console.groq.com/keys",
  },
  {
    kind: "gemini",
    name: "Google Gemini",
    description: "Fast multimodal generation from Google AI Studio.",
    access: "free-tier",
    accessNote: "Free tier available on eligible models.",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-3.5-flash",
    models: [
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro-preview",
    ],
    keyPlaceholder: "AIza…",
    keyUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    kind: "mistral",
    name: "Mistral AI",
    description: "Efficient European frontier and open-weight models.",
    access: "free-tier",
    accessNote: "Free mode available with limited usage.",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-medium-latest",
    models: [
      "mistral-medium-latest",
      "mistral-large-latest",
      "mistral-small-latest",
    ],
    keyPlaceholder: "Paste your Mistral API key",
    keyUrl: "https://console.mistral.ai/api-keys",
  },
  {
    kind: "openrouter",
    name: "OpenRouter",
    description: "One key with free and paid models from many providers.",
    access: "free-tier",
    accessNote: "Free Models Router available with daily limits.",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openrouter/free",
    models: [
      "openrouter/free",
      "openai/gpt-5.6-luna",
      "anthropic/claude-sonnet-5",
      "google/gemini-3.5-flash",
    ],
    keyPlaceholder: "sk-or-v1-…",
    keyUrl: "https://openrouter.ai/settings/keys",
  },
  {
    kind: "cerebras",
    name: "Cerebras",
    description: "High-speed inference on wafer-scale systems.",
    access: "free-tier",
    accessNote: "Free API tier available with lower limits.",
    baseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "gpt-oss-120b",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
    keyPlaceholder: "csk-…",
    keyUrl: "https://cloud.cerebras.ai/",
  },
  {
    kind: "cohere",
    name: "Cohere",
    description: "Multilingual enterprise generation with Command models.",
    access: "free-tier",
    accessNote: "Free trial key available with monthly limits.",
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    defaultModel: "command-a-plus-05-2026",
    models: ["command-a-plus-05-2026", "command-a-03-2025"],
    keyPlaceholder: "Paste your Cohere API key",
    keyUrl: "https://dashboard.cohere.com/api-keys",
    healthCheckUrl: "https://api.cohere.com/v1/models",
  },
  {
    kind: "nvidia",
    name: "NVIDIA NIM",
    description: "Hosted GPU-accelerated endpoints for popular open models.",
    access: "free-tier",
    accessNote: "Free hosted prototype endpoint available.",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    defaultModel: "moonshotai/kimi-k2.6",
    models: ["moonshotai/kimi-k2.6"],
    keyPlaceholder: "nvapi-…",
    keyUrl: "https://build.nvidia.com/",
  },
  {
    kind: "openai",
    name: "OpenAI",
    description: "Balanced generation with the Responses API.",
    access: "paid",
    accessNote: "Usage-based billing.",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.6-luna",
    models: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"],
    keyPlaceholder: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    kind: "anthropic",
    name: "Anthropic",
    description: "Strong long-form writing and narrative control.",
    access: "paid",
    accessNote: "Usage-based billing.",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-5",
    models: [
      "claude-haiku-4-5",
      "claude-sonnet-5",
      "claude-opus-4-8",
      "claude-fable-5",
    ],
    keyPlaceholder: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    kind: "xai",
    name: "xAI",
    description: "Grok models for fast general and reasoning workloads.",
    access: "paid",
    accessNote: "Usage-based billing.",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4.5",
    models: ["grok-4.5", "grok-4.3"],
    keyPlaceholder: "xai-…",
    keyUrl: "https://console.x.ai/",
  },
  {
    kind: "deepseek",
    name: "DeepSeek",
    description: "Long-context reasoning and low-cost generation.",
    access: "paid",
    accessNote: "Usage-based billing.",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-pro",
    models: ["deepseek-v4-pro", "deepseek-v4-flash"],
    keyPlaceholder: "sk-…",
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    kind: "together",
    name: "Together AI",
    description: "Serverless access to a broad catalog of open models.",
    access: "paid",
    accessNote: "Usage-based billing.",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "moonshotai/Kimi-K2.5",
    models: ["moonshotai/Kimi-K2.5", "Qwen/Qwen3.5-9B", "zai-org/GLM-5"],
    keyPlaceholder: "Paste your Together API key",
    keyUrl: "https://api.together.ai/settings/api-keys",
  },
  {
    kind: "fireworks",
    name: "Fireworks AI",
    description: "Production serverless inference for leading open models.",
    access: "paid",
    accessNote: "Usage-based billing.",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/gpt-oss-120b",
    models: ["accounts/fireworks/models/gpt-oss-120b"],
    keyPlaceholder: "Paste your Fireworks API key",
    keyUrl: "https://app.fireworks.ai/settings/users/api-keys",
  },
] as const;

export function requireAiProviderDefinition(
  kind: AiProviderKind,
): AiProviderDefinition {
  const definition = aiProviderCatalog.find(
    (candidate) => candidate.kind === kind,
  );
  if (definition === undefined) {
    throw new Error(`Unsupported AI provider: ${kind}`);
  }
  return definition;
}
