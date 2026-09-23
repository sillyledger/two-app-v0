ALTER TABLE board_items ADD COLUMN width INTEGER, ADD COLUMN height INTEGER, ADD COLUMN shape TEXT;
ALTER TABLE board_items DROP CONSTRAINT board_items_type_check;
ALTER TABLE board_items ADD CONSTRAINT board_items_type_check CHECK (type IN ('doc', 'note', 'image', 'swatch', 'text', 'shape'));
