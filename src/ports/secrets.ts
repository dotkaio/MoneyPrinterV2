export interface SecretVault {
  get(key: string): Promise<string | null>;
  set(key: string, secret: string): Promise<void>;
  delete(key: string): Promise<void>;
}
