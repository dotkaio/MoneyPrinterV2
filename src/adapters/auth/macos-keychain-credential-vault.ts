import { execa } from "execa";
import { z } from "zod";

import type {
  CredentialVault,
  StoredCredential,
} from "../../ports/authentication.js";
import { AppError } from "../../shared/errors.js";

const storedCredentialSchema = z.object({
  accessToken: z.string().min(1).optional(),
  refreshToken: z.string().min(1).optional(),
  tokenType: z.string().min(1).optional(),
  expiresAt: z.iso.datetime().optional(),
  identifier: z.string().min(1).optional(),
  appPassword: z.string().min(1).optional(),
  authorizationState: z.string().min(1).optional(),
});

export class MacOsKeychainCredentialVault implements CredentialVault {
  public constructor(private readonly service: string) {}

  public async get(key: string): Promise<StoredCredential | null> {
    this.assertMacOs();
    const result = await execa(
      "security",
      ["find-generic-password", "-a", key, "-s", this.service, "-w"],
      { reject: false },
    );
    if (result.exitCode === 44) {
      return null;
    }
    if (result.exitCode !== 0) {
      throw new AppError(
        "Could not read credentials from macOS Keychain",
        "KEYCHAIN_READ_FAILED",
        false,
      );
    }
    try {
      const parsed = storedCredentialSchema.parse(
        JSON.parse(result.stdout) as unknown,
      );
      return {
        ...(parsed.accessToken === undefined
          ? {}
          : { accessToken: parsed.accessToken }),
        ...(parsed.refreshToken === undefined
          ? {}
          : { refreshToken: parsed.refreshToken }),
        ...(parsed.tokenType === undefined
          ? {}
          : { tokenType: parsed.tokenType }),
        ...(parsed.expiresAt === undefined
          ? {}
          : { expiresAt: parsed.expiresAt }),
        ...(parsed.identifier === undefined
          ? {}
          : { identifier: parsed.identifier }),
        ...(parsed.appPassword === undefined
          ? {}
          : { appPassword: parsed.appPassword }),
        ...(parsed.authorizationState === undefined
          ? {}
          : { authorizationState: parsed.authorizationState }),
      };
    } catch (error) {
      throw new AppError(
        "Stored account credentials are invalid",
        "KEYCHAIN_CREDENTIAL_INVALID",
        false,
        { cause: error },
      );
    }
  }

  public async set(key: string, credential: StoredCredential): Promise<void> {
    this.assertMacOs();
    const serialized = JSON.stringify(storedCredentialSchema.parse(credential));
    const result = await execa(
      "security",
      ["add-generic-password", "-U", "-a", key, "-s", this.service, "-w"],
      {
        reject: false,
        input: `${serialized}\n${serialized}\n`,
      },
    );
    if (result.exitCode !== 0) {
      throw new AppError(
        "Could not save credentials to macOS Keychain",
        "KEYCHAIN_WRITE_FAILED",
        false,
      );
    }
  }

  public async delete(key: string): Promise<void> {
    this.assertMacOs();
    const result = await execa(
      "security",
      ["delete-generic-password", "-a", key, "-s", this.service],
      { reject: false },
    );
    if (result.exitCode !== 0 && result.exitCode !== 44) {
      throw new AppError(
        "Could not remove credentials from macOS Keychain",
        "KEYCHAIN_DELETE_FAILED",
        false,
      );
    }
  }

  private assertMacOs(): void {
    if (process.platform !== "darwin") {
      throw new AppError(
        "The built-in credential vault currently requires macOS Keychain",
        "KEYCHAIN_UNAVAILABLE",
      );
    }
  }
}
