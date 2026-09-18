CREATE TABLE content_ideas (
  id SERIAL PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  platform TEXT,
  category TEXT,
  doc_uuid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_ideas_user_id ON content_ideas(user_id);
