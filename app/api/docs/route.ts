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
  const folderId = searchParams.get('folder_id')
  const workspaceId = searchParams.get('workspace_id')

  try {
    if (folderId) {
      const docs = await sql`
        SELECT docs.*, users.name AS author_name, users.email AS author_email
        FROM docs
        LEFT JOIN users ON docs.user_id = users.id
        WHERE docs.user_id = ${payload.userId}
          AND docs.folder_id = ${folderId}
          AND docs.deleted_at IS NULL
        ORDER BY docs.created_at DESC
      `
      return NextResponse.json(docs)
    }

    if (workspaceId) {
      // Check if user owns this workspace or is an accepted member
      const ownerCheck = await sql`
        SELECT id FROM workspaces WHERE id::text = ${workspaceId} AND user_id = ${payload.userId}
      `
      const memberCheck = await sql`
        SELECT id FROM workspace_members
        WHERE workspace_id::text = ${workspaceId}
          AND user_id = ${payload.userId}
          AND status = 'accepted'
      `

      if (ownerCheck.length === 0 && memberCheck.length === 0) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      // Return all docs in workspace regardless of who created them
      const docs = await sql`
        SELECT docs.*, users.name AS author_name, users.email AS author_email
        FROM docs
        LEFT JOIN users ON docs.user_id = users.id
        WHERE docs.workspace_id::text = ${workspaceId}
          AND docs.deleted_at IS NULL
        ORDER BY docs.created_at DESC
      `
      return NextResponse.json(docs)
    }

    // Default: return only user's own docs
    const docs = await sql`
      SELECT docs.*, users.name AS author_name, users.email AS author_email
      FROM docs
      LEFT JOIN users ON docs.user_id = users.id
      WHERE docs.user_id = ${payload.userId}
        AND docs.deleted_at IS NULL
      ORDER BY docs.created_at DESC
    `
    return NextResponse.json(docs)

  } catch (error) {
    console.error('Failed to fetch docs:', error)
    return NextResponse.json({ error: 'Failed to fetch docs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const userResult = await sql`
      SELECT plan FROM users WHERE id = ${payload.userId}
    `
    const user = userResult[0]
    const plan = user?.plan ?? 'free'

    if (plan === 'free') {
      const countResult = await sql`
        SELECT COUNT(*) AS count FROM docs
        WHERE user_id = ${payload.userId}
          AND deleted_at IS NULL
      `
      const docCount = parseInt(countResult[0].count, 10)
      if (docCount >= 30) {
        return NextResponse.json({ error: 'free_limit_reached' }, { status: 403 })
      }
    }

    const { title, content, color, type = 'doc', folder_id = null, workspace_id = null } = await request.json()
    const result = await sql`
      INSERT INTO docs (title, content, color, type, user_id, folder_id, workspace_id, uuid)
      VALUES (
        ${title},
        ${content},
        ${color},
        ${type},
        ${payload.userId},
        ${folder_id},
        ${workspace_id},
        gen_random_uuid()::TEXT
      )
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create doc:', error)
    return NextResponse.json({ error: 'Failed to create doc' }, { status: 500 })
  }
}
