import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { z } from "zod";

import type { Runtime } from "../runtime.js";

const youtubeVideoSchema = z
  .object({
    title: z.string().optional().default("Untitled legacy video"),
    description: z.string().optional().default(""),
    url: z.string().optional().default(""),
    date: z.string().optional(),
  })
  .loose();

const youtubeAccountSchema = z
  .object({
    id: z.string().min(1),
    nickname: z.string().optional().default("Legacy YouTube account"),
    firefox_profile: z.string().optional().nullable(),
    niche: z.string().optional().default("general"),
    language: z.string().optional().default("English"),
    videos: z.array(youtubeVideoSchema).optional().default([]),
  })
  .loose();

const twitterPostSchema = z
  .object({
    content: z.string().min(1),
    date: z.string().optional(),
  })
  .loose();

const twitterAccountSchema = z
  .object({
    id: z.string().min(1),
    nickname: z.string().optional().default("Legacy Twitter account"),
    firefox_profile: z.string().optional().nullable(),
    topic: z.string().optional().default("general"),
    posts: z.array(twitterPostSchema).optional().default([]),
  })
  .loose();

const affiliateProductSchema = z
  .object({
    id: z.string().min(1),
    affiliate_link: z.string().min(1),
    twitter_uuid: z.string().optional().nullable(),
  })
  .loose();

const youtubeCacheSchema = z.object({
  accounts: z.array(youtubeAccountSchema).optional().default([]),
});
const twitterCacheSchema = z.object({
  accounts: z.array(twitterAccountSchema).optional().default([]),
});
const affiliateCacheSchema = z.object({
  products: z.array(affiliateProductSchema).optional().default([]),
});

export interface LegacyMigrationReport {
  sourceDirectory: string;
  dryRun: boolean;
  discovered: {
    accounts: number;
    publishedItems: number;
    affiliateProducts: number;
  };
  imported: {
    accounts: number;
    publishedItems: number;
    affiliateProducts: number;
  };
  skipped: number;
  warnings: readonly string[];
}

interface MutableReport extends LegacyMigrationReport {
  warnings: string[];
}

export class LegacyMigrationService {
  public constructor(private readonly runtime: Runtime) {}

  public migrate(source: string, dryRun: boolean): LegacyMigrationReport {
    const sourceDirectory = this.resolveSourceDirectory(source);
    const youtube = this.readCache(
      join(sourceDirectory, "youtube.json"),
      youtubeCacheSchema,
    );
    const twitter = this.readCache(
      join(sourceDirectory, "twitter.json"),
      twitterCacheSchema,
    );
    const affiliate = this.readCache(
      join(sourceDirectory, "afm.json"),
      affiliateCacheSchema,
    );
    const report: MutableReport = {
      sourceDirectory,
      dryRun,
      discovered: {
        accounts: youtube.accounts.length + twitter.accounts.length,
        publishedItems:
          youtube.accounts.reduce(
            (sum, account) => sum + account.videos.length,
            0,
          ) +
          twitter.accounts.reduce(
            (sum, account) => sum + account.posts.length,
            0,
          ),
        affiliateProducts: affiliate.products.length,
      },
      imported: { accounts: 0, publishedItems: 0, affiliateProducts: 0 },
      skipped: 0,
      warnings: [],
    };

    if (dryRun) {
      return report;
    }

    this.runtime.database.sqlite.transaction(() => {
      for (const account of youtube.accounts) {
        const canImport = this.importAccount(
          account.id,
          "youtube",
          account.nickname,
          account.niche,
          account.language,
          account.firefox_profile,
          report,
        );
        if (!canImport) continue;
        for (const video of account.videos) {
          this.importYoutubeVideo(account.id, account.niche, video, report);
        }
      }

      for (const account of twitter.accounts) {
        const canImport = this.importAccount(
          account.id,
          "twitter",
          account.nickname,
          account.topic,
          "English",
          account.firefox_profile,
          report,
        );
        if (!canImport) continue;
        for (const post of account.posts) {
          this.importTwitterPost(account.id, account.topic, post, report);
        }
      }

      for (const product of affiliate.products) {
        if (this.runtime.affiliate.findByLegacyId(product.id) !== null) {
          report.skipped += 1;
          continue;
        }
        const accountId =
          product.twitter_uuid !== null && product.twitter_uuid !== undefined
            ? (this.runtime.accounts.findById(product.twitter_uuid)?.id ?? null)
            : null;
        if (
          product.twitter_uuid !== null &&
          product.twitter_uuid !== undefined &&
          accountId === null
        ) {
          report.warnings.push(
            `Affiliate product ${product.id} references missing Twitter account ${product.twitter_uuid}`,
          );
        }
        this.runtime.affiliate.importLegacy(
          product.id,
          product.affiliate_link,
          product.affiliate_link,
          accountId,
        );
        report.imported.affiliateProducts += 1;
      }
    })();

    return report;
  }

