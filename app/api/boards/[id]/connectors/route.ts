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
    const connectors = await sql`SELECT * FROM board_connectors WHERE board_id = ${board[0].id} ORDER BY created_at ASC`
    return NextResponse.json(connectors)
  } catch (error) {
    console.error('Failed to fetch connectors:', error)
    return NextResponse.json({ error: 'Failed to fetch connectors' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const { from_item_id, to_item_id } = await request.json()
    if (!from_item_id || !to_item_id || from_item_id === to_item_id) {
      return NextResponse.json({ error: 'Invalid item ids' }, { status: 400 })
    }
    const board = await sql`SELECT id FROM boards WHERE uuid = ${id} AND user_id = ${session.userId}`
    if (!board[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const result = await sql`
      INSERT INTO board_connectors (board_id, from_item_id, to_item_id)
      VALUES (${board[0].id}, ${from_item_id}, ${to_item_id})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create connector:', error)
    return NextResponse.json({ error: 'Failed to create connector' }, { status: 500 })
  }
}
