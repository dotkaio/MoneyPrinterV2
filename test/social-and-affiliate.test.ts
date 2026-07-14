import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { GenerateTwitterPost } from "../src/application/generate-twitter-post.js";
import { PublishSocialContent } from "../src/application/publish-social-content.js";
import { RunAffiliateCampaign } from "../src/application/run-affiliate-campaign.js";
import type { TextGenerator } from "../src/ports/generation.js";
import type { ProductSource } from "../src/ports/outreach.js";
import type { SocialPublisher } from "../src/ports/publishing.js";
import { createRuntime } from "../src/runtime.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
  delete process.env.MPV2_DATA_DIRECTORY;
});

function textGenerator(text: string): TextGenerator {
  return {
    generate: () =>
      Promise.resolve({
        text,
        provider: "fixture",
        model: "fixture",
        promptTokens: null,
        completionTokens: null,
        durationMs: 1,
      }),
    healthCheck: () => Promise.resolve("ok"),
  };
}

function setup() {
  const directory = join(tmpdir(), `mpv2-social-${crypto.randomUUID()}`);
  directories.push(directory);
  process.env.MPV2_DATA_DIRECTORY = directory;
  const runtime = createRuntime(join(directory, "missing-config.json"));
  const account = runtime.accounts.create({
    platform: "twitter",
    nickname: "Fixture",
    niche: "engineering",
    language: "English",
    browserProfilePath: "/fixture/profile",
  });
  return { runtime, account };
}

describe("social and affiliate workflows", () => {
  it("generates a bounded Twitter post and publishes it idempotently", async () => {
    const { runtime, account } = setup();
    const content = await new GenerateTwitterPost(
      runtime.content,
      textGenerator(`"${"word ".repeat(80)}"`),
    ).execute(account, "testing");
    const publish = vi.fn<SocialPublisher["publish"]>().mockResolvedValue({
      platformItemId: "tweet-one",
      publicUrl: "https://x.com/fixture/status/tweet-one",
      provider: "fixture",
    });
    const useCase = new PublishSocialContent(
      runtime.content,
      runtime.publishing,
      { publish },
    );

    const first = await useCase.execute(account, content);
    const second = await useCase.execute(account, content);

    expect(content.script?.length).toBeLessThanOrEqual(280);
    expect(first.id).toBe(second.id);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(runtime.content.findById(content.id)?.state).toBe("published");
    runtime.close();
  });

  it("extracts product details and creates link-safe affiliate copy", async () => {
    const { runtime, account } = setup();
    const product = runtime.affiliate.create(
      "https://amazon.example/item",
      "https://example.com/affiliate",
      account.id,
    );
    const productSource: ProductSource = {
      fetchProduct: () =>
        Promise.resolve({
          sourceUrl: product.sourceUrl,
          canonicalUrl: "https://amazon.example/item",
          title: "Useful Widget",
          features: ["Durable", "Repairable"],
          price: "$20",
        }),
    };

    const result = await new RunAffiliateCampaign(
      runtime.affiliate,
      runtime.content,
      productSource,
      textGenerator("A practical widget for a careful workshop."),
    ).execute(product, account);

    expect(result.product.title).toBe("Useful Widget");
    expect(result.content.state).toBe("ready");
    expect(result.content.script).toContain(product.affiliateUrl);
    expect(result.content.script?.length).toBeLessThanOrEqual(280);
    runtime.close();
  });
});
