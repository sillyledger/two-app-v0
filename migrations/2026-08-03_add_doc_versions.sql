CREATE TABLE doc_versions (
  id SERIAL PRIMARY KEY,
  doc_id INTEGER NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  edited_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_doc_versions_doc_id ON doc_versions(doc_id, created_at DESC);
