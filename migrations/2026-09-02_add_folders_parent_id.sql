ALTER TABLE folders ADD COLUMN parent_id UUID REFERENCES folders(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
