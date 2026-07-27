import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cutoff = thirtyDaysAgo.toISOString()
  const userId = session.userId

  const entries = await sql`
    SELECT
      docs.uuid AS uuid,
      'doc' AS type,
      docs.title AS title,
      docs.updated_at AS updated_at,
      docs.created_at AS created_at,
      folders.name AS context_name,
      NULL::text AS context_color,
      COALESCE(workspaces.is_shared, false) AS is_shared,
      workspaces.name AS workspace_name,
      editor.name AS editor_name,
      (docs.last_edited_by = ${userId}) AS is_you
    FROM docs
    LEFT JOIN folders ON docs.folder_id::text = folders.id::text
    LEFT JOIN workspaces ON docs.workspace_id::text = workspaces.id::text
    LEFT JOIN users editor ON editor.id = docs.last_edited_by
    LEFT JOIN workspace_members wm ON wm.workspace_id::text = docs.workspace_id::text
      AND wm.user_id = ${userId} AND wm.status = 'accepted'
    WHERE docs.deleted_at IS NULL
      AND docs.updated_at >= ${cutoff}
      AND (docs.user_id = ${userId} OR wm.id IS NOT NULL)

    UNION ALL

    SELECT
      notes.uuid AS uuid,
      'note' AS type,
      notes.title AS title,
      notes.updated_at AS updated_at,
      notes.created_at AS created_at,
      note_categories.name AS context_name,
      note_categories.color AS context_color,
      false AS is_shared,
      NULL::text AS workspace_name,
      NULL::text AS editor_name,
      true AS is_you
    FROM notes
    LEFT JOIN note_categories ON note_categories.id = notes.category_id
    WHERE notes.deleted_at IS NULL
      AND notes.updated_at >= ${cutoff}
      AND notes.user_id = ${userId}

    ORDER BY updated_at DESC
  `

  return NextResponse.json(entries)
}
