import { z } from "zod";

import type {
  TextGenerationRequest,
  TextGenerationResult,
  TextGenerator,
} from "../../ports/generation.js";
import { AppError } from "../../shared/errors.js";
import { providerUrl, readProviderResponse } from "../ai/provider-http.js";

const anthropicResponseSchema = z.object({
  content: z.array(
    z
      .object({
        type: z.string(),
        text: z.string().optional(),
      })
      .loose(),
  ),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
});

export interface AnthropicTextGeneratorOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs?: number;
}

export class AnthropicTextGenerator implements TextGenerator {
  public constructor(private readonly options: AnthropicTextGeneratorOptions) {}

  public async healthCheck(): Promise<string> {
    this.requireKey();
    const url = providerUrl(this.options.baseUrl, "models");
    url.searchParams.set("limit", "1");
    const response = await fetch(url, {
      headers: this.headers(),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
    });
    await readProviderResponse(response, "Anthropic");
    return "Anthropic API key verified";
  }

  public async generate(
    request: TextGenerationRequest,
  ): Promise<TextGenerationResult> {
    this.requireKey();
    const model = request.model ?? this.options.model;
    const schemaInstruction =
      request.responseSchema === undefined
        ? ""
        : `\n\nReturn only JSON matching this schema:\n${JSON.stringify(request.responseSchema)}`;
    const startedAt = performance.now();
    const response = await fetch(
      providerUrl(this.options.baseUrl, "messages"),
      {
        method: "POST",
        headers: { ...this.headers(), "content-type": "application/json" },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          ...(request.system === undefined ? {} : { system: request.system }),
          messages: [
            { role: "user", content: `${request.prompt}${schemaInstruction}` },
          ],
          ...(request.temperature === undefined
            ? {}
            : { temperature: request.temperature }),
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 120_000),
      },
    );
    const body = anthropicResponseSchema.parse(
      await readProviderResponse(response, "Anthropic"),
    );
    const text = body.content
      .filter((item) => item.type === "text")
      .map((item) => item.text ?? "")
      .join("")
      .trim();
    if (text.length === 0) {
      throw new AppError(
        "Anthropic returned an empty response",
        "AI_PROVIDER_EMPTY_RESPONSE",
        true,
      );
    }
    return {
      text,
      provider: "anthropic",
      model,
      promptTokens: body.usage.input_tokens,
      completionTokens: body.usage.output_tokens,
      durationMs: performance.now() - startedAt,
    };
  }

  private headers(): Readonly<Record<string, string>> {
    return {
      "anthropic-version": "2023-06-01",
      "x-api-key": this.options.apiKey,
    };
  }

  private requireKey(): void {
    if (this.options.apiKey.trim().length === 0) {
      throw new AppError(
        "Anthropic API key is not configured",
        "AI_PROVIDER_KEY_MISSING",
      );
    }
  }
}
