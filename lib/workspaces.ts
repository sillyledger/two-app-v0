import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);

export async function getOrCreateWorkspace(userId: string, name = "My Workspace") {
  const rows = await sql`
    INSERT INTO workspaces (user_id, name)
    VALUES (${userId}, ${name})
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  if (rows[0]) return rows[0];
  const existing = await sql`
    SELECT * FROM workspaces WHERE user_id = ${userId} ORDER BY created_at ASC LIMIT 1
  `;
  return existing[0];
}

export async function getWorkspace(userId: string) {
  const rows = await sql`
    SELECT * FROM workspaces WHERE user_id = ${userId} LIMIT 1
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
