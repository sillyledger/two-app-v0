import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);

export async function getOrCreateWorkspace(userId: string, name = "My Workspace") {
  const existing = await sql`
    SELECT * FROM workspaces WHERE user_id = ${userId} ORDER BY created_at ASC LIMIT 1
  `;
  if (existing[0]) return existing[0];
  const rows = await sql`
    INSERT INTO workspaces (user_id, name)
    VALUES (${userId}, ${name})
    RETURNING *
  `;
  return rows[0];
}

export async function getWorkspace(userId: string) {
  const rows = await sql`
    SELECT * FROM workspaces WHERE user_id = ${userId} ORDER BY created_at ASC LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getAllWorkspaces(userId: string) {
  const rows = await sql`
    SELECT * FROM workspaces WHERE user_id = ${userId} ORDER BY created_at ASC
  `;
  return rows;
}

export async function createWorkspace(userId: string, name: string) {
  const rows = await sql`
    INSERT INTO workspaces (user_id, name)
    VALUES (${userId}, ${name})
    RETURNING *
  `;
  return rows[0];
}

export async function updateWorkspaceName(userId: string, name: string) {
  const rows = await sql`
    UPDATE workspaces SET name = ${name}, updated_at = now()
    WHERE user_id = ${userId}
    RETURNING *
  `;
  return rows[0];
}

export async function renameWorkspaceById(userId: string, workspaceId: string, name: string) {
  const rows = await sql`
    UPDATE workspaces SET name = ${name}, updated_at = now()
    WHERE id::text = ${workspaceId} AND user_id = ${userId}
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function deleteWorkspaceById(userId: string, workspaceId: string) {
  await sql`
    DELETE FROM workspaces
    WHERE id::text = ${workspaceId} AND user_id = ${userId}
  `;
}

// ── Shared workspace functions ──────────────────────────────────────────────

export async function createSharedWorkspace(userId: string, name: string) {
  const rows = await sql`
    INSERT INTO workspaces (user_id, name, is_shared)
    VALUES (${userId}, ${name}, true)
    RETURNING *
  `;
  return rows[0];
}

export async function getSharedWorkspacesForUser(userId: string) {
  // Returns all shared workspaces where the user is an accepted member
  const rows = await sql`
    SELECT w.* FROM workspaces w
    INNER JOIN workspace_members m ON m.workspace_id = w.id
    WHERE m.user_id = ${userId}
    AND m.status = 'accepted'
    AND w.is_shared = true
    ORDER BY w.created_at ASC
  `;
  return rows;
}

export async function getWorkspaceMembers(workspaceId: string) {
  const rows = await sql`
    SELECT m.*, u.email as user_email FROM workspace_members m
    LEFT JOIN users u ON u.id::text = m.user_id::text
    WHERE m.workspace_id = ${workspaceId}
    ORDER BY m.invited_at ASC
  `;
  return rows;
}

export async function getMemberCount(workspaceId: string) {
  const rows = await sql`
    SELECT COUNT(*) as count FROM workspace_members
    WHERE workspace_id = ${workspaceId}
    AND status = 'accepted'
  `;
  return parseInt(rows[0].count);
}

export async function getUserRoleInWorkspace(userId: string, workspaceId: string) {
  const rows = await sql`
    SELECT role FROM workspace_members
    WHERE user_id = ${userId}
    AND workspace_id = ${workspaceId}
    AND status = 'accepted'
  `;
  return rows[0]?.role ?? null;
}

export async function isWorkspaceOwner(userId: string, workspaceId: string) {
  const rows = await sql`
    SELECT id FROM workspaces
    WHERE id::text = ${workspaceId}
    AND user_id = ${userId}
  `;
  return rows.length > 0;
}
