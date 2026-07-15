import { execa } from "execa";

import type { SecretVault } from "../../ports/secrets.js";
import { AppError } from "../../shared/errors.js";

export class MacOsKeychainSecretVault implements SecretVault {
  public constructor(private readonly service: string) {}

  public async get(key: string): Promise<string | null> {
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
        "Could not read the provider key from macOS Keychain",
        "PROVIDER_KEYCHAIN_READ_FAILED",
      );
    }
    return result.stdout;
  }

  public async set(key: string, secret: string): Promise<void> {
    this.assertMacOs();
    if (secret.length === 0 || /[\r\n]/u.test(secret)) {
      throw new AppError("Provider key is invalid", "PROVIDER_KEY_INVALID");
    }
    const result = await execa(
      "security",
      ["add-generic-password", "-U", "-a", key, "-s", this.service, "-w"],
      {
        reject: false,
        input: `${secret}\n${secret}\n`,
      },
    );
    if (result.exitCode !== 0) {
      throw new AppError(
        "Could not save the provider key to macOS Keychain",
        "PROVIDER_KEYCHAIN_WRITE_FAILED",
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
        "Could not remove the provider key from macOS Keychain",
        "PROVIDER_KEYCHAIN_DELETE_FAILED",
      );
    }
  }

  private assertMacOs(): void {
    if (process.platform !== "darwin") {
      throw new AppError(
        "The built-in provider vault currently requires macOS Keychain",
        "PROVIDER_KEYCHAIN_UNAVAILABLE",
      );
    }
  }
}
