import { z } from "zod";

import type { Account, AccountConnection, Platform } from "../domain/model.js";
import type { AccountConnectionRepository } from "../infrastructure/database/account-connection-repository.js";
import type { AccountRepository } from "../infrastructure/database/repositories.js";
import type { AppConfig } from "../infrastructure/config/schema.js";
import type {
  CredentialVault,
  StoredCredential,
} from "../ports/authentication.js";
import { AppError } from "../shared/errors.js";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  token_type: z.string().min(1).optional(),
  expires_in: z.number().int().positive().optional(),
  scope: z.union([z.string(), z.array(z.string())]).optional(),
  open_id: z.string().min(1).optional(),
});

const blueskySessionSchema = z.object({
  accessJwt: z.string().min(1),
  refreshJwt: z.string().min(1),
  did: z.string().min(1),
  handle: z.string().min(1),
});

const jwtPayloadSchema = z.object({ exp: z.number().int().positive() });

const linkedInProfileSchema = z.object({
  sub: z.string().min(1),
  name: z.string().min(1).optional(),
});

const metaProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
});

const tikTokProfileSchema = z.object({
  data: z.object({
    user: z.object({
      open_id: z.string().min(1),
      display_name: z.string().min(1).optional(),
    }),
  }),
});

const youTubeProfileSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        snippet: z.object({ title: z.string().min(1) }).optional(),
      }),
    )
    .min(1),
});

interface OAuthSettings {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: readonly string[];
  clientIdParameter: "client_id" | "client_key";
  scopeSeparator: " " | ",";
}

export interface AuthorizationStart {
  accountId: string;
  platform: Platform;
  authorizationUrl: string;
  state: string;
}

export interface AuthenticationStatus {
  account: Account;
  connection: AccountConnection | null;
  credentialPresent: boolean;
}

export class AccountAuthenticationService {
  public constructor(
    private readonly accounts: AccountRepository,
    private readonly connections: AccountConnectionRepository,
    private readonly vault: CredentialVault,
    private readonly config: AppConfig,
  ) {}

