import { z } from "zod";

import type {
  TextGenerationRequest,
  TextGenerationResult,
  TextGenerator,
} from "../../ports/generation.js";
import { AppError } from "../../shared/errors.js";
import { providerUrl, readProviderResponse } from "../ai/provider-http.js";

const openRouterResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string().nullable() }),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
    })
    .optional(),
});

export interface OpenRouterTextGeneratorOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs?: number;
}

export class OpenRouterTextGenerator implements TextGenerator {
  public constructor(
    private readonly options: OpenRouterTextGeneratorOptions,
  ) {}

  public async healthCheck(): Promise<string> {
    this.requireKey();
    const response = await fetch(providerUrl(this.options.baseUrl, "key"), {
      headers: { authorization: `Bearer ${this.options.apiKey}` },
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
    });
    await readProviderResponse(response, "OpenRouter");
    return "OpenRouter API key verified";
  }

  public async generate(
    request: TextGenerationRequest,
  ): Promise<TextGenerationResult> {
    this.requireKey();
    const model = request.model ?? this.options.model;
    const startedAt = performance.now();
    const response = await fetch(
      providerUrl(this.options.baseUrl, "chat/completions"),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
          "x-openrouter-title": "MoneyPrinter",
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(request.system === undefined
              ? []
              : [{ role: "system", content: request.system }]),
            { role: "user", content: request.prompt },
          ],
          ...(request.temperature === undefined
            ? {}
            : { temperature: request.temperature }),
          ...(request.responseSchema === undefined
            ? {}
            : {
                response_format: {
                  type: "json_schema",
                  json_schema: {
                    name: "moneyprinter_response",
                    strict: true,
                    schema: request.responseSchema,
                  },
                },
              }),
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 120_000),
      },
    );
    const body = openRouterResponseSchema.parse(
      await readProviderResponse(response, "OpenRouter"),
    );
    const text = body.choices
      .map((choice) => choice.message.content ?? "")
      .join("")
      .trim();
    if (text.length === 0) {
      throw new AppError(
        "OpenRouter returned an empty response",
        "AI_PROVIDER_EMPTY_RESPONSE",
        true,
      );
    }
    return {
      text,
      provider: "openrouter",
      model,
      promptTokens: body.usage?.prompt_tokens ?? null,
      completionTokens: body.usage?.completion_tokens ?? null,
      durationMs: performance.now() - startedAt,
    };
  }

  private requireKey(): void {
    if (this.options.apiKey.trim().length === 0) {
      throw new AppError(
        "OpenRouter API key is not configured",
        "AI_PROVIDER_KEY_MISSING",
      );
    }
  }
}
