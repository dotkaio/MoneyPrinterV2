import { AppError } from "../../shared/errors.js";
import type {
  GeneratedImage,
  ImageGenerationRequest,
  ImageGenerator,
} from "../../ports/generation.js";

interface GeminiInlineData {
  data?: string;
  mimeType?: string;
}

interface GeminiPart {
  inlineData?: GeminiInlineData;
  inline_data?: GeminiInlineData;
}

interface GeminiResponse {
  candidates?: readonly {
    content?: { parts?: readonly GeminiPart[] };
  }[];
  error?: { message?: string };
}

export interface GeminiImageGeneratorOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs?: number;
}

export class GeminiImageGenerator implements ImageGenerator {
  public constructor(private readonly options: GeminiImageGeneratorOptions) {}

  public async generate(
    request: ImageGenerationRequest,
  ): Promise<GeneratedImage> {
    if (this.options.apiKey.length === 0) {
      throw new AppError(
        "Gemini API key is not configured",
        "GEMINI_API_KEY_MISSING",
      );
    }

    const startedAt = performance.now();
    const response = await fetch(
      `${this.options.baseUrl.replace(/\/$/u, "")}/models/${encodeURIComponent(this.options.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.options.apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: request.prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: request.aspectRatio },
          },
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 300_000),
      },
    );
    const body = (await response.json()) as GeminiResponse;
    if (!response.ok) {
      throw new AppError(
        body.error?.message ?? `Gemini returned HTTP ${response.status}`,
        "GEMINI_REQUEST_FAILED",
        response.status === 429 || response.status >= 500,
      );
    }

    for (const candidate of body.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        const inlineData = part.inlineData ?? part.inline_data;
        if (inlineData?.data !== undefined) {
          return {
            bytes: Buffer.from(inlineData.data, "base64"),
            mimeType: inlineData.mimeType ?? "image/png",
            provider: "gemini",
            model: this.options.model,
            durationMs: performance.now() - startedAt,
          };
        }
      }
    }

    throw new AppError(
      "Gemini response did not contain an image",
      "GEMINI_IMAGE_MISSING",
      true,
    );
  }
}
