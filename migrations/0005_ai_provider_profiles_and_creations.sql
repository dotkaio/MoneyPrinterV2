CREATE TABLE ai_provider_profiles (
  kind TEXT PRIMARY KEY CHECK (kind IN ('openai', 'anthropic', 'gemini', 'openrouter')),
  model TEXT NOT NULL,
  base_url TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX ai_provider_active_uq
ON ai_provider_profiles(active)
WHERE active = 1;

CREATE TABLE creations (
  id TEXT PRIMARY KEY,
  format TEXT NOT NULL CHECK (format IN ('short-video', 'social-post', 'newsletter', 'ad-copy')),
  topic TEXT NOT NULL,
  audience TEXT NOT NULL,
  tone TEXT NOT NULL,
  language TEXT NOT NULL,
  title TEXT NOT NULL,
  hook TEXT NOT NULL,
  script TEXT NOT NULL,
  caption TEXT NOT NULL,
  hashtags TEXT NOT NULL DEFAULT '[]',
  provider_kind TEXT NOT NULL CHECK (provider_kind IN ('openai', 'anthropic', 'gemini', 'openrouter')),
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  duration_ms REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX creations_created_at_idx ON creations(created_at);
