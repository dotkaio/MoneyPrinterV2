import { z } from "zod";

import type {
  TextGenerationRequest,
  TextGenerationResult,
  TextGenerator,
} from "../../ports/generation.js";
import { AppError } from "../../shared/errors.js";
import { providerUrl, readProviderResponse } from "../ai/provider-http.js";

const openAiResponseSchema = z.object({
  output: z.array(
    z
      .object({
        content: z
          .array(
            z
              .object({
                type: z.string(),
                text: z.string().optional(),
              })
              .loose(),
          )
          .optional(),
      })
      .loose(),
  ),
  usage: z
    .object({
      input_tokens: z.number().int().nonnegative(),
      output_tokens: z.number().int().nonnegative(),
    })
    .optional(),
});

export interface OpenAiTextGeneratorOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs?: number;
}

export class OpenAiTextGenerator implements TextGenerator {
  public constructor(private readonly options: OpenAiTextGeneratorOptions) {}

  public async healthCheck(): Promise<string> {
    this.requireKey();
    const response = await fetch(providerUrl(this.options.baseUrl, "models"), {
      headers: { authorization: `Bearer ${this.options.apiKey}` },
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
    });
    await readProviderResponse(response, "OpenAI");
    return "OpenAI API key verified";
  }

  public async generate(
    request: TextGenerationRequest,
  ): Promise<TextGenerationResult> {
    this.requireKey();
    const model = request.model ?? this.options.model;
    const startedAt = performance.now();
    const response = await fetch(
      providerUrl(this.options.baseUrl, "responses"),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: request.prompt,
          ...(request.system === undefined
            ? {}
            : { instructions: request.system }),
          ...(request.temperature === undefined
            ? {}
            : { temperature: request.temperature }),
          ...(request.responseSchema === undefined
            ? {}
            : {
                text: {
                  format: {
                    type: "json_schema",
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
    const body = openAiResponseSchema.parse(
      await readProviderResponse(response, "OpenAI"),
    );
    const text = body.output
      .flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text ?? "")
      .join("")
      .trim();
    if (text.length === 0) {
      throw new AppError(
        "OpenAI returned an empty response",
        "AI_PROVIDER_EMPTY_RESPONSE",
        true,
      );
    }
    return {
      text,
      provider: "openai",
      model,
      promptTokens: body.usage?.input_tokens ?? null,
      completionTokens: body.usage?.output_tokens ?? null,
      durationMs: performance.now() - startedAt,
    };
  }

  private requireKey(): void {
    if (this.options.apiKey.trim().length === 0) {
      throw new AppError(
        "OpenAI API key is not configured",
        "AI_PROVIDER_KEY_MISSING",
      );
    }
  }
}
