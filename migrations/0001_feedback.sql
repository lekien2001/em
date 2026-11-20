CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  category TEXT NOT NULL CHECK (category IN ('general', 'bug', 'idea')),
  message TEXT NOT NULL,
  email TEXT
);

CREATE INDEX IF NOT EXISTS feedback_created_at ON feedback (created_at DESC);
