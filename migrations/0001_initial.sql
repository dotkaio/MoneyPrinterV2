CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'twitter')),
  nickname TEXT NOT NULL,
  niche TEXT NOT NULL,
  language TEXT NOT NULL,
  browser_profile_path TEXT,
  configuration TEXT NOT NULL DEFAULT '{}',
  legacy_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS accounts_platform_idx ON accounts(platform);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_legacy_id_uq ON accounts(platform, legacy_id);

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  state TEXT NOT NULL,
  topic TEXT,
  script TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS content_items_account_idx ON content_items(account_id);
CREATE INDEX IF NOT EXISTS content_items_state_idx ON content_items(state);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  provider TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS artifacts_content_idx ON artifacts(content_item_id);

CREATE TABLE IF NOT EXISTS published_items (
  id TEXT PRIMARY KEY,
  content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_item_id TEXT NOT NULL,
  public_url TEXT,
  privacy_status TEXT,
  published_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS published_content_account_uq ON published_items(content_item_id, account_id);

CREATE TABLE IF NOT EXISTS affiliate_products (
  id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,
  title TEXT,
  features TEXT NOT NULL DEFAULT '[]',
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  legacy_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  niche TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_template TEXT NOT NULL,
  state TEXT NOT NULL,
  approved_at TEXT,
  daily_limit INTEGER NOT NULL,
  per_domain_limit INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_leads (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  website_url TEXT NOT NULL,
  email TEXT NOT NULL,
  source TEXT NOT NULL,
  suppressed_at TEXT,
  suppression_reason TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS outreach_lead_campaign_email_uq ON outreach_leads(campaign_id, email);

CREATE TABLE IF NOT EXISTS outreach_attempts (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL REFERENCES outreach_leads(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  message_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS outreach_attempt_campaign_lead_uq ON outreach_attempts(campaign_id, lead_id);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  job_type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  cron_expression TEXT NOT NULL,
  timezone TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  next_run_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  state TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL UNIQUE,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  maximum_attempts INTEGER NOT NULL,
  run_at TEXT NOT NULL,
  lease_owner TEXT,
  lease_expires_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_claim_idx ON jobs(state, run_at);

CREATE TABLE IF NOT EXISTS job_attempts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  worker_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  state TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
