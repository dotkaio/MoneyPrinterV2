import { z } from "zod";

import type {
  TextGenerationRequest,
  TextGenerationResult,
  TextGenerator,
} from "../../ports/generation.js";
import { AppError } from "../../shared/errors.js";
import { providerUrl, readProviderResponse } from "../ai/provider-http.js";

const geminiTextResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(z.object({ text: z.string().optional() })),
          })
          .optional(),
      }),
    )
    .optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().int().nonnegative().optional(),
      candidatesTokenCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export interface GeminiTextGeneratorOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs?: number;
}

export class GeminiTextGenerator implements TextGenerator {
  public constructor(private readonly options: GeminiTextGeneratorOptions) {}

  public async healthCheck(): Promise<string> {
    this.requireKey();
    const url = providerUrl(this.options.baseUrl, "models");
    url.searchParams.set("pageSize", "1");
    const response = await fetch(url, {
      headers: { "x-goog-api-key": this.options.apiKey },
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
    });
    await readProviderResponse(response, "Gemini");
    return "Gemini API key verified";
  }

  public async generate(
    request: TextGenerationRequest,
  ): Promise<TextGenerationResult> {
    this.requireKey();
    const model = request.model ?? this.options.model;
    const startedAt = performance.now();
    const response = await fetch(
      providerUrl(
        this.options.baseUrl,
        `models/${encodeURIComponent(model)}:generateContent`,
      ),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.options.apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: request.prompt }] }],
          ...(request.system === undefined
            ? {}
            : {
                systemInstruction: {
                  parts: [{ text: request.system }],
                },
              }),
          generationConfig: {
            ...(request.temperature === undefined
              ? {}
              : { temperature: request.temperature }),
            ...(request.responseSchema === undefined
              ? {}
              : {
                  responseMimeType: "application/json",
                  responseSchema: request.responseSchema,
                }),
          },
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 120_000),
      },
    );
    const body = geminiTextResponseSchema.parse(
      await readProviderResponse(response, "Gemini"),
    );
    const text = (body.candidates ?? [])
      .flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();
    if (text.length === 0) {
      throw new AppError(
        "Gemini returned an empty response",
        "AI_PROVIDER_EMPTY_RESPONSE",
        true,
      );
    }
    return {
      text,
      provider: "gemini",
      model,
      promptTokens: body.usageMetadata?.promptTokenCount ?? null,
      completionTokens: body.usageMetadata?.candidatesTokenCount ?? null,
      durationMs: performance.now() - startedAt,
    };
  }

  private requireKey(): void {
    if (this.options.apiKey.trim().length === 0) {
      throw new AppError(
        "Gemini API key is not configured",
        "AI_PROVIDER_KEY_MISSING",
      );
    }
  }
}
