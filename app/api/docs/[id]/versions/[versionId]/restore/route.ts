import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'
import Pusher from 'pusher'

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, versionId } = await params

    const accessCheck = await sql`
      SELECT docs.id, docs.uuid FROM docs
      LEFT JOIN workspace_members wm ON wm.workspace_id::text = docs.workspace_id::text
        AND wm.user_id = ${session.userId}
        AND wm.status = 'accepted'
        AND wm.role IN ('admin', 'editor')
      LEFT JOIN workspaces w ON w.id::text = docs.workspace_id::text
        AND w.user_id = ${session.userId}
      WHERE docs.uuid = ${id}
        AND docs.deleted_at IS NULL
        AND (
          docs.user_id = ${session.userId}
          OR wm.id IS NOT NULL
          OR w.id IS NOT NULL
        )
    `
    if (accessCheck.length === 0) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
    }
    const docId = accessCheck[0].id

    const version = await sql`
      SELECT title, content FROM doc_versions
      WHERE id = ${versionId} AND doc_id = ${docId}
    `
    if (version.length === 0) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    // Snapshot the current state first, so restoring is itself undoable.
    const current = await sql`SELECT title, content FROM docs WHERE id = ${docId}`
    if (current.length > 0) {
      await sql`
        INSERT INTO doc_versions (doc_id, title, content, edited_by)
        VALUES (${docId}, ${current[0].title}, ${current[0].content}, ${session.userId})
      `
    }

    const result = await sql`
      UPDATE docs
      SET title = ${version[0].title}, content = ${version[0].content}, last_edited_by = ${session.userId}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${docId}
      RETURNING *
    `

    await pusher.trigger(`doc-${id}`, 'updated', {})

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to restore doc version:', error)
    return NextResponse.json({ error: 'Failed to restore doc version' }, { status: 500 })
  }
}