  private importAccount(
    id: string,
    platform: "youtube" | "twitter",
    nickname: string,
    niche: string,
    language: string,
    browserProfilePath: string | null | undefined,
    report: MutableReport,
  ): boolean {
    const existing = this.runtime.accounts.findById(id);
    if (existing !== null) {
      if (existing.platform !== platform) {
        report.warnings.push(
          `Account ${id} is ${existing.platform} in SQLite but ${platform} in the legacy cache`,
        );
        report.skipped += 1;
        return false;
      }
      report.skipped += 1;
      return true;
    }
    this.runtime.accounts.create({
      id,
      platform,
      nickname,
      niche,
      language,
      browserProfilePath: browserProfilePath ?? null,
      configuration: { migratedFrom: "python-cache" },
    });
    report.imported.accounts += 1;
    return true;
  }

  private importYoutubeVideo(
    accountId: string,
    niche: string,
    video: z.infer<typeof youtubeVideoSchema>,
    report: MutableReport,
  ): void {
    const id = this.legacyContentId(
      "youtube",
      accountId,
      video.url,
      video.title,
      video.date ?? "",
    );
    if (this.runtime.content.findById(id) !== null) {
      report.skipped += 1;
      return;
    }
    const createdAt = this.legacyDate(video.date);
    this.runtime.content.importLegacy({
      id,
      accountId,
      kind: "youtube-short",
      topic: niche,
      metadata: {
        title: video.title,
        description: video.description,
        legacyDate: video.date ?? null,
        migratedFrom: "python-cache",
      },
      createdAt,
    });
    this.runtime.publishing.recordPublished({
      contentItemId: id,
      accountId,
      platform: "youtube",
      platformItemId: this.youtubeVideoId(video.url) ?? id,
      publicUrl: video.url || null,
      privacyStatus: "unlisted",
      publishedAt: createdAt,
    });
    report.imported.publishedItems += 1;
  }

  private importTwitterPost(
    accountId: string,
    topic: string,
    post: z.infer<typeof twitterPostSchema>,
    report: MutableReport,
  ): void {
    const id = this.legacyContentId(
      "twitter",
      accountId,
      post.content,
      post.date ?? "",
    );
    if (this.runtime.content.findById(id) !== null) {
      report.skipped += 1;
      return;
    }
    const createdAt = this.legacyDate(post.date);
    this.runtime.content.importLegacy({
      id,
      accountId,
      kind: "twitter-post",
      topic,
      script: post.content,
      metadata: {
        legacyDate: post.date ?? null,
        migratedFrom: "python-cache",
      },
      createdAt,
    });
    this.runtime.publishing.recordPublished({
      contentItemId: id,
      accountId,
      platform: "twitter",
      platformItemId: id,
      publicUrl: null,
      privacyStatus: null,
      publishedAt: createdAt,
    });
    report.imported.publishedItems += 1;
  }

  private readCache<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
  ): z.output<TSchema> {
    if (!existsSync(path)) {
      return schema.parse({});
    }
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
    return schema.parse(raw);
  }

  private resolveSourceDirectory(source: string): string {
    const nested = join(source, ".mp");
    if (!existsSync(join(source, "youtube.json")) && existsSync(nested)) {
      return nested;
    }
    return source;
  }

  private legacyContentId(...parts: readonly string[]): string {
    return `legacy-${createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32)}`;
  }

  private legacyDate(value: string | undefined): string {
    if (value === undefined) return new Date().toISOString();
    const parsed = new Date(
      value.includes("T") ? value : value.replace(" ", "T"),
    );
    return Number.isNaN(parsed.valueOf())
      ? new Date().toISOString()
      : parsed.toISOString();
  }

  private youtubeVideoId(value: string): string | null {
    if (!value) return null;
    try {
      const url = new URL(value);
      if (url.hostname === "youtu.be") return basename(url.pathname);
      return (
        url.searchParams.get("v") ??
        url.pathname.split("/").filter(Boolean).at(-1) ??
        null
      );
    } catch {
      return null;
    }
  }
}
