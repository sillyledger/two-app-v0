import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const { name, color, parent_id } = await request.json()

    if (parent_id !== undefined && parent_id !== null) {
      if (String(parent_id) === id) {
        return NextResponse.json({ error: 'A category cannot be moved into itself' }, { status: 400 })
      }

      const targetCategory = await sql`
        SELECT id FROM board_categories WHERE id::text = ${String(parent_id)} AND user_id = ${payload.userId}
      `
      if (targetCategory.length === 0) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 })
      }

      const descendantRows = await sql`
        WITH RECURSIVE descendants AS (
          SELECT id FROM board_categories WHERE id::text = ${id}
          UNION ALL
          SELECT bc.id
          FROM board_categories bc INNER JOIN descendants d ON bc.parent_id = d.id
        )
        SELECT id FROM descendants
      `
      const descendantIds: string[] = descendantRows.map(row => String(row.id))
      if (descendantIds.includes(String(parent_id))) {
        return NextResponse.json({ error: 'Cannot move a category into one of its own subcategories' }, { status: 400 })
      }
    }

    const result = await sql`
      UPDATE board_categories
      SET
        name = COALESCE(${name ?? null}, name),
        color = COALESCE(${color ?? null}, color),
        parent_id = CASE WHEN ${parent_id !== undefined} THEN ${parent_id ?? null} ELSE parent_id END
      WHERE id::text = ${id} AND user_id = ${payload.userId}
      RETURNING *
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to update board category:', error)
    return NextResponse.json({ error: 'Failed to update board category' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params

    const result = await sql`
      DELETE FROM board_categories
      WHERE id::text = ${id} AND user_id = ${payload.userId}
      RETURNING id
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete board category:', error)
    return NextResponse.json({ error: 'Failed to delete board category' }, { status: 500 })
  }
}
