-- Stored folder colours: add folders.color and fill it with the colour each
-- folder shows on the web today.
--   Top-level folders: ACCENT_COLORS[index % 9], index = position among the
--     workspace's top-level folders ordered by created_at (same list and order
--     as the sidebar).
--   Subfolders: ACCENT_COLORS[hash(id) % 9], same hash as folderColor() in
--     lib/folder-colors.ts (Move dialog).
-- Only folders.color is written. No other column, policy, trigger or index changes.

BEGIN;

-- Safety check: stop (and change nothing) if folders has any trigger of its
-- own, since one could touch updated_at during the backfill.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'folders'::regclass AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'folders has a trigger - nothing was changed';
  END IF;
END $$;

ALTER TABLE folders ADD COLUMN color text;

WITH RECURSIVE
top_level AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(workspace_id::text, 'user:' || user_id::text)
      ORDER BY created_at ASC, id ASC
    ) - 1 AS idx
  FROM folders
  WHERE parent_id IS NULL
),
hash_steps AS (
  SELECT id, id::text AS s, 0 AS pos, 0::bigint AS h
  FROM folders
  WHERE parent_id IS NOT NULL
  UNION ALL
  SELECT id, s, pos + 1, (h * 31 + ascii(substr(s, pos + 1, 1))) % 4294967296
  FROM hash_steps
  WHERE pos < length(s)
),
new_colors AS (
  SELECT id, idx AS n FROM top_level
  UNION ALL
  SELECT id, h AS n FROM hash_steps WHERE pos = length(s)
)
UPDATE folders f
SET color = (ARRAY['#EF9F27','#85B7EB','#5DCAA5','#F0997B','#AFA9EC','#97C459','#ED93B1','#B4B2A9','#5DCAA5'])[(nc.n % 9)::int + 1]
FROM new_colors nc
WHERE f.id = nc.id;

COMMIT;

-- UNDO: ALTER TABLE folders DROP COLUMN color;
