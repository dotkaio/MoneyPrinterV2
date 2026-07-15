import { z } from "zod";

import type { AiProviderKind } from "../../domain/model.js";
import type {
  TextGenerationRequest,
  TextGenerationResult,
  TextGenerator,
} from "../../ports/generation.js";
import { AppError } from "../../shared/errors.js";
import { providerUrl, readProviderResponse } from "./provider-http.js";

const compatibleResponseSchema = z.object({
  choices: z.array(
    z
      .object({
        message: z
          .object({
            content: z.string().nullable(),
          })
          .loose(),
      })
      .loose(),
  ),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
    })
    .loose()
    .optional(),
});

export interface OpenAiCompatibleTextGeneratorOptions {
  kind: AiProviderKind;
  providerName: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  healthCheckUrl?: string;
  timeoutMs?: number;
}

export class OpenAiCompatibleTextGenerator implements TextGenerator {
  public constructor(
    private readonly options: OpenAiCompatibleTextGeneratorOptions,
  ) {}

  public async healthCheck(): Promise<string> {
    this.requireKey();
    const response = await fetch(
      this.options.healthCheckUrl ??
        providerUrl(this.options.baseUrl, "models"),
      {
        headers: { authorization: `Bearer ${this.options.apiKey}` },
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
      },
    );
    await readProviderResponse(response, this.options.providerName);
    return `${this.options.providerName} API key verified`;
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
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(this.systemMessage(request) === undefined
              ? []
              : [{ role: "system", content: this.systemMessage(request) }]),
            { role: "user", content: request.prompt },
          ],
          ...(request.temperature === undefined
            ? {}
            : { temperature: request.temperature }),
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 120_000),
      },
    );
    const body = compatibleResponseSchema.parse(
      await readProviderResponse(response, this.options.providerName),
    );
    const text = body.choices
      .map((choice) => choice.message.content ?? "")
      .join("")
      .trim();
    if (text.length === 0) {
      throw new AppError(
        `${this.options.providerName} returned an empty response`,
        "AI_PROVIDER_EMPTY_RESPONSE",
        true,
      );
    }
    return {
      text,
      provider: this.options.kind,
      model,
      promptTokens: body.usage?.prompt_tokens ?? null,
      completionTokens: body.usage?.completion_tokens ?? null,
      durationMs: performance.now() - startedAt,
    };
  }

  private systemMessage(request: TextGenerationRequest): string | undefined {
    if (request.responseSchema === undefined) {
      return request.system;
    }
    return [
      request.system,
      "Return one valid JSON object matching this JSON Schema exactly:",
      JSON.stringify(request.responseSchema),
    ]
      .filter((part): part is string => part !== undefined)
      .join("\n");
  }

  private requireKey(): void {
    if (this.options.apiKey.trim().length === 0) {
      throw new AppError(
        `${this.options.providerName} API key is not configured`,
        "AI_PROVIDER_KEY_MISSING",
      );
    }
  }
}
