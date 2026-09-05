import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json(null, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json(null, { status: 401 })
    const { id } = await params
    const result = await sql`
      SELECT * FROM folders WHERE id::text = ${id} AND user_id = ${payload.userId}
    `
    if (!result[0]) return NextResponse.json(null, { status: 404 })

    const pathRows = await sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, name, parent_id, 0 AS depth FROM folders WHERE id::text = ${id}
        UNION ALL
        SELECT f.id, f.name, f.parent_id, a.depth + 1
        FROM folders f INNER JOIN ancestors a ON f.id = a.parent_id
      )
      SELECT id, name FROM ancestors ORDER BY depth DESC
    `

    // Total doc count across this folder and all of its descendants (any depth),
    // using the same descendant-walk pattern as the recursive DELETE below.
    const descendantRows = await sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM folders WHERE id::text = ${id} AND user_id = ${payload.userId}
        UNION ALL
        SELECT f.id
        FROM folders f INNER JOIN descendants d ON f.parent_id = d.id
      )
      SELECT id FROM descendants
    `
    const folderIds: string[] = descendantRows.map(row => String(row.id))
    const docCountRows = await sql`
      SELECT COUNT(*) AS doc_count FROM docs
      WHERE folder_id::text = ANY(${folderIds}) AND deleted_at IS NULL
    `

    return NextResponse.json({ ...result[0], path: pathRows, doc_count: Number(docCountRows[0]?.doc_count) || 0 })
  } catch (error) {
    console.error('Folder fetch error:', error)
    return NextResponse.json(null, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json(null, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json(null, { status: 401 })
    const { id } = await params
    const { name } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    const result = await sql`
      UPDATE folders SET name = ${name.trim()} WHERE id::text = ${id} AND user_id = ${payload.userId} RETURNING *
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Folder rename error:', error)
    return NextResponse.json(null, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const { pinned } = await request.json()
    const result = await sql`
      UPDATE folders SET pinned = ${pinned} WHERE id::text = ${id} AND user_id = ${payload.userId}
      RETURNING *
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Folder pin error:', error)
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json(null, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json(null, { status: 401 })
    const { id } = await params

    // Collect the target folder plus all of its descendants (recursively)
    const descendantRows = await sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM folders WHERE id::text = ${id} AND user_id = ${payload.userId}
        UNION ALL
        SELECT f.id
        FROM folders f INNER JOIN descendants d ON f.parent_id = d.id
      )
      SELECT id FROM descendants
    `
    const folderIds: string[] = descendantRows.map(row => String(row.id))

    if (folderIds.length === 0) {
      return NextResponse.json(null, { status: 404 })
    }

    // Move all docs across the whole subtree to trash instead of deleting them
    // (folder_id is cast to text here to match the id::text comparisons used elsewhere in this file)
    await sql`
      UPDATE docs
      SET deleted_at = NOW(), folder_id = NULL
      WHERE folder_id::text = ANY(${folderIds})
    `

    // Deleting the top folder cascades to its descendants via parent_id ON DELETE CASCADE
    await sql`DELETE FROM folders WHERE id::text = ${id} AND user_id = ${payload.userId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Folder delete error:', error)
    return NextResponse.json(null, { status: 500 })
  }
}
