import { MacOsKeychainCredentialVault } from "../adapters/auth/macos-keychain-credential-vault.js";
import type { Runtime } from "../runtime.js";
import { AccountAuthenticationService } from "./account-authentication-service.js";

export function createAccountAuthenticationService(
  runtime: Runtime,
): AccountAuthenticationService {
  return new AccountAuthenticationService(
    runtime.accounts,
    runtime.connections,
    new MacOsKeychainCredentialVault(
      runtime.loadedConfig.config.authentication.keychainService,
    ),
    runtime.loadedConfig.config,
  );
}
