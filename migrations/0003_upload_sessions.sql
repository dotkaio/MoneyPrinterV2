CREATE TABLE IF NOT EXISTS upload_sessions (
  idempotency_key TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  session_uri TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_bytes INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL,
  platform_item_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
