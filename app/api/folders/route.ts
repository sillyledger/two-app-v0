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

  try {
    const folders = workspaceId && parentId
      ? await sql`
          SELECT
            folders.id, folders.workspace_id, folders.created_at, folders.pinned,
            folders.name, folders.user_id, folders.parent_id,
            COUNT(docs.id) FILTER (WHERE docs.deleted_at IS NULL) AS doc_count,
            MAX(docs.updated_at) FILTER (WHERE docs.deleted_at IS NULL) AS last_edited
          FROM folders
          LEFT JOIN docs ON docs.folder_id::text = folders.id::text
          WHERE folders.user_id = ${payload.userId}
            AND folders.workspace_id = ${workspaceId}
            AND folders.parent_id::text = ${parentId}
          GROUP BY folders.id, folders.workspace_id, folders.created_at, folders.pinned,
            folders.name, folders.user_id, folders.parent_id
          ORDER BY folders.created_at ASC
        `
      : workspaceId
      ? await sql`
          SELECT
            folders.id, folders.workspace_id, folders.created_at, folders.pinned,
            folders.name, folders.user_id, folders.parent_id,
            COUNT(docs.id) FILTER (WHERE docs.deleted_at IS NULL) AS doc_count,
            MAX(docs.updated_at) FILTER (WHERE docs.deleted_at IS NULL) AS last_edited
          FROM folders
          LEFT JOIN docs ON docs.folder_id::text = folders.id::text
          WHERE folders.user_id = ${payload.userId}
            AND folders.workspace_id = ${workspaceId}
            AND folders.parent_id IS NULL
          GROUP BY folders.id, folders.workspace_id, folders.created_at, folders.pinned,
            folders.name, folders.user_id, folders.parent_id
          ORDER BY folders.created_at ASC
        `
      : parentId
      ? await sql`
          SELECT
            folders.id, folders.workspace_id, folders.created_at, folders.pinned,
            folders.name, folders.user_id, folders.parent_id,
            COUNT(docs.id) FILTER (WHERE docs.deleted_at IS NULL) AS doc_count,
            MAX(docs.updated_at) FILTER (WHERE docs.deleted_at IS NULL) AS last_edited
          FROM folders
          LEFT JOIN docs ON docs.folder_id::text = folders.id::text
          WHERE folders.user_id = ${payload.userId}
            AND folders.parent_id::text = ${parentId}
          GROUP BY folders.id, folders.workspace_id, folders.created_at, folders.pinned,
            folders.name, folders.user_id, folders.parent_id
          ORDER BY folders.created_at ASC
        `
      : await sql`
          SELECT
            folders.id, folders.workspace_id, folders.created_at, folders.pinned,
            folders.name, folders.user_id, folders.parent_id,
            COUNT(docs.id) FILTER (WHERE docs.deleted_at IS NULL) AS doc_count,
            MAX(docs.updated_at) FILTER (WHERE docs.deleted_at IS NULL) AS last_edited
          FROM folders
          LEFT JOIN docs ON docs.folder_id::text = folders.id::text
          WHERE folders.user_id = ${payload.userId}
            AND folders.parent_id IS NULL
          GROUP BY folders.id, folders.workspace_id, folders.created_at, folders.pinned,
            folders.name, folders.user_id, folders.parent_id
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
