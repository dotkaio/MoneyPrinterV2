import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { RunOutreachCampaign } from "../src/application/outreach-services.js";
import type { EmailSender } from "../src/ports/outreach.js";
import { createRuntime } from "../src/runtime.js";

const directories: string[] = [];

afterEach(() => {
  delete process.env.MPV2_DATA_DIRECTORY;
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("RunOutreachCampaign", () => {
  it("requires both approval and the global sending switch", async () => {
    const directory = join(tmpdir(), `mpv2-outreach-${crypto.randomUUID()}`);
    directories.push(directory);
    process.env.MPV2_DATA_DIRECTORY = directory;
    const runtime = createRuntime(join(directory, "missing-config.json"));
    const campaign = runtime.outreach.createCampaign({
      name: "Fixture",
      niche: "cafes",
      subject: "Hello {{businessName}}",
      bodyTemplate: "Visit {{websiteUrl}}",
      dailyLimit: 10,
      perDomainLimit: 1,
    });
    const sender: EmailSender = {
      send: () =>
        Promise.resolve({ messageId: "message", provider: "fixture" }),
    };

    await expect(
      new RunOutreachCampaign(runtime.outreach, sender, {
        sendingEnabled: false,
        sendDelayMs: 0,
      }).execute(campaign),
    ).rejects.toThrow(/disabled/u);
    await expect(
      new RunOutreachCampaign(runtime.outreach, sender, {
        sendingEnabled: true,
        sendDelayMs: 0,
      }).execute(campaign),
    ).rejects.toThrow(/approved/u);
    runtime.close();
  });

  it("deduplicates leads and enforces daily and per-domain limits", async () => {
    const directory = join(tmpdir(), `mpv2-outreach-${crypto.randomUUID()}`);
    directories.push(directory);
    process.env.MPV2_DATA_DIRECTORY = directory;
    const runtime = createRuntime(join(directory, "missing-config.json"));
    const draft = runtime.outreach.createCampaign({
      name: "Fixture",
      niche: "cafes",
      subject: "Hello {{businessName}}",
      bodyTemplate: "Visit {{websiteUrl}}",
      dailyLimit: 2,
      perDomainLimit: 1,
    });
    runtime.outreach.addLeads(draft.id, [
      {
        businessName: "One & Co",
        domain: "example.com",
        websiteUrl: "https://example.com/one",
        email: "one@example.com",
        source: "fixture",
      },
      {
        businessName: "Two",
        domain: "example.com",
        websiteUrl: "https://example.com/two",
        email: "two@example.com",
        source: "fixture",
      },
      {
        businessName: "Three",
        domain: "example.org",
        websiteUrl: "https://example.org",
        email: "three@example.org",
        source: "fixture",
      },
      {
        businessName: "Duplicate",
        domain: "example.org",
        websiteUrl: "https://example.org",
        email: "three@example.org",
        source: "fixture",
      },
    ]);
    const campaign = runtime.outreach.approveCampaign(draft.id);
    const send = vi.fn<EmailSender["send"]>().mockImplementation((message) =>
      Promise.resolve({
        messageId: `sent:${message.to}`,
        provider: "fixture",
      }),
    );

    const result = await new RunOutreachCampaign(
      runtime.outreach,
      { send },
      { sendingEnabled: true, sendDelayMs: 0 },
    ).execute(campaign);

    expect(result).toEqual({ sent: 2, failed: 0, skipped: 1 });
    expect(runtime.outreach.listLeads(campaign.id)).toHaveLength(3);
    expect(runtime.outreach.listAttempts(campaign.id)).toHaveLength(2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0].subject).toBe("Hello One &amp; Co");
    runtime.close();
  });
});
