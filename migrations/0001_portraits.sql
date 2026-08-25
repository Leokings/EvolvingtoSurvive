CREATE TABLE IF NOT EXISTS portrait_candidates (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  planet_id TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  species_owner TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_portrait_candidates_expiry
  ON portrait_candidates(status, expires_at);

CREATE TABLE IF NOT EXISTS generation_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  request_count INTEGER NOT NULL
);
