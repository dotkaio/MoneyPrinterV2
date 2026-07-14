import { Ollama } from "ollama";

import { AppError } from "../../shared/errors.js";
import type {
  TextGenerationRequest,
  TextGenerationResult,
  TextGenerator,
} from "../../ports/generation.js";

export interface OllamaTextGeneratorOptions {
  baseUrl: string;
  model: string;
}

export class OllamaTextGenerator implements TextGenerator {
  private readonly client: Ollama;

  public constructor(private readonly options: OllamaTextGeneratorOptions) {
    this.client = new Ollama({ host: options.baseUrl });
  }

  public async healthCheck(): Promise<string> {
    const response = await this.client.list();
    const models = response.models.map((model) => model.model);
    return models.length === 0
      ? "Ollama is reachable but has no models"
      : models.join(", ");
  }

  public async generate(
    request: TextGenerationRequest,
  ): Promise<TextGenerationResult> {
    const model = request.model ?? this.options.model;
    if (model.length === 0) {
      throw new AppError(
        "No Ollama model is configured",
        "OLLAMA_MODEL_MISSING",
      );
    }

    const startedAt = performance.now();
    const response = await this.client.chat({
      model,
      messages: [
        ...(request.system === undefined
          ? []
          : ([{ role: "system", content: request.system }] as const)),
        { role: "user", content: request.prompt },
      ],
      stream: false,
      ...(request.responseSchema === undefined
        ? {}
        : { format: request.responseSchema }),
      ...(request.temperature === undefined
        ? {}
        : { options: { temperature: request.temperature } }),
    });

    const text = response.message.content.trim();
    if (text.length === 0) {
      throw new AppError(
        "Ollama returned an empty response",
        "OLLAMA_EMPTY_RESPONSE",
        true,
      );
    }

    return {
      text,
      provider: "ollama",
      model,
      promptTokens: response.prompt_eval_count,
      completionTokens: response.eval_count,
      durationMs: performance.now() - startedAt,
    };
  }
}
