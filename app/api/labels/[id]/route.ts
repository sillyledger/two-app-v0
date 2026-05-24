import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

// PUT /api/labels/[id] — rename a label
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { name, color } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const [label] = await sql`
    UPDATE labels
    SET name = ${name}, color = ${color}
    WHERE id = ${id} AND user_id = ${session.userId}
    RETURNING id, name, color
  `
  if (!label) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(label)
}

// DELETE /api/labels/[id] — delete a label globally
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await sql`
    DELETE FROM labels
    WHERE id = ${id} AND user_id = ${session.userId}
  `
  return NextResponse.json({ success: true })
}
