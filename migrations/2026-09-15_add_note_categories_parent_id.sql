ALTER TABLE note_categories ADD COLUMN parent_id INTEGER REFERENCES note_categories(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_note_categories_parent_id ON note_categories(parent_id);
