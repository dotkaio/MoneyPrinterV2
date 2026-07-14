import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createDashboardOverview,
  startDashboard,
} from "../src/interface/dashboard-server.js";
import { createRuntime } from "../src/runtime.js";

const directories: string[] = [];

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
      activeJobs: 1,
      schedules: 1,
    });

    const dashboard = await startDashboard(runtime, { port: 0 });
    try {
      const overviewResponse = await fetch(`${dashboard.url}/api/overview`);
      const overviewText = await overviewResponse.text();
      const pageResponse = await fetch(dashboard.url);
      const page = await pageResponse.text();
      const missingResponse = await fetch(`${dashboard.url}/missing`);

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
      expect(missingResponse.status).toBe(404);
    } finally {
      await dashboard.close();
      runtime.close();
    }
  });
});