  public async startOAuth(accountId: string): Promise<AuthorizationStart> {
    const account = this.requireAccount(accountId);
    const settings = this.oauthSettings(account.platform);
    const state = crypto.randomUUID();
    await this.vault.set(this.pendingKey(accountId), {
      authorizationState: state,
    });
    const url = new URL(settings.authorizationUrl);
    url.searchParams.set(settings.clientIdParameter, settings.clientId);
    url.searchParams.set("redirect_uri", settings.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set(
      "scope",
      settings.scopes.join(settings.scopeSeparator),
    );
    url.searchParams.set("state", state);
    if (account.platform === "youtube") {
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
    }
    return {
      accountId,
      platform: account.platform,
      authorizationUrl: url.href,
      state,
    };
  }

  public async completeOAuth(
    accountId: string,
    code: string,
    state: string,
  ): Promise<AccountConnection> {
    const account = this.requireAccount(accountId);
    const pending = await this.vault.get(this.pendingKey(accountId));
    if (pending?.authorizationState !== state) {
      throw new AppError(
        "OAuth state did not match the pending authorization",
        "OAUTH_STATE_INVALID",
      );
    }
    const settings = this.oauthSettings(account.platform);
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: settings.redirectUri,
      client_secret: settings.clientSecret,
    });
    body.set(settings.clientIdParameter, settings.clientId);
    const response = await fetch(settings.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      throw new AppError(
        `${account.platform} token exchange failed with HTTP ${response.status}`,
        "OAUTH_TOKEN_EXCHANGE_FAILED",
        response.status >= 500,
      );
    }
    const token = tokenResponseSchema.parse(await response.json());
    const expiresAt = this.expiresAt(token.expires_in);
    const scopes = this.scopes(token.scope, settings.scopes);
    const identity = await this.fetchIdentity(
      account.platform,
      token.access_token,
      token.open_id,
    );
    const credential: StoredCredential = {
      accessToken: token.access_token,
      ...(token.refresh_token === undefined
        ? {}
        : { refreshToken: token.refresh_token }),
      ...(token.token_type === undefined
        ? {}
        : { tokenType: token.token_type }),
      ...(expiresAt === null ? {} : { expiresAt }),
    };
    await this.vault.set(this.activeKey(accountId), credential);
    await this.vault.delete(this.pendingKey(accountId));
    return this.connections.save({
      accountId,
      platform: account.platform,
      state: "connected",
      externalAccountId: identity.id,
      displayName: identity.name,
      scopes,
      expiresAt,
      connectedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
    });
  }

  public async connectBluesky(
    accountId: string,
    identifier: string,
    appPassword: string,
  ): Promise<AccountConnection> {
    const account = this.requireAccount(accountId);
    if (account.platform !== "bluesky") {
      throw new AppError(
        "App-password authentication requires a Bluesky account",
        "ACCOUNT_PLATFORM_INVALID",
      );
    }
    const response = await fetch(
      new URL(
        "/xrpc/com.atproto.server.createSession",
        this.config.publishers.bluesky.serviceUrl,
      ),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password: appPassword }),
      },
    );
    if (!response.ok) {
      throw new AppError(
        `Bluesky authentication failed with HTTP ${response.status}`,
        "BLUESKY_AUTH_FAILED",
        response.status >= 500,
      );
    }
    const session = blueskySessionSchema.parse(await response.json());
    const expiresAt = this.jwtExpiresAt(session.accessJwt);
    await this.vault.set(this.activeKey(accountId), {
      accessToken: session.accessJwt,
      refreshToken: session.refreshJwt,
      identifier,
      appPassword,
      ...(expiresAt === null ? {} : { expiresAt }),
    });
    return this.connections.save({
      accountId,
      platform: "bluesky",
      state: "connected",
      externalAccountId: session.did,
      displayName: session.handle,
      scopes: ["atproto"],
      expiresAt,
      connectedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
    });
  }

  public connectTwitter(accountId: string): Promise<AccountConnection> {
    const account = this.requireAccount(accountId);
    if (account.platform !== "twitter" || account.browserProfilePath === null) {
      throw new AppError(
        "Twitter authentication requires a Twitter account with a browser profile",
        "TWITTER_PROFILE_MISSING",
      );
    }
    return Promise.resolve(
      this.connections.save({
        accountId,
        platform: "twitter",
        state: "connected",
        displayName: account.nickname,
        scopes: ["browser-session"],
        connectedAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
      }),
    );
  }

  public async importAccessToken(
    accountId: string,
    accessToken: string,
    externalAccountId?: string,
    displayName?: string,
  ): Promise<AccountConnection> {
    const account = this.requireAccount(accountId);
    if (accessToken.trim().length === 0) {
      throw new AppError("Access token is empty", "ACCESS_TOKEN_INVALID");
    }
    await this.vault.set(this.activeKey(accountId), { accessToken });
    return this.connections.save({
      accountId,
      platform: account.platform,
      state: "connected",
      externalAccountId: externalAccountId ?? null,
      displayName: displayName ?? account.nickname,
      connectedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
    });
  }

  public async status(accountId: string): Promise<AuthenticationStatus> {
    const account = this.requireAccount(accountId);
    const connection = this.connections.findByAccountId(accountId);
    const credentialPresent =
      account.platform === "twitter"
        ? account.browserProfilePath !== null
        : (await this.vault.get(this.activeKey(accountId))) !== null;
    return { account, connection, credentialPresent };
  }

  public async revoke(accountId: string): Promise<AccountConnection> {
    const account = this.requireAccount(accountId);
    await Promise.all([
      this.vault.delete(this.activeKey(accountId)),
      this.vault.delete(this.pendingKey(accountId)),
    ]);
    return this.connections.save({
      accountId,
      platform: account.platform,
      state: "revoked",
      scopes: [],
      expiresAt: null,
      connectedAt: null,
      lastCheckedAt: new Date().toISOString(),
    });
  }

  public async accessToken(accountId: string): Promise<string> {
    const account = this.requireAccount(accountId);
    let credential = await this.vault.get(this.activeKey(accountId));
    if (credential?.accessToken === undefined) {
      throw new AppError(
        `${account.platform} account is not connected`,
        "ACCOUNT_NOT_AUTHORIZED",
      );
    }
    if (
      credential.expiresAt !== undefined &&
      new Date(credential.expiresAt).getTime() <= Date.now() + 60_000
    ) {
      credential = await this.refresh(account, credential);
    }
    if (credential.accessToken === undefined) {
      throw new AppError("Access token is missing", "ACCESS_TOKEN_MISSING");
    }
    return credential.accessToken;
  }

  private async refresh(
    account: Account,
    credential: StoredCredential,
  ): Promise<StoredCredential> {
    if (credential.refreshToken === undefined) {
      this.connections.save({
        accountId: account.id,
        platform: account.platform,
        state: "expired",
        expiresAt: credential.expiresAt ?? null,
        lastCheckedAt: new Date().toISOString(),
        lastError: "No refresh token is available",
      });
      throw new AppError(
        `${account.platform} credentials expired; reconnect the account`,
        "ACCOUNT_CREDENTIAL_EXPIRED",
      );
    }
    if (account.platform === "bluesky") {
      return this.refreshBluesky(account, credential.refreshToken);
    }
    const settings = this.oauthSettings(account.platform);
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credential.refreshToken,
      client_secret: settings.clientSecret,
    });
    body.set(settings.clientIdParameter, settings.clientId);
    const response = await fetch(settings.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      throw new AppError(
        `${account.platform} token refresh failed with HTTP ${response.status}`,
        "OAUTH_TOKEN_REFRESH_FAILED",
        response.status >= 500,
      );
    }
    const token = tokenResponseSchema.parse(await response.json());
    const expiresAt = this.expiresAt(token.expires_in);
    const updated: StoredCredential = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? credential.refreshToken,
      ...(token.token_type === undefined
        ? {}
        : { tokenType: token.token_type }),
      ...(expiresAt === null ? {} : { expiresAt }),
    };
    await this.vault.set(this.activeKey(account.id), updated);
    this.connections.save({
      accountId: account.id,
      platform: account.platform,
      state: "connected",
      expiresAt,
      lastCheckedAt: new Date().toISOString(),
    });
    return updated;
  }

  private async refreshBluesky(
    account: Account,
    refreshToken: string,
  ): Promise<StoredCredential> {
    const response = await fetch(
      new URL(
        "/xrpc/com.atproto.server.refreshSession",
        this.config.publishers.bluesky.serviceUrl,
      ),
      { method: "POST", headers: { authorization: `Bearer ${refreshToken}` } },
    );
    if (!response.ok) {
      throw new AppError(
        `Bluesky token refresh failed with HTTP ${response.status}`,
        "BLUESKY_TOKEN_REFRESH_FAILED",
        response.status >= 500,
      );
    }
    const session = blueskySessionSchema.parse(await response.json());
    const expiresAt = this.jwtExpiresAt(session.accessJwt);
    const updated: StoredCredential = {
      accessToken: session.accessJwt,
      refreshToken: session.refreshJwt,
      ...(expiresAt === null ? {} : { expiresAt }),
    };
    await this.vault.set(this.activeKey(account.id), updated);
    this.connections.save({
      accountId: account.id,
      platform: "bluesky",
      state: "connected",
      externalAccountId: session.did,
      displayName: session.handle,
      expiresAt,
      lastCheckedAt: new Date().toISOString(),
    });
    return updated;
  }

  private async fetchIdentity(
    platform: Platform,
    accessToken: string,
    tokenOpenId?: string,
  ): Promise<{ id: string | null; name: string | null }> {
    const headers = { authorization: `Bearer ${accessToken}` };
    if (platform === "linkedin") {
      const response = await fetch(
        new URL("/v2/userinfo", this.config.publishers.linkedin.apiBaseUrl),
        { headers },
      );
      if (response.ok) {
        const profile = linkedInProfileSchema.parse(await response.json());
        return { id: profile.sub, name: profile.name ?? null };
      }
    }
    if (platform === "tiktok") {
      const response = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
        { headers },
      );
      if (response.ok) {
        const profile = tikTokProfileSchema.parse(await response.json());
        return {
          id: profile.data.user.open_id,
          name: profile.data.user.display_name ?? null,
        };
      }
      return { id: tokenOpenId ?? null, name: null };
    }
    if (platform === "instagram" || platform === "facebook") {
      const response = await fetch(
        "https://graph.facebook.com/me?fields=id,name",
        {
          headers,
        },
      );
      if (response.ok) {
        const profile = metaProfileSchema.parse(await response.json());
        return { id: profile.id, name: profile.name ?? null };
      }
    }
    if (platform === "youtube") {
      const response = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true",
        { headers },
      );
      if (response.ok) {
        const profile = youTubeProfileSchema.parse(await response.json());
        const channel = profile.items[0];
        return {
          id: channel?.id ?? null,
          name: channel?.snippet?.title ?? null,
        };
      }
    }
    return { id: null, name: null };
  }

  private oauthSettings(platform: Platform): OAuthSettings {
    if (platform === "youtube") {
      const config = this.config.publishers.youtube;
      return this.requireOAuthSettings(platform, {
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        clientId: process.env[config.clientIdEnv] ?? "",
        clientSecret: process.env[config.clientSecretEnv] ?? "",
        redirectUri: config.redirectUri,
        scopes: ["https://www.googleapis.com/auth/youtube.upload"],
        clientIdParameter: "client_id",
        scopeSeparator: " ",
      });
    }
    if (platform === "linkedin") {
      const config = this.config.publishers.linkedin;
      return this.requireOAuthSettings(platform, {
        authorizationUrl: config.authorizationUrl,
        tokenUrl: config.tokenUrl,
        clientId: process.env[config.clientIdEnv] ?? "",
        clientSecret: process.env[config.clientSecretEnv] ?? "",
        redirectUri: config.redirectUri,
        scopes: config.scopes,
        clientIdParameter: "client_id",
        scopeSeparator: " ",
      });
    }
    if (platform === "tiktok") {
      const config = this.config.publishers.tiktok;
      return this.requireOAuthSettings(platform, {
        authorizationUrl: config.authorizationUrl,
        tokenUrl: config.tokenUrl,
        clientId: process.env[config.clientIdEnv] ?? "",
        clientSecret: process.env[config.clientSecretEnv] ?? "",
        redirectUri: config.redirectUri,
        scopes: config.scopes,
        clientIdParameter: "client_key",
        scopeSeparator: ",",
      });
    }
    if (platform === "instagram" || platform === "facebook") {
      const config = this.config.publishers.meta;
      return this.requireOAuthSettings(platform, {
        authorizationUrl: config.authorizationUrl,
        tokenUrl: config.tokenUrl,
        clientId: process.env[config.clientIdEnv] ?? "",
        clientSecret: process.env[config.clientSecretEnv] ?? "",
        redirectUri: config.redirectUri,
        scopes: config.scopes,
        clientIdParameter: "client_id",
        scopeSeparator: ",",
      });
    }
    throw new AppError(
      `${platform} does not use an OAuth code flow`,
      "OAUTH_PLATFORM_UNSUPPORTED",
    );
  }

  private requireOAuthSettings(
    platform: Platform,
    settings: OAuthSettings,
  ): OAuthSettings {
    if (settings.clientId.length === 0 || settings.clientSecret.length === 0) {
      throw new AppError(
        `${platform} OAuth client credentials are not configured`,
        "OAUTH_CONFIG_MISSING",
      );
    }
    return settings;
  }

  private requireAccount(accountId: string): Account {
    const account = this.accounts.findById(accountId);
    if (account === null) {
      throw new AppError(
        `Account not found: ${accountId}`,
        "ACCOUNT_NOT_FOUND",
      );
    }
    return account;
  }

  private scopes(
    value: string | readonly string[] | undefined,
    fallback: readonly string[],
  ): readonly string[] {
    if (value !== undefined && typeof value !== "string") {
      return value;
    }
    if (typeof value === "string") {
      return value.split(/[ ,]+/u).filter((scope) => scope.length > 0);
    }
    return fallback;
  }

  private expiresAt(expiresIn: number | undefined): string | null {
    return expiresIn === undefined
      ? null
      : new Date(Date.now() + expiresIn * 1000).toISOString();
  }

  private jwtExpiresAt(token: string): string | null {
    const encodedPayload = token.split(".")[1];
    if (encodedPayload === undefined) {
      return null;
    }
    try {
      const payload = jwtPayloadSchema.parse(
        JSON.parse(
          Buffer.from(encodedPayload, "base64url").toString("utf8"),
        ) as unknown,
      );
      return new Date(payload.exp * 1000).toISOString();
    } catch {
      return null;
    }
  }

  private activeKey(accountId: string): string {
    return `account:${accountId}:active`;
  }

  private pendingKey(accountId: string): string {
    return `account:${accountId}:pending`;
  }
}
