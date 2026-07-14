import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { firefox } from "playwright";
import { z } from "zod";

import type { AccountRepository } from "../../infrastructure/database/repositories.js";
import type {
  PublishedPost,
  SocialPostRequest,
  SocialPublisher,
} from "../../ports/publishing.js";
import { AppError } from "../../shared/errors.js";

const createTweetResponseSchema = z.object({
  data: z.object({
    create_tweet: z.object({
      tweet_results: z.object({
        result: z.object({ rest_id: z.string().min(1) }),
      }),
    }),
  }),
});

export interface PlaywrightTwitterPublisherOptions {
  baseUrl: string;
  headless: boolean;
  livePublishing: boolean;
  dataDirectory: string;
}

export class PlaywrightTwitterPublisher implements SocialPublisher {
  public constructor(
    private readonly accounts: AccountRepository,
    private readonly options: PlaywrightTwitterPublisherOptions,
  ) {}

  public async publish(request: SocialPostRequest): Promise<PublishedPost> {
    if (!this.options.livePublishing) {
      throw new AppError(
        "Live publishing is disabled; Twitter posts can only be previewed",
        "LIVE_PUBLISHING_DISABLED",
      );
    }
    const account = this.accounts.findById(request.accountId);
    if (account?.platform !== "twitter") {
      throw new AppError(
        `Twitter account not found: ${request.accountId}`,
        "ACCOUNT_NOT_FOUND",
      );
    }
    if (account.browserProfilePath === null) {
      throw new AppError(
        "Twitter account requires a dedicated browser profile",
        "TWITTER_PROFILE_MISSING",
      );
    }
    if (request.text.length === 0 || request.text.length > 280) {
      throw new AppError(
        "Twitter posts must contain 1-280 characters",
        "TWITTER_LENGTH_INVALID",
      );
    }

    const evidenceDirectory = resolve(
      this.options.dataDirectory,
      "browser-artifacts",
      request.idempotencyKey.replaceAll(/[^a-zA-Z0-9_-]/gu, "_"),
    );
    await mkdir(evidenceDirectory, { recursive: true });
    const context = await firefox.launchPersistentContext(
      account.browserProfilePath,
      {
        headless: this.options.headless,
      },
    );
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = context.pages()[0] ?? (await context.newPage());

    try {
      await page.goto(
        `${this.options.baseUrl.replace(/\/$/u, "")}/compose/post`,
        {
          waitUntil: "domcontentloaded",
        },
      );
      const editor = page.locator('[data-testid="tweetTextarea_0"]');
      await editor.waitFor({ state: "visible" });
      await editor.fill(request.text);
      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("CreateTweet"),
        { timeout: 30_000 },
      );
      await page
        .locator(
          '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]',
        )
        .click();
      const response = await responsePromise;
      const parsed = createTweetResponseSchema.parse(await response.json());
      const postId = parsed.data.create_tweet.tweet_results.result.rest_id;
      await context.tracing.stop({
        path: resolve(evidenceDirectory, "trace.zip"),
      });
      return {
        platformItemId: postId,
        publicUrl: `${this.options.baseUrl.replace(/\/$/u, "")}/i/web/status/${postId}`,
        provider: "playwright-twitter",
      };
    } catch (error) {
      await page.screenshot({
        path: resolve(evidenceDirectory, "failure.png"),
        fullPage: true,
      });
      await context.tracing.stop({
        path: resolve(evidenceDirectory, "trace.zip"),
      });
      throw new AppError(
        "Twitter publishing failed",
        "TWITTER_PUBLISH_FAILED",
        true,
        {
          cause: error,
        },
      );
    } finally {
      await context.close();
    }
  }
}
