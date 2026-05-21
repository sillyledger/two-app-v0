import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'secret')

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload.userId as string
  } catch {
    return null
  }
}

// GET /api/docs/[id]/labels — get all labels on a doc
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const labels = await sql`
    SELECT l.id, l.name, l.color
    FROM labels l
    JOIN doc_labels dl ON dl.label_id = l.id
    JOIN docs d ON d.id = dl.doc_id
    WHERE d.uuid = ${params.id}
    AND l.user_id = ${userId}
  `
  return NextResponse.json(labels)
}

// POST /api/docs/[id]/labels — add a label to a doc
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { labelId } = await req.json()

  await sql`
    INSERT INTO doc_labels (doc_id, label_id)
    SELECT d.id, ${labelId}
    FROM docs d
    WHERE d.uuid = ${params.id}
    ON CONFLICT DO NOTHING
  `
  return NextResponse.json({ ok: true })
}

// DELETE /api/docs/[id]/labels — remove a label from a doc
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { labelId } = await req.json()

  await sql`
    DELETE FROM doc_labels
    WHERE label_id = ${labelId}
    AND doc_id = (SELECT id FROM docs WHERE uuid = ${params.id})
  `
  return NextResponse.json({ ok: true })
}
