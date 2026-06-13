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
    if (ownResult.length > 0) return NextResponse.json(ownResult[0])

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
    if (sharedResult.length > 0) return NextResponse.json(sharedResult[0])

    const ownerResult = await sql`
      SELECT docs.*, folders.name AS folder_name, folders.id AS folder_uuid
      FROM docs
      LEFT JOIN folders ON folders.id::text = docs.folder_id::text
      INNER JOIN workspaces w ON w.id::text = docs.workspace_id::text
      WHERE docs.uuid = ${id}
        AND docs.deleted_at IS NULL
        AND w.user_id = ${payload.userId}
    `
    if (ownerResult.length > 0) return NextResponse.json(ownerResult[0])

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
      SELECT docs.uuid FROM docs
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
        SET folder_id = ${folder_id}, updated_at = CURRENT_TIMESTAMP
        WHERE uuid = ${id}
        RETURNING *
      `
      return NextResponse.json(result[0])
    }

    // board_stage can be set to null (remove from board) or a string value
    const boardStageValue = board_stage !== undefined ? board_stage : undefined

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
      WHERE uuid = ${id} AND user_id = ${payload.userId}
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
