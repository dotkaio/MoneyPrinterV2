-- migrate-with-foreign-keys-off
CREATE TABLE accounts_new (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'twitter', 'bluesky', 'linkedin', 'tiktok', 'instagram', 'facebook')),
  nickname TEXT NOT NULL,
  niche TEXT NOT NULL,
  language TEXT NOT NULL,
  browser_profile_path TEXT,
  configuration TEXT NOT NULL DEFAULT '{}',
  legacy_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO accounts_new (
  id, platform, nickname, niche, language, browser_profile_path,
  configuration, legacy_id, created_at, updated_at
)
SELECT
  id, platform, nickname, niche, language, browser_profile_path,
  configuration, legacy_id, created_at, updated_at
FROM accounts;

DROP TABLE accounts;
ALTER TABLE accounts_new RENAME TO accounts;
CREATE INDEX accounts_platform_idx ON accounts(platform);
CREATE UNIQUE INDEX accounts_legacy_id_uq ON accounts(platform, legacy_id);

CREATE TABLE account_connections (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('connected', 'expired', 'revoked', 'error')),
  external_account_id TEXT,
  display_name TEXT,
  scopes TEXT NOT NULL DEFAULT '[]',
  expires_at TEXT,
  connected_at TEXT,
  last_checked_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX account_connections_state_idx ON account_connections(state);
