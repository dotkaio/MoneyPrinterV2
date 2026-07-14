import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { BlueskySocialPublisher } from "../src/adapters/bluesky/bluesky-social-publisher.js";
import { LinkedInSocialPublisher } from "../src/adapters/linkedin/linkedin-social-publisher.js";
import { AccountAuthenticationService } from "../src/application/account-authentication-service.js";
import type { Platform } from "../src/domain/model.js";
import type {
  CredentialVault,
  StoredCredential,
} from "../src/ports/authentication.js";
import { createRuntime } from "../src/runtime.js";

const directories: string[] = [];

class MemoryCredentialVault implements CredentialVault {
  public readonly values = new Map<string, StoredCredential>();

  public get(key: string): Promise<StoredCredential | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  public set(key: string, credential: StoredCredential): Promise<void> {
    this.values.set(key, credential);
    return Promise.resolve();
  }

  public delete(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MPV2_DATA_DIRECTORY;
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function setup(
  platform: Platform,
  externalAccountId: string,
  displayName: string,
) {
  const directory = join(tmpdir(), `mpv2-publisher-${crypto.randomUUID()}`);
  directories.push(directory);
  process.env.MPV2_DATA_DIRECTORY = directory;
  const runtime = createRuntime(join(directory, "missing-config.json"));
  const account = runtime.accounts.create({
    platform,
    nickname: "Fixture",
    niche: "engineering",
    language: "English",
  });
  runtime.connections.save({
    accountId: account.id,
    platform,
    state: "connected",
    externalAccountId,
    displayName,
    connectedAt: new Date().toISOString(),
  });
  const vault = new MemoryCredentialVault();
  vault.values.set(`account:${account.id}:active`, {
    accessToken: "access-secret",
  });
  const authentication = new AccountAuthenticationService(
    runtime.accounts,
    runtime.connections,
    vault,
    runtime.loadedConfig.config,
  );
  return { runtime, account, authentication };
}

describe("new social publishers", () => {
  it("creates an AT Protocol Bluesky post", async () => {
    const { runtime, account, authentication } = setup(
      "bluesky",
      "did:plc:fixture",
      "fixture.bsky.social",
    );
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        uri: "at://did:plc:fixture/app.bsky.feed.post/post-123",
        cid: "cid-123",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const publisher = new BlueskySocialPublisher(
      authentication,
      runtime.connections,
      { serviceUrl: "https://bsky.test", livePublishing: true },
    );

    const published = await publisher.publish({
      accountId: account.id,
      text: "Hello Bluesky",
      idempotencyKey: "bluesky:fixture",
    });

    expect(published.publicUrl).toBe(
      "https://bsky.app/profile/fixture.bsky.social/post/post-123",
    );
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request?.headers).toMatchObject({
      authorization: "Bearer access-secret",
    });
    expect(request?.body).toContain('"repo":"did:plc:fixture"');
    runtime.close();
  });

  it("creates a LinkedIn member post through the REST API", async () => {
    const { runtime, account, authentication } = setup(
      "linkedin",
      "member-123",
      "Fixture Member",
    );
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 201,
        headers: { "x-restli-id": "urn:li:share:123" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const publisher = new LinkedInSocialPublisher(
      authentication,
      runtime.connections,
      {
        apiBaseUrl: "https://linkedin.test",
        apiVersion: "202605",
        livePublishing: true,
      },
    );

    const published = await publisher.publish({
      accountId: account.id,
      text: "Hello LinkedIn",
      idempotencyKey: "linkedin:fixture",
    });

    expect(published.platformItemId).toBe("urn:li:share:123");
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request?.body).toContain('"author":"urn:li:person:member-123"');
    expect(request?.headers).toMatchObject({
      authorization: "Bearer access-secret",
      "LinkedIn-Version": "202605",
    });
    runtime.close();
  });
});
