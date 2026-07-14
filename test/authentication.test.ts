import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountAuthenticationService } from "../src/application/account-authentication-service.js";
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
  delete process.env.LINKEDIN_CLIENT_ID;
  delete process.env.LINKEDIN_CLIENT_SECRET;
  delete process.env.MPV2_DATA_DIRECTORY;
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function setup(platform: "bluesky" | "linkedin") {
  const directory = join(tmpdir(), `mpv2-auth-${crypto.randomUUID()}`);
  directories.push(directory);
  process.env.MPV2_DATA_DIRECTORY = directory;
  const runtime = createRuntime(join(directory, "missing-config.json"));
  const account = runtime.accounts.create({
    platform,
    nickname: "Fixture",
    niche: "engineering",
    language: "English",
  });
  const vault = new MemoryCredentialVault();
  const authentication = new AccountAuthenticationService(
    runtime.accounts,
    runtime.connections,
    vault,
    runtime.loadedConfig.config,
  );
  return { runtime, account, vault, authentication };
}

describe("account authentication", () => {
  it("connects Bluesky while keeping secrets outside SQLite", async () => {
    const { runtime, account, vault, authentication } = setup("bluesky");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          accessJwt: "access-secret",
          refreshJwt: "refresh-secret",
          did: "did:plc:fixture",
          handle: "fixture.bsky.social",
        }),
      ),
    );

    const connection = await authentication.connectBluesky(
      account.id,
      "fixture.bsky.social",
      "app-password-secret",
    );

    expect(connection.externalAccountId).toBe("did:plc:fixture");
    expect(vault.values.get(`account:${account.id}:active`)).toMatchObject({
      accessToken: "access-secret",
      appPassword: "app-password-secret",
    });
    const databaseRows = runtime.database.sqlite
      .prepare("SELECT * FROM account_connections")
      .all();
    expect(JSON.stringify(databaseRows)).not.toContain("secret");
    runtime.close();
  });

  it("validates OAuth state and stores LinkedIn identity metadata", async () => {
    process.env.LINKEDIN_CLIENT_ID = "client-id";
    process.env.LINKEDIN_CLIENT_SECRET = "client-secret";
    const { runtime, account, vault, authentication } = setup("linkedin");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          access_token: "access-secret",
          refresh_token: "refresh-secret",
          expires_in: 3600,
          scope: "openid profile w_member_social",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ sub: "member-123", name: "Fixture Member" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const start = await authentication.startOAuth(account.id);
    await expect(
      authentication.completeOAuth(account.id, "code", "wrong-state"),
    ).rejects.toThrow(/state did not match/u);
    const connection = await authentication.completeOAuth(
      account.id,
      "code",
      start.state,
    );

    expect(new URL(start.authorizationUrl).searchParams.get("state")).toBe(
      start.state,
    );
    expect(connection).toMatchObject({
      state: "connected",
      externalAccountId: "member-123",
      displayName: "Fixture Member",
    });
    expect(await authentication.status(account.id)).toMatchObject({
      credentialPresent: true,
    });
    expect(vault.values.has(`account:${account.id}:pending`)).toBe(false);
    runtime.close();
  });

  it("revokes reusable credentials without deleting the account", async () => {
    const { runtime, account, authentication } = setup("bluesky");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          accessJwt: "access-secret",
          refreshJwt: "refresh-secret",
          did: "did:plc:fixture",
          handle: "fixture.bsky.social",
        }),
      ),
    );
    await authentication.connectBluesky(
      account.id,
      "fixture.bsky.social",
      "app-password-secret",
    );

    const revoked = await authentication.revoke(account.id);

    expect(revoked.state).toBe("revoked");
    expect(runtime.accounts.findById(account.id)).not.toBeNull();
    expect((await authentication.status(account.id)).credentialPresent).toBe(
      false,
    );
    runtime.close();
  });
});
