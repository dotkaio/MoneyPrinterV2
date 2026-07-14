import type { Account, ContentItem } from "../domain/model.js";
import type { ContentRepository } from "../infrastructure/database/repositories.js";
import type { TextGenerator } from "../ports/generation.js";
import { AppError, errorMessage } from "../shared/errors.js";

export class GenerateTwitterPost {
  public constructor(
    private readonly content: ContentRepository,
    private readonly textGenerator: TextGenerator,
  ) {}

  public async execute(
    account: Account,
    subject?: string,
  ): Promise<ContentItem> {
    if (account.platform !== "twitter") {
      throw new AppError(
        "Twitter generation requires a Twitter account",
        "ACCOUNT_PLATFORM_INVALID",
      );
    }
    let content = this.content.create(account.id, "twitter-post");
    content = this.content.update(content.id, { state: "generating" });
    try {
      const generated = await this.textGenerator.generate({
        system:
          "Write a single natural Twitter post. Return only the post text with no quotation marks.",
        prompt: `Topic: ${subject ?? account.niche}\nLanguage: ${account.language}\nMaximum length: 280 characters.`,
        temperature: 0.8,
      });
      const postText = this.limitPost(
        generated.text.replace(/^['"]|['"]$/gu, "").trim(),
      );
      return this.content.update(content.id, {
        state: "ready",
        topic: subject ?? account.niche,
        script: postText,
        metadata: {
          postText,
          textGeneration: {
            provider: generated.provider,
            model: generated.model,
            durationMs: generated.durationMs,
          },
        },
      });
    } catch (error) {
      this.content.update(content.id, {
        state: "failed",
        errorCode:
          error instanceof AppError ? error.code : "TWITTER_GENERATION_FAILED",
        errorMessage: errorMessage(error),
      });
      throw error;
    }
  }

  private limitPost(text: string): string {
    if (text.length <= 280) {
      return text;
    }
    const shortened = text
      .slice(0, 277)
      .replace(/\s+\S*$/u, "")
      .trimEnd();
    return `${shortened}...`;
  }
}
