import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { requireAiProviderDefinition } from "../src/application/ai-provider-catalog.js";
import { AiProviderConnectionService } from "../src/application/ai-provider-connection-service.js";
import { createProviderTextGenerator } from "../src/application/create-provider-text-generator.js";
import { GenerateContentCreation } from "../src/application/generate-content-creation.js";
import type { SecretVault } from "../src/ports/secrets.js";
import { createRuntime } from "../src/runtime.js";

const directories: string[] = [];
const compatibleResponse = {
  choices: [{ message: { content: '{"ok":true}' } }],
  usage: { prompt_tokens: 3, completion_tokens: 2 },
};

class MemorySecretVault implements SecretVault {
  public readonly values = new Map<string, string>();

  public get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  public set(key: string, secret: string): Promise<void> {
    this.values.set(key, secret);
    return Promise.resolve();
  }

  public delete(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MPV2_DATA_DIRECTORY;
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("AI provider connections and creations", () => {
  it("stores the key outside SQLite and creates standalone content", async () => {
    const directory = join(tmpdir(), `mpv2-ai-${crypto.randomUUID()}`);
    directories.push(directory);
    process.env.MPV2_DATA_DIRECTORY = directory;
    const runtime = createRuntime(join(directory, "missing-config.json"));
    const vault = new MemorySecretVault();
    const service = new AiProviderConnectionService(
      runtime.aiProviders,
      vault,
      (options) => ({
        healthCheck: () => Promise.resolve("verified"),
        generate: () =>
          Promise.resolve({
            text: JSON.stringify({
              title: "Local software wins",
              hook: "Your data should not need permission to exist.",
              script: "A complete short-video script.",
              caption: "A useful caption.",
              hashtags: ["#localfirst", "software"],
            }),
            provider: options.kind,
            model: options.model,
            promptTokens: 20,
            completionTokens: 40,
            durationMs: 8,
          }),
      }),
    );

    const connection = await service.connect({
      kind: "groq",
      apiKey: "fixture-secret-key",
    });
    const creation = await new GenerateContentCreation(
      runtime.creations,
      service,
    ).execute({
      format: "short-video",
      topic: "Local-first software",
      audience: "Product teams",
      tone: "Confident",
      language: "English",
    });

    expect(connection).toMatchObject({ connected: true, active: true });
    expect(vault.values.get("ai-provider:groq")).toBe("fixture-secret-key");
    expect(creation).toMatchObject({
      title: "Local software wins",
      providerKind: "groq",
      hashtags: ["localfirst", "software"],
    });
    expect(runtime.creations.list()).toEqual([creation]);
    expect(
      JSON.stringify(
        runtime.database.sqlite
          .prepare("SELECT * FROM ai_provider_profiles")
          .all(),
      ),
    ).not.toContain("fixture-secret-key");
    runtime.close();
  });

  it.each([
    {
      kind: "openai" as const,
      response: {
        output: [{ content: [{ type: "output_text", text: '{"ok":true}' }] }],
        usage: { input_tokens: 3, output_tokens: 2 },
      },
      path: "/responses",
    },
    {
      kind: "anthropic" as const,
      response: {
        content: [{ type: "text", text: '{"ok":true}' }],
        usage: { input_tokens: 3, output_tokens: 2 },
      },
      path: "/messages",
    },
    {
      kind: "gemini" as const,
      response: {
        candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
      },
      path: ":generateContent",
    },
    {
      kind: "openrouter" as const,
      response: compatibleResponse,
      path: "/chat/completions",
    },
    ...(
      [
        "groq",
        "mistral",
        "cerebras",
        "cohere",
        "nvidia",
        "xai",
        "deepseek",
        "together",
        "fireworks",
      ] as const
    ).map((kind) => ({
      kind,
      response: compatibleResponse,
      path: "/chat/completions",
    })),
  ])(
    "generates through the $kind adapter",
    async ({ kind, response, path }) => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(response));
      vi.stubGlobal("fetch", fetchMock);
      const generator = createProviderTextGenerator({
        kind,
        apiKey: "fixture-api-key",
        model: "fixture-model",
        baseUrl: requireAiProviderDefinition(kind).baseUrl,
      });

      const result = await generator.generate({
        prompt: "Return JSON",
        responseSchema: {
          type: "object",
          required: ["ok"],
          properties: { ok: { type: "boolean" } },
        },
      });

      const requestInput = fetchMock.mock.calls[0]?.[0];
      const requestUrl =
        typeof requestInput === "string"
          ? requestInput
          : requestInput instanceof URL
            ? requestInput.href
            : (requestInput?.url ?? "");
      expect(requestUrl).toContain(path);
      expect(result).toMatchObject({
        text: '{"ok":true}',
        provider: kind,
        promptTokens: 3,
        completionTokens: 2,
      });
    },
  );

  it("uses a provider-specific endpoint when verifying a compatible key", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ models: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const definition = requireAiProviderDefinition("cohere");
    const generator = createProviderTextGenerator({
      kind: definition.kind,
      apiKey: "fixture-api-key",
      model: definition.defaultModel,
      baseUrl: definition.baseUrl,
    });

    await expect(generator.healthCheck()).resolves.toBe(
      "Cohere API key verified",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cohere.com/v1/models",
      expect.objectContaining({
        headers: { authorization: "Bearer fixture-api-key" },
      }),
    );
  });
});
