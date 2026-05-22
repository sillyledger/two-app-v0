import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params

  const labels = await sql`
    SELECT l.id, l.name, l.color
    FROM labels l
    JOIN doc_labels dl ON dl.label_id = l.id
    JOIN docs d ON d.id = dl.doc_id
    WHERE d.uuid = ${id}
    AND l.user_id = ${session.userId}
  `
  return NextResponse.json(labels)
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const { labelId } = await req.json()

  await sql`
    INSERT INTO doc_labels (doc_id, label_id)
    SELECT d.id, ${labelId}
    FROM docs d
    WHERE d.uuid = ${id}
    ON CONFLICT DO NOTHING
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const { labelId } = await req.json()

  await sql`
    DELETE FROM doc_labels
    WHERE label_id = ${labelId}
    AND doc_id = (SELECT id FROM docs WHERE uuid = ${id})
  `
  return NextResponse.json({ ok: true })
}
