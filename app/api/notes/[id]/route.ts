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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const result = await sql`
      SELECT notes.*, note_categories.name AS category_name, note_categories.color AS category_color
      FROM notes
      LEFT JOIN note_categories ON note_categories.id = notes.category_id
      WHERE notes.uuid = ${id}
        AND notes.user_id = ${payload.userId}
        AND notes.deleted_at IS NULL
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to fetch note:', error)
    return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json()
    const { title, content, category_id } = body

    const categoryIdValue = category_id !== undefined ? category_id : undefined

    const result = await sql`
      UPDATE notes
      SET
        title = COALESCE(${title ?? null}, title),
        content = COALESCE(${content ?? null}, content),
        category_id = CASE
          WHEN ${categoryIdValue !== undefined} THEN ${categoryIdValue ?? null}
          ELSE category_id
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE uuid = ${id} AND user_id = ${payload.userId} AND deleted_at IS NULL
      RETURNING *
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    await pusher.trigger(`note-${id}`, 'updated', {})

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to update note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const result = await sql`
      UPDATE notes
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE uuid = ${id} AND user_id = ${payload.userId}
      RETURNING uuid
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete note:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
