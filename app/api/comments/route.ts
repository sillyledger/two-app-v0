import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { userHasDocAccess, isWorkspaceOwner, getUserRoleInWorkspace } from '@/lib/workspaces'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const uuid = searchParams.get('docId')
  if (!uuid) return NextResponse.json({ error: 'Missing docId' }, { status: 400 })

  if (!(await userHasDocAccess(session.userId, uuid))) {
    return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
  }

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

  if (!(await userHasDocAccess(session.userId, docId))) {
    return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
  }

  const docRows = await sql`SELECT id, workspace_id, user_id FROM docs WHERE uuid = ${docId}`
  if (!docRows.length) return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
  const doc = docRows[0]

  if (doc.user_id !== session.userId && doc.workspace_id) {
    const owner = await isWorkspaceOwner(session.userId, doc.workspace_id)
    if (!owner) {
      const role = await getUserRoleInWorkspace(session.userId, doc.workspace_id)
      if (role === 'viewer') {
        return NextResponse.json({ error: 'Viewers cannot comment' }, { status: 403 })
      }
    }
  }

  const result = await sql`
    INSERT INTO comments (doc_id, user_id, user_name, body)
    VALUES (${doc.id}, ${session.userId}, ${userName || 'Anonymous'}, ${body.trim()})
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
