UPDATE workspaces
SET is_shared = true
WHERE id IN (SELECT DISTINCT workspace_id FROM workspace_members)
  AND is_shared IS DISTINCT FROM true;
