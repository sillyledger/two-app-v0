import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { itemId } = await params

  try {
    const body = await request.json()
    if (typeof body.x === 'number' && typeof body.y === 'number') {
      const result = await sql`UPDATE board_items SET x = ${body.x}, y = ${body.y} WHERE id = ${itemId} RETURNING *`
      return NextResponse.json(result[0])
    }
    if (typeof body.rotation === 'number') {
      const result = await sql`UPDATE board_items SET rotation = ${body.rotation} WHERE id = ${itemId} RETURNING *`
      return NextResponse.json(result[0])
    }
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  } catch (error) {
    console.error('Failed to update board item:', error)
    return NextResponse.json({ error: 'Failed to update board item' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { itemId } = await params

  try {
    await sql`DELETE FROM board_items WHERE id = ${itemId}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete board item:', error)
    return NextResponse.json({ error: 'Failed to delete board item' }, { status: 500 })
  }
}
