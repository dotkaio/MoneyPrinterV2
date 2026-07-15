import { z } from "zod";

import { creationFormats, type ContentCreation } from "../domain/model.js";
import type { ContentCreationRepository } from "../infrastructure/database/repositories.js";
import type { TextGenerator } from "../ports/generation.js";
import { AppError } from "../shared/errors.js";
import type {
  ActiveTextGenerator,
  AiProviderConnectionService,
} from "./ai-provider-connection-service.js";

export const generateCreationRequestSchema = z.object({
  format: z.enum(creationFormats),
  topic: z.string().trim().min(3).max(500),
  audience: z.string().trim().min(2).max(300).default("General audience"),
  tone: z.string().trim().min(2).max(100).default("Clear and engaging"),
  language: z.string().trim().min(2).max(100).default("English"),
});

const generatedCreationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  hook: z.string().trim().min(1).max(500),
  script: z.string().trim().min(1).max(15_000),
  caption: z.string().trim().min(1).max(3000),
  hashtags: z.array(z.string().trim().min(1).max(100)).max(20),
});

const generatedCreationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "hook", "script", "caption", "hashtags"],
  properties: {
    title: { type: "string", maxLength: 200 },
    hook: { type: "string", maxLength: 500 },
    script: { type: "string", maxLength: 15_000 },
    caption: { type: "string", maxLength: 3000 },
    hashtags: {
      type: "array",
      maxItems: 20,
      items: { type: "string", maxLength: 100 },
    },
  },
} as const;

export type GenerateCreationRequest = z.input<
  typeof generateCreationRequestSchema
>;

export type GeneratedContentCreation = Omit<
  ContentCreation,
  "id" | "createdAt" | "updatedAt"
>;

export class GenerateContentCreation {
  public constructor(
    private readonly creations: ContentCreationRepository,
    private readonly providers: AiProviderConnectionService,
  ) {}

  public async execute(request: unknown): Promise<ContentCreation> {
    const active = await this.providers.activeTextGenerator();
    return this.creations.create(await generateContentDraft(request, active));
  }
}

export async function generateContentDraft(
  request: unknown,
  active: Pick<ActiveTextGenerator, "profile" | "generator">,
): Promise<GeneratedContentCreation> {
  const input = generateCreationRequestSchema.parse(request);
  const result = await generateDraftText(active.generator, input);
  const generated = generatedCreationSchema.parse(parseJson(result.text));
  return {
    ...input,
    ...generated,
    hashtags: generated.hashtags.map((hashtag) => hashtag.replace(/^#+/u, "")),
    providerKind: active.profile.kind,
    model: result.model,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    durationMs: result.durationMs,
  };
}

async function generateDraftText(
  generator: TextGenerator,
  input: z.output<typeof generateCreationRequestSchema>,
) {
  return generator.generate({
    system: [
      "You are the creative director inside MoneyPrinter.",
      "Create polished, immediately usable content without filler or unsupported factual claims.",
      "Return only data matching the requested JSON schema.",
    ].join(" "),
    prompt: [
      `Format: ${formatGuidance(input.format)}`,
      `Topic: ${input.topic}`,
      `Audience: ${input.audience}`,
      `Tone: ${input.tone}`,
      `Language: ${input.language}`,
      "The hook must earn attention in the first sentence.",
      "The script must be publication-ready and include useful structure for its format.",
      "Write a standalone caption and relevant hashtags without the # prefix.",
    ].join("\n"),
    responseSchema: generatedCreationJsonSchema,
    temperature: 0.7,
  });
}

function formatGuidance(format: ContentCreation["format"]): string {
  switch (format) {
    case "short-video":
      return "45-60 second vertical short with concise scene and delivery cues";
    case "social-post":
      return "high-signal social post with readable line breaks and a clear close";
    case "newsletter":
      return "focused newsletter with a strong opening, sections, and useful takeaway";
    case "ad-copy":
      return "conversion-minded ad with a concrete value proposition and call to action";
  }
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end < start) {
    throw new AppError(
      "AI provider did not return structured content",
      "AI_PROVIDER_RESPONSE_INVALID",
      true,
    );
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  } catch (error) {
    throw new AppError(
      "AI provider returned invalid structured content",
      "AI_PROVIDER_RESPONSE_INVALID",
      true,
      { cause: error },
    );
  }
}
