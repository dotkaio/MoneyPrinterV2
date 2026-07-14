import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { OAuth2Client, type Credentials } from "google-auth-library";
import { z } from "zod";

import { AppError } from "../../shared/errors.js";

const credentialsSchema = z.object({
  refresh_token: z.string().nullable().optional(),
  expiry_date: z.number().nullable().optional(),
  access_token: z.string().nullable().optional(),
  token_type: z.string().nullable().optional(),
  id_token: z.string().nullable().optional(),
  scope: z.string().optional(),
});

export interface YouTubeOAuthManagerOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  dataDirectory: string;
}

export interface YouTubeAccessTokenProvider {
  accessToken(accountId: string): Promise<string>;
}

export class YouTubeOAuthManager implements YouTubeAccessTokenProvider {
  public constructor(private readonly options: YouTubeOAuthManagerOptions) {}

  public authorizationUrl(accountId: string): string {
    return this.client().generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/youtube.upload"],
      state: accountId,
    });
  }

  public async exchangeCode(accountId: string, code: string): Promise<void> {
    const client = this.client();
    const response = await client.getToken(code);
    client.setCredentials(response.tokens);
    await this.saveCredentials(accountId, client.credentials);
  }

  public async accessToken(accountId: string): Promise<string> {
    const client = this.client();
    client.setCredentials(await this.loadCredentials(accountId));
    const response = await client.getAccessToken();
    const token = response.token;
    if (token === null || token === undefined || token.length === 0) {
      throw new AppError(
        "Google OAuth did not return an access token",
        "YOUTUBE_TOKEN_MISSING",
      );
    }
    await this.saveCredentials(accountId, client.credentials);
    return token;
  }

  private client(): OAuth2Client {
    if (
      this.options.clientId.length === 0 ||
      this.options.clientSecret.length === 0
    ) {
      throw new AppError(
        "YouTube OAuth client ID and secret are not configured",
        "YOUTUBE_OAUTH_CONFIG_MISSING",
      );
    }
    return new OAuth2Client({
      clientId: this.options.clientId,
      clientSecret: this.options.clientSecret,
      redirectUri: this.options.redirectUri,
    });
  }

  private tokenPath(accountId: string): string {
    const safeAccountId = accountId.replaceAll(/[^a-zA-Z0-9_-]/gu, "_");
    return resolve(
      this.options.dataDirectory,
      "oauth",
      `youtube-${safeAccountId}.json`,
    );
  }

  private async loadCredentials(accountId: string): Promise<Credentials> {
    const path = this.tokenPath(accountId);
    try {
      const parsed = credentialsSchema.parse(
        JSON.parse(await readFile(path, "utf8")) as unknown,
      );
      return {
        ...(parsed.refresh_token === undefined
          ? {}
          : { refresh_token: parsed.refresh_token }),
        ...(parsed.expiry_date === undefined
          ? {}
          : { expiry_date: parsed.expiry_date }),
        ...(parsed.access_token === undefined
          ? {}
          : { access_token: parsed.access_token }),
        ...(parsed.token_type === undefined
          ? {}
          : { token_type: parsed.token_type }),
        ...(parsed.id_token === undefined ? {} : { id_token: parsed.id_token }),
        ...(parsed.scope === undefined ? {} : { scope: parsed.scope }),
      };
    } catch (error) {
      throw new AppError(
        `YouTube account is not authorized. Token file could not be read: ${path}`,
        "YOUTUBE_NOT_AUTHORIZED",
        false,
        { cause: error },
      );
    }
  }

  private async saveCredentials(
    accountId: string,
    credentials: Credentials,
  ): Promise<void> {
    const path = this.tokenPath(accountId);
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, `${JSON.stringify(credentials, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
}
