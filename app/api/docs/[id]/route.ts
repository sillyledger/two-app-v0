import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'
import Pusher from 'pusher'

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

async function attachFolderPath(doc: any) {
  if (!doc?.folder_id) return doc
  const path = await sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, name, parent_id, 0 AS depth FROM folders WHERE id::text = ${doc.folder_id}
      UNION ALL
      SELECT f.id, f.name, f.parent_id, a.depth + 1
      FROM folders f INNER JOIN ancestors a ON f.id = a.parent_id
    )
    SELECT id, name FROM ancestors ORDER BY depth DESC
  `
  return { ...doc, folder_path: path }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params

    const ownResult = await sql`
      SELECT docs.*, folders.name AS folder_name, folders.id AS folder_uuid
      FROM docs
      LEFT JOIN folders ON folders.id::text = docs.folder_id::text
      WHERE docs.uuid = ${id} AND docs.user_id = ${payload.userId} AND docs.deleted_at IS NULL
    `
    if (ownResult.length > 0) return NextResponse.json(await attachFolderPath(ownResult[0]))

    const sharedResult = await sql`
      SELECT docs.*, folders.name AS folder_name, folders.id AS folder_uuid
      FROM docs
      LEFT JOIN folders ON folders.id::text = docs.folder_id::text
      INNER JOIN workspace_members wm ON wm.workspace_id::text = docs.workspace_id::text
      WHERE docs.uuid = ${id}
        AND docs.deleted_at IS NULL
        AND wm.user_id = ${payload.userId}
        AND wm.status = 'accepted'
    `
    if (sharedResult.length > 0) return NextResponse.json(await attachFolderPath(sharedResult[0]))

    const ownerResult = await sql`
      SELECT docs.*, folders.name AS folder_name, folders.id AS folder_uuid
      FROM docs
      LEFT JOIN folders ON folders.id::text = docs.folder_id::text
      INNER JOIN workspaces w ON w.id::text = docs.workspace_id::text
      WHERE docs.uuid = ${id}
        AND docs.deleted_at IS NULL
        AND w.user_id = ${payload.userId}
    `
    if (ownerResult.length > 0) return NextResponse.json(await attachFolderPath(ownerResult[0]))

    return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
  } catch (error) {
    console.error('Failed to fetch doc:', error)
    return NextResponse.json({ error: 'Failed to fetch doc' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json()
    const { title, content, color, is_starred, type, folder_id, priority, board_stage } = body

    const accessCheck = await sql`
      SELECT docs.id, docs.uuid FROM docs
      LEFT JOIN workspace_members wm ON wm.workspace_id::text = docs.workspace_id::text
        AND wm.user_id = ${payload.userId}
        AND wm.status = 'accepted'
        AND wm.role IN ('admin', 'editor')
      LEFT JOIN workspaces w ON w.id::text = docs.workspace_id::text
        AND w.user_id = ${payload.userId}
      WHERE docs.uuid = ${id}
        AND docs.deleted_at IS NULL
        AND (
          docs.user_id = ${payload.userId}
          OR wm.id IS NOT NULL
          OR w.id IS NOT NULL
        )
    `
    if (accessCheck.length === 0) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
    }

    if (folder_id !== undefined) {
      const result = await sql`
        UPDATE docs
        SET folder_id = ${folder_id}, last_edited_by = ${payload.userId}, updated_at = CURRENT_TIMESTAMP
        WHERE uuid = ${id}
        RETURNING *
      `
      return NextResponse.json(result[0])
    }

    // board_stage can be set to null (remove from board) or a string value
    const boardStageValue = board_stage !== undefined ? board_stage : undefined

    if (content !== undefined) {
      const docId = accessCheck[0].id
      const preUpdate = await sql`SELECT title, content FROM docs WHERE id = ${docId}`
      const currentTitle = preUpdate[0]?.title ?? null
      const currentContent = preUpdate[0]?.content ?? null

      const recentVersion = await sql`
        SELECT created_at FROM doc_versions
        WHERE doc_id = ${docId}
        ORDER BY created_at DESC
        LIMIT 1
      `
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
      const hasRecentVersion = recentVersion.length > 0 && new Date(recentVersion[0].created_at) > tenMinutesAgo
      const titleChanged = title !== undefined && title !== null && title !== currentTitle

      if (!hasRecentVersion || titleChanged) {
        await sql`
          INSERT INTO doc_versions (doc_id, title, content, edited_by)
          VALUES (${docId}, ${currentTitle}, ${currentContent}, ${payload.userId})
        `

        const ownerPlan = await sql`
          SELECT users.plan
          FROM docs
          LEFT JOIN workspaces ON workspaces.id::text = docs.workspace_id::text
          INNER JOIN users ON users.id = COALESCE(workspaces.user_id, docs.user_id)
          WHERE docs.id = ${docId}
        `
        const plan = ownerPlan[0]?.plan ?? 'free'

        if (plan === 'free') {
          await sql`
            DELETE FROM doc_versions
            WHERE doc_id = ${docId}
              AND id NOT IN (
                SELECT id FROM doc_versions
                WHERE doc_id = ${docId}
                ORDER BY created_at DESC
                LIMIT 3
              )
          `
        }
      }
    }

    const result = await sql`
      UPDATE docs
      SET
        title = COALESCE(${title ?? null}, title),
        content = COALESCE(${content ?? null}, content),
        color = COALESCE(${color ?? null}, color),
        is_starred = COALESCE(${is_starred ?? null}, is_starred),
        type = COALESCE(${type ?? null}, type),
        priority = COALESCE(${priority ?? null}, priority),
        board_stage = CASE
          WHEN ${boardStageValue !== undefined} THEN ${boardStageValue ?? null}
          ELSE board_stage
        END,
        last_edited_by = ${payload.userId},
        updated_at = CURRENT_TIMESTAMP
      WHERE uuid = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
    }

    await pusher.trigger(`doc-${id}`, 'updated', {})

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to update doc:', error)
    return NextResponse.json({ error: 'Failed to update doc' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const { is_public } = await request.json()
    const result = await sql`
      UPDATE docs
      SET is_public = ${is_public}, updated_at = CURRENT_TIMESTAMP
      WHERE uuid = ${id} AND user_id = ${payload.userId}
      RETURNING *
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
    }
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to update doc:', error)
    return NextResponse.json({ error: 'Failed to update doc' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const result = await sql`
      UPDATE docs
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE uuid = ${id}
        AND (
          user_id::text = ${String(payload.userId)}
          OR workspace_id::text IN (
            SELECT id::text FROM workspaces WHERE user_id::text = ${String(payload.userId)}
          )
        )
      RETURNING *
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete doc:', error)
    return NextResponse.json({ error: 'Failed to delete doc' }, { status: 500 })
  }
}
