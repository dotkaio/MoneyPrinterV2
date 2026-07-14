import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { LegacyMigrationService } from "../src/application/migrate-legacy.js";
import { createRuntime } from "../src/runtime.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
  delete process.env.MPV2_DATA_DIRECTORY;
});

function fixture(): {
  source: string;
  data: string;
} {
  const root = join(tmpdir(), `mpv2-legacy-${crypto.randomUUID()}`);
  const source = join(root, ".mp");
  const data = join(root, "data");
  directories.push(root);
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "youtube.json"),
    JSON.stringify({
      accounts: [
        {
          id: "youtube-one",
          nickname: "Old Channel",
          firefox_profile: "/profiles/youtube",
          niche: "space",
          language: "English",
          videos: [
            {
              title: "A Short",
              description: "Legacy description",
              url: "https://youtube.com/shorts/abc123",
              date: "2025-01-02 03:04:05",
            },
          ],
        },
      ],
    }),
  );
  writeFileSync(
    join(source, "twitter.json"),
    JSON.stringify({
      accounts: [
        {
          id: "twitter-one",
          nickname: "Old Bot",
          firefox_profile: "/profiles/twitter",
          topic: "technology",
          posts: [{ content: "A legacy post", date: "2025-02-03 04:05:06" }],
        },
      ],
    }),
  );
  writeFileSync(
    join(source, "afm.json"),
    JSON.stringify({
      products: [
        {
          id: "product-one",
          affiliate_link: "https://example.com/product?tag=legacy",
          twitter_uuid: "twitter-one",
        },
      ],
    }),
  );
  return { source: root, data };
}

describe("LegacyMigrationService", () => {
  it("supports a mutation-free dry run", () => {
    const { source, data } = fixture();
    process.env.MPV2_DATA_DIRECTORY = data;
    const runtime = createRuntime(join(source, "missing-config.json"));

    const report = new LegacyMigrationService(runtime).migrate(source, true);

    expect(report.discovered).toEqual({
      accounts: 2,
      publishedItems: 2,
      affiliateProducts: 1,
    });
    expect(runtime.accounts.list()).toHaveLength(0);
    expect(runtime.content.list()).toHaveLength(0);
    expect(runtime.affiliate.list()).toHaveLength(0);
    runtime.close();
  });

  it("imports legacy state exactly once", () => {
    const { source, data } = fixture();
    process.env.MPV2_DATA_DIRECTORY = data;
    const runtime = createRuntime(join(source, "missing-config.json"));
    const service = new LegacyMigrationService(runtime);

    const first = service.migrate(source, false);
    const second = service.migrate(source, false);

    expect(first.imported).toEqual({
      accounts: 2,
      publishedItems: 2,
      affiliateProducts: 1,
    });
    expect(second.imported).toEqual({
      accounts: 0,
      publishedItems: 0,
      affiliateProducts: 0,
    });
    expect(runtime.accounts.list()).toHaveLength(2);
    expect(runtime.content.list()).toHaveLength(2);
    expect(runtime.affiliate.list()).toHaveLength(1);
    expect(runtime.affiliate.list()[0]?.accountId).toBe("twitter-one");
    runtime.close();
  });
});
