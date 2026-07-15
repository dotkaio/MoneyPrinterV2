import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ProviderTextGeneratorFactory } from "../src/application/create-provider-text-generator.js";
import {
  createDashboardOverview,
  startDashboard,
} from "../src/interface/dashboard-server.js";
import type { SecretVault } from "../src/ports/secrets.js";
import { createRuntime } from "../src/runtime.js";

const directories: string[] = [];

class MemorySecretVault implements SecretVault {
  public readonly values = new Map<string, string>();

  public get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  public set(key: string, secret: string): Promise<void> {
    this.values.set(key, secret);
    return Promise.resolve();
  }

  public delete(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }
}

const fakeProviderFactory: ProviderTextGeneratorFactory = (options) => ({
  healthCheck: () => Promise.resolve(`${options.kind} ready`),
  generate: () =>
    Promise.resolve({
      text: JSON.stringify({
        title: "A useful title",
        hook: "Start with the surprising part.",
        script: "A polished script with useful structure.",
        caption: "A ready-to-publish caption.",
        hashtags: ["useful", "fixture"],
      }),
      provider: options.kind,
      model: options.model,
      promptTokens: 42,
      completionTokens: 84,
      durationMs: 12,
    }),
});

afterEach(() => {
  delete process.env.MPV2_DATA_DIRECTORY;
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("local interface server", () => {
  it("serves a credential-safe overview and dashboard page", async () => {
    const directory = join(tmpdir(), `mpv2-interface-${crypto.randomUUID()}`);
    directories.push(directory);
    process.env.MPV2_DATA_DIRECTORY = directory;
    const runtime = createRuntime(join(directory, "missing-config.json"));
    const account = runtime.accounts.create({
      platform: "bluesky",
      nickname: "Fixture Channel",
      niche: "engineering",
      language: "English",
      configuration: { token: "must-not-leak" },
    });
    runtime.connections.save({
      accountId: account.id,
      platform: account.platform,
      state: "connected",
      externalAccountId: "did:plc:fixture",
      displayName: "fixture.bsky.social",
      connectedAt: new Date().toISOString(),
    });
    runtime.jobs.enqueue({
      type: "fixture.generate",
      payload: { privatePrompt: "must-not-leak" },
      idempotencyKey: "fixture-interface-job",
      maximumAttempts: 3,
    });
    runtime.schedules.create({
      name: "Daily fixture",
      jobType: "fixture.generate",
      payload: { privatePrompt: "must-not-leak" },
      cronExpression: "0 9 * * *",
      timezone: "UTC",
      nextRunAt: new Date(Date.now() + 86_400_000).toISOString(),
    });

    const overview = createDashboardOverview(runtime);
    expect(overview.counts).toMatchObject({
      accounts: 1,
      connectedAccounts: 1,
      creations: 0,
      activeJobs: 1,
      schedules: 1,
    });

    const assetDirectory = join(directory, "interface-web");
    mkdirSync(join(assetDirectory, "assets"), { recursive: true });
    writeFileSync(
      join(assetDirectory, "index.html"),
      "<!doctype html><title>MoneyPrinter — Local control center</title><main>Your content operation, in one place.</main>",
    );
    writeFileSync(join(assetDirectory, "assets", "app.js"), "export {};");

    const secretVault = new MemorySecretVault();
    const dashboard = await startDashboard(runtime, {
      port: 0,
      assetDirectory,
      secretVault,
      providerTextGeneratorFactory: fakeProviderFactory,
    });
    try {
      const overviewResponse = await fetch(`${dashboard.url}/api/overview`);
      const overviewText = await overviewResponse.text();
      const pageResponse = await fetch(dashboard.url);
      const page = await pageResponse.text();
      const accountsResponse = await fetch(`${dashboard.url}/accounts`);
      const assetResponse = await fetch(`${dashboard.url}/assets/app.js`);
      const missingApiResponse = await fetch(`${dashboard.url}/api/missing`);
      const providerResponse = await fetch(`${dashboard.url}/api/providers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "openai",
          apiKey: "fixture-api-key",
          model: "gpt-5.6-luna",
        }),
      });
      const providerText = await providerResponse.text();
      const creationResponse = await fetch(`${dashboard.url}/api/creations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          format: "short-video",
          topic: "Why local-first software matters",
          audience: "Software teams",
          tone: "Direct",
          language: "English",
        }),
      });
      const creation = (await creationResponse.json()) as { title: string };
      const creationsResponse = await fetch(`${dashboard.url}/api/creations`);
      const blockedOriginResponse = await fetch(
        `${dashboard.url}/api/providers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://malicious.example",
          },
          body: JSON.stringify({
            kind: "gemini",
            apiKey: "another-fixture-key",
          }),
        },
      );

      expect(overviewResponse.status).toBe(200);
      expect(overviewResponse.headers.get("cache-control")).toBe("no-store");
      expect(overviewText).toContain("fixture.bsky.social");
      expect(overviewText).not.toContain("must-not-leak");
      expect(pageResponse.status).toBe(200);
      expect(pageResponse.headers.get("content-security-policy")).toContain(
        "frame-ancestors 'none'",
      );
      expect(page).toContain("Local control center");
      expect(page).toContain("Your content operation, in one place.");
      expect(accountsResponse.status).toBe(200);
      expect(await accountsResponse.text()).toBe(page);
      expect(assetResponse.headers.get("content-type")).toContain(
        "text/javascript",
      );
      expect(assetResponse.headers.get("cache-control")).toContain("immutable");
      expect(missingApiResponse.status).toBe(404);
      expect(providerResponse.status).toBe(200);
      expect(providerText).toContain("OpenAI");
      expect(providerText).not.toContain("fixture-api-key");
      expect(secretVault.values.get("ai-provider:openai")).toBe(
        "fixture-api-key",
      );
      expect(creationResponse.status).toBe(201);
      expect(creation.title).toBe("A useful title");
      expect(await creationsResponse.json()).toHaveLength(1);
      expect(blockedOriginResponse.status).toBe(403);
      expect(
        JSON.stringify(
          runtime.database.sqlite
            .prepare("SELECT * FROM ai_provider_profiles")
            .all(),
        ),
      ).not.toContain("fixture-api-key");
    } finally {
      await dashboard.close();
      runtime.close();
    }
  });
});
