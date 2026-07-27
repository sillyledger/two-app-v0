ALTER TABLE docs ADD COLUMN last_edited_by INTEGER REFERENCES users(id);
UPDATE docs SET last_edited_by = user_id WHERE last_edited_by IS NULL;
