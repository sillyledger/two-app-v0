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

  try {
    const entries = await sql`
      SELECT
        docs.uuid::text AS uuid,
        'doc' AS type,
        docs.title AS title,
        docs.updated_at AS updated_at,
        docs.created_at AS created_at,
        folders.name AS context_name,
        folders.id::text AS context_id,
        NULL::text AS context_color,
        COALESCE(workspaces.is_shared, false) AS is_shared,
        workspaces.name AS workspace_name,
        COALESCE(editor.name, creator.name) AS editor_name,
        (COALESCE(docs.last_edited_by, docs.user_id) = ${userId}) AS is_you,
        (docs.deleted_at IS NOT NULL) AS is_deleted,
        docs.uuid::text AS link_id,
        NULL::text AS action
      FROM docs
      LEFT JOIN folders ON docs.folder_id::text = folders.id::text
      LEFT JOIN workspaces ON docs.workspace_id::text = workspaces.id::text
      LEFT JOIN users editor ON editor.id = docs.last_edited_by
      LEFT JOIN users creator ON creator.id = docs.user_id
      LEFT JOIN workspace_members wm ON wm.workspace_id::text = docs.workspace_id::text
        AND wm.user_id = ${userId} AND wm.status = 'accepted'
      WHERE docs.updated_at >= ${cutoff}
        AND (docs.user_id = ${userId} OR wm.id IS NOT NULL)

      UNION ALL

      SELECT
        notes.uuid::text AS uuid,
        'note' AS type,
        notes.title AS title,
        notes.updated_at AS updated_at,
        notes.created_at AS created_at,
        note_categories.name AS context_name,
        NULL::text AS context_id,
        note_categories.color AS context_color,
        false AS is_shared,
        NULL::text AS workspace_name,
        NULL::text AS editor_name,
        true AS is_you,
        (notes.deleted_at IS NOT NULL) AS is_deleted,
        notes.uuid::text AS link_id,
        NULL::text AS action
      FROM notes
      LEFT JOIN note_categories ON note_categories.id = notes.category_id
      WHERE notes.updated_at >= ${cutoff}
        AND notes.user_id = ${userId}

      UNION ALL

      SELECT
        activity_log.id::text AS uuid,
        'folder' AS type,
        activity_log.entity_title AS title,
        activity_log.created_at AS updated_at,
        activity_log.created_at AS created_at,
        NULL::text AS context_name,
        NULL::text AS context_id,
        NULL::text AS context_color,
        COALESCE(workspaces.is_shared, false) AS is_shared,
        workspaces.name AS workspace_name,
        actor.name AS editor_name,
        (activity_log.user_id = ${userId}) AS is_you,
        (folders.id IS NULL) AS is_deleted,
        activity_log.entity_id AS link_id,
        activity_log.action AS action
      FROM activity_log
      LEFT JOIN folders ON folders.id::text = activity_log.entity_id
      LEFT JOIN workspaces ON activity_log.workspace_id::text = workspaces.id::text
      LEFT JOIN users actor ON actor.id = activity_log.user_id
      LEFT JOIN workspace_members wm ON wm.workspace_id::text = activity_log.workspace_id::text
        AND wm.user_id = ${userId} AND wm.status = 'accepted'
      WHERE activity_log.entity_type = 'folder'
        AND activity_log.created_at >= ${cutoff}
        AND (activity_log.user_id = ${userId} OR wm.id IS NOT NULL)

      ORDER BY updated_at DESC
    `

    return NextResponse.json(entries)
  } catch (error) {
    console.error('Failed to fetch activity:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
