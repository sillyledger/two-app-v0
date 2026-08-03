import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params

    const ownResult = await sql`
      SELECT docs.id FROM docs
      WHERE docs.uuid = ${id} AND docs.user_id = ${session.userId} AND docs.deleted_at IS NULL
    `
    let docId: number | null = ownResult[0]?.id ?? null

    if (!docId) {
      const sharedResult = await sql`
        SELECT docs.id FROM docs
        INNER JOIN workspace_members wm ON wm.workspace_id::text = docs.workspace_id::text
        WHERE docs.uuid = ${id}
          AND docs.deleted_at IS NULL
          AND wm.user_id = ${session.userId}
          AND wm.status = 'accepted'
      `
      docId = sharedResult[0]?.id ?? null
    }

    if (!docId) {
      const ownerResult = await sql`
        SELECT docs.id FROM docs
        INNER JOIN workspaces w ON w.id::text = docs.workspace_id::text
        WHERE docs.uuid = ${id}
          AND docs.deleted_at IS NULL
          AND w.user_id = ${session.userId}
      `
      docId = ownerResult[0]?.id ?? null
    }

    if (!docId) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
    }

    const versions = await sql`
      SELECT
        doc_versions.id,
        doc_versions.title,
        doc_versions.content,
        doc_versions.created_at,
        users.name AS editor_name
      FROM doc_versions
      LEFT JOIN users ON users.id = doc_versions.edited_by
      WHERE doc_versions.doc_id = ${docId}
      ORDER BY doc_versions.created_at DESC
    `

    return NextResponse.json(versions)
  } catch (error) {
    console.error('Failed to fetch doc versions:', error)
    return NextResponse.json({ error: 'Failed to fetch doc versions' }, { status: 500 })
  }
}
