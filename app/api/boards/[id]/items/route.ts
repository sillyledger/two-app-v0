import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const board = await sql`SELECT id FROM boards WHERE uuid = ${id} AND user_id = ${session.userId}`
    if (!board[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const items = await sql`SELECT * FROM board_items WHERE board_id = ${board[0].id} ORDER BY created_at ASC`
    return NextResponse.json(items)
  } catch (error) {
    console.error('Failed to fetch board items:', error)
    return NextResponse.json({ error: 'Failed to fetch board items' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const board = await sql`SELECT id FROM boards WHERE uuid = ${id} AND user_id = ${session.userId}`
    if (!board[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { type, ref_id, content, color, x, y, rotation } = await request.json()
    if (!['doc', 'note', 'image', 'swatch'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
    const result = await sql`
      INSERT INTO board_items (board_id, type, ref_id, content, color, x, y, rotation)
      VALUES (${board[0].id}, ${type}, ${ref_id ?? null}, ${content ?? null}, ${color ?? null}, ${x ?? 40}, ${y ?? 40}, ${rotation ?? 0})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create board item:', error)
    return NextResponse.json({ error: 'Failed to create board item' }, { status: 500 })
  }
}
