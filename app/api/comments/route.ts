import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const uuid = searchParams.get('docId')
  if (!uuid) return NextResponse.json({ error: 'Missing docId' }, { status: 400 })

  const comments = await sql`
    SELECT c.id, c.user_id, c.user_name, c.body, c.created_at
    FROM comments c
    JOIN docs d ON d.id = c.doc_id
    WHERE d.uuid = ${uuid}
    ORDER BY c.created_at ASC
  `
  return NextResponse.json(comments)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { docId, body, userName } = await request.json()
  if (!docId || !body?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const docRows = await sql`SELECT id FROM docs WHERE uuid = ${docId}`
  if (!docRows.length) return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
  const numericDocId = docRows[0].id

  const result = await sql`
    INSERT INTO comments (doc_id, user_id, user_name, body)
    VALUES (${numericDocId}, ${session.userId}, ${userName || 'Anonymous'}, ${body.trim()})
    RETURNING *
  `
  return NextResponse.json(result[0])
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { commentId } = await request.json()
  if (!commentId) return NextResponse.json({ error: 'Missing commentId' }, { status: 400 })

  await sql`
    DELETE FROM comments
    WHERE id = ${commentId} AND user_id = ${session.userId}
  `
  return NextResponse.json({ success: true })
}
