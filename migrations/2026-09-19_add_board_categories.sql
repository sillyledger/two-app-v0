CREATE TABLE board_categories (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#888890',
  parent_id INTEGER REFERENCES board_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_board_categories_user_id ON board_categories(user_id);
CREATE INDEX idx_board_categories_parent_id ON board_categories(parent_id);

ALTER TABLE boards ADD COLUMN category_id INTEGER REFERENCES board_categories(id) ON DELETE SET NULL;
