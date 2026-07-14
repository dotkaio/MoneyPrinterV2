export interface StoredCredential {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: string;
  identifier?: string;
  appPassword?: string;
  authorizationState?: string;
}

export interface CredentialVault {
  get(key: string): Promise<StoredCredential | null>;
  set(key: string, credential: StoredCredential): Promise<void>;
  delete(key: string): Promise<void>;
}
