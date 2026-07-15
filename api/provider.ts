import { z } from "zod";

import { requireAiProviderDefinition } from "../src/application/ai-provider-catalog.js";
import { createProviderTextGenerator } from "../src/application/create-provider-text-generator.js";
import {
  generateContentDraft,
  generateCreationRequestSchema,
} from "../src/application/generate-content-creation.js";
import { aiProviderKinds } from "../src/domain/model.js";
import { AppError, errorMessage } from "../src/shared/errors.js";

const providerCredentialsSchema = z.object({
  kind: z.enum(aiProviderKinds),
  apiKey: z
    .string()
    .trim()
    .min(8)
    .max(1000)
    .regex(/^[^\r\n]+$/u),
  model: z.string().trim().min(1).max(200),
});

const providerRequestSchema = z.discriminatedUnion("action", [
  providerCredentialsSchema.extend({ action: z.literal("verify") }),
  providerCredentialsSchema.extend({
    action: z.literal("generate"),
    input: generateCreationRequestSchema,
  }),
]);

const responseHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
} as const;

export async function POST(request: Request): Promise<Response> {
  if (!isTrustedOrigin(request)) {
    return jsonResponse(403, { error: "Request origin is not allowed" });
  }
  if (
    !(request.headers.get("content-type") ?? "").startsWith("application/json")
  ) {
    return jsonResponse(415, { error: "Requests must use application/json" });
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return jsonResponse(413, { error: "Request is too large" });
  }

  try {
    const parsed = providerRequestSchema.parse(await request.json());
    const definition = requireAiProviderDefinition(parsed.kind);
    const generator = createProviderTextGenerator({
      kind: parsed.kind,
      apiKey: parsed.apiKey,
      model: parsed.model,
      baseUrl: definition.baseUrl,
    });

    if (parsed.action === "verify") {
      return jsonResponse(200, {
        verified: true,
        detail: await generator.healthCheck(),
      });
    }

    const draft = await generateContentDraft(parsed.input, {
      profile: {
        kind: parsed.kind,
        model: parsed.model,
        baseUrl: definition.baseUrl,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      generator,
    });
    const timestamp = new Date().toISOString();
    return jsonResponse(201, {
      id: crypto.randomUUID(),
      ...draft,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  } catch (error) {
    const status = requestErrorStatus(error);
    return jsonResponse(status, {
      error: publicErrorMessage(error),
      ...(error instanceof AppError ? { code: error.code } : {}),
    });
  }
}

function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) {
    return true;
  }
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function requestErrorStatus(error: unknown): number {
  if (error instanceof SyntaxError || error instanceof z.ZodError) {
    return 400;
  }
  if (error instanceof AppError) {
    return error.code === "AI_PROVIDER_REQUEST_FAILED" ? 400 : 502;
  }
  return 500;
}

function publicErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return "Provider request is invalid";
  }
  if (error instanceof SyntaxError) {
    return "Request contains invalid JSON";
  }
  return errorMessage(error).slice(0, 1000);
}

function jsonResponse(status: number, value: unknown): Response {
  return new Response(`${JSON.stringify(value)}\n`, {
    status,
    headers: responseHeaders,
  });
}
