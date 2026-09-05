import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspace_id')
  const parentId = searchParams.get('parent_id')
  const all = searchParams.get('all') === 'true'

  try {
    // Recursive CTE: for every folder owned by the user, walk parent_id downward
    // to collect the whole subtree (self included), then aggregate doc counts
    // across that subtree so doc_count reflects docs at any depth, not just
    // docs directly in the folder. Same descendant-walk pattern as the
    // recursive DELETE below.
    const folders = all && workspaceId
      ? await sql`
          WITH RECURSIVE folder_tree AS (
            SELECT id AS root_id, id AS descendant_id FROM folders WHERE user_id = ${payload.userId}
            UNION ALL
            SELECT ft.root_id, f.id
            FROM folders f INNER JOIN folder_tree ft ON f.parent_id = ft.descendant_id
          ),
          doc_counts AS (
            SELECT ft.root_id,
              COUNT(d.id) AS doc_count,
              MAX(d.updated_at) AS last_edited
            FROM folder_tree ft
            LEFT JOIN docs d ON d.folder_id::text = ft.descendant_id::text AND d.deleted_at IS NULL
            GROUP BY ft.root_id
          )
          SELECT
            folders.id, folders.workspace_id, folders.created_at, folders.pinned,
            folders.name, folders.user_id, folders.parent_id,
            COALESCE(doc_counts.doc_count, 0) AS doc_count,
            doc_counts.last_edited
          FROM folders
          LEFT JOIN doc_counts ON doc_counts.root_id = folders.id
          WHERE folders.user_id = ${payload.userId}
            AND folders.workspace_id = ${workspaceId}
          ORDER BY folders.created_at ASC
        `
      : all
      ? await sql`
          WITH RECURSIVE folder_tree AS (
            SELECT id AS root_id, id AS descendant_id FROM folders WHERE user_id = ${payload.userId}
            UNION ALL
            SELECT ft.root_id, f.id
            FROM folders f INNER JOIN folder_tree ft ON f.parent_id = ft.descendant_id
          ),
          doc_counts AS (
            SELECT ft.root_id,
              COUNT(d.id) AS doc_count,
              MAX(d.updated_at) AS last_edited
            FROM folder_tree ft
            LEFT JOIN docs d ON d.folder_id::text = ft.descendant_id::text AND d.deleted_at IS NULL
            GROUP BY ft.root_id
          )
          SELECT
            folders.id, folders.workspace_id, folders.created_at, folders.pinned,
            folders.name, folders.user_id, folders.parent_id,
            COALESCE(doc_counts.doc_count, 0) AS doc_count,
            doc_counts.last_edited
          FROM folders
          LEFT JOIN doc_counts ON doc_counts.root_id = folders.id
          WHERE folders.user_id = ${payload.userId}
          ORDER BY folders.created_at ASC
        `
      : workspaceId && parentId
      ? await sql`
          WITH RECURSIVE folder_tree AS (
            SELECT id AS root_id, id AS descendant_id FROM folders WHERE user_id = ${payload.userId}
            UNION ALL
            SELECT ft.root_id, f.id
            FROM folders f INNER JOIN folder_tree ft ON f.parent_id = ft.descendant_id
          ),
          doc_counts AS (
            SELECT ft.root_id,
              COUNT(d.id) AS doc_count,
              MAX(d.updated_at) AS last_edited
            FROM folder_tree ft
            LEFT JOIN docs d ON d.folder_id::text = ft.descendant_id::text AND d.deleted_at IS NULL
            GROUP BY ft.root_id
          )
          SELECT
            folders.id, folders.workspace_id, folders.created_at, folders.pinned,
            folders.name, folders.user_id, folders.parent_id,
            COALESCE(doc_counts.doc_count, 0) AS doc_count,
            doc_counts.last_edited
          FROM folders
          LEFT JOIN doc_counts ON doc_counts.root_id = folders.id
          WHERE folders.user_id = ${payload.userId}
            AND folders.workspace_id = ${workspaceId}
            AND folders.parent_id::text = ${parentId}
          ORDER BY folders.created_at ASC
        `
      : workspaceId
      ? await sql`
          WITH RECURSIVE folder_tree AS (
            SELECT id AS root_id, id AS descendant_id FROM folders WHERE user_id = ${payload.userId}
            UNION ALL
            SELECT ft.root_id, f.id
            FROM folders f INNER JOIN folder_tree ft ON f.parent_id = ft.descendant_id
          ),
          doc_counts AS (
            SELECT ft.root_id,
              COUNT(d.id) AS doc_count,
              MAX(d.updated_at) AS last_edited
            FROM folder_tree ft
            LEFT JOIN docs d ON d.folder_id::text = ft.descendant_id::text AND d.deleted_at IS NULL
            GROUP BY ft.root_id
          )
          SELECT
            folders.id, folders.workspace_id, folders.created_at, folders.pinned,
            folders.name, folders.user_id, folders.parent_id,
            COALESCE(doc_counts.doc_count, 0) AS doc_count,
            doc_counts.last_edited
          FROM folders
          LEFT JOIN doc_counts ON doc_counts.root_id = folders.id
          WHERE folders.user_id = ${payload.userId}
            AND folders.workspace_id = ${workspaceId}
            AND folders.parent_id IS NULL
          ORDER BY folders.created_at ASC
        `
      : parentId
      ? await sql`
          WITH RECURSIVE folder_tree AS (
            SELECT id AS root_id, id AS descendant_id FROM folders WHERE user_id = ${payload.userId}
            UNION ALL
            SELECT ft.root_id, f.id
            FROM folders f INNER JOIN folder_tree ft ON f.parent_id = ft.descendant_id
          ),
          doc_counts AS (
            SELECT ft.root_id,
              COUNT(d.id) AS doc_count,
              MAX(d.updated_at) AS last_edited
            FROM folder_tree ft
            LEFT JOIN docs d ON d.folder_id::text = ft.descendant_id::text AND d.deleted_at IS NULL
            GROUP BY ft.root_id
          )
          SELECT
            folders.id, folders.workspace_id, folders.created_at, folders.pinned,
            folders.name, folders.user_id, folders.parent_id,
            COALESCE(doc_counts.doc_count, 0) AS doc_count,
            doc_counts.last_edited
          FROM folders
          LEFT JOIN doc_counts ON doc_counts.root_id = folders.id
          WHERE folders.user_id = ${payload.userId}
            AND folders.parent_id::text = ${parentId}
          ORDER BY folders.created_at ASC
        `
      : await sql`
          WITH RECURSIVE folder_tree AS (
            SELECT id AS root_id, id AS descendant_id FROM folders WHERE user_id = ${payload.userId}
            UNION ALL
            SELECT ft.root_id, f.id
            FROM folders f INNER JOIN folder_tree ft ON f.parent_id = ft.descendant_id
          ),
          doc_counts AS (
            SELECT ft.root_id,
              COUNT(d.id) AS doc_count,
              MAX(d.updated_at) AS last_edited
            FROM folder_tree ft
            LEFT JOIN docs d ON d.folder_id::text = ft.descendant_id::text AND d.deleted_at IS NULL
            GROUP BY ft.root_id
          )
          SELECT
            folders.id, folders.workspace_id, folders.created_at, folders.pinned,
            folders.name, folders.user_id, folders.parent_id,
            COALESCE(doc_counts.doc_count, 0) AS doc_count,
            doc_counts.last_edited
          FROM folders
          LEFT JOIN doc_counts ON doc_counts.root_id = folders.id
          WHERE folders.user_id = ${payload.userId}
            AND folders.parent_id IS NULL
          ORDER BY folders.created_at ASC
        `

    return NextResponse.json(folders)
  } catch (error) {
    console.error('Failed to fetch folders:', error)
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { name, workspace_id, parent_id } = await request.json()
    const result = await sql`
      INSERT INTO folders (name, workspace_id, user_id, parent_id)
      VALUES (${name}, ${workspace_id}, ${payload.userId}, ${parent_id ?? null})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create folder:', error)
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await request.json()
    await sql`
      DELETE FROM folders WHERE id = ${id} AND user_id = ${payload.userId}
    `
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete folder:', error)
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 })
  }
}
