import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const { name, category_id } = await request.json()
    if (name === undefined && category_id === undefined) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }
    if (name !== undefined && !name.trim()) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }
    const result = await sql`
      UPDATE boards SET
        name = COALESCE(${name?.trim() ?? null}, name),
        category_id = CASE WHEN ${category_id !== undefined} THEN ${category_id ?? null} ELSE category_id END
      WHERE uuid = ${id} AND user_id = ${session.userId}
      RETURNING *
    `
    if (!result[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to rename board:', error)
    return NextResponse.json({ error: 'Failed to rename board' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const board = await sql`SELECT id FROM boards WHERE uuid = ${id} AND user_id = ${session.userId}`
    if (!board[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await sql`DELETE FROM board_connectors WHERE board_id = ${board[0].id}`
    await sql`DELETE FROM board_items WHERE board_id = ${board[0].id}`
    await sql`DELETE FROM boards WHERE id = ${board[0].id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete board:', error)
    return NextResponse.json({ error: 'Failed to delete board' }, { status: 500 })
  }
}
