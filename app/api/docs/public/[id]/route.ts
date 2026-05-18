import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await sql`
      SELECT * FROM docs
      WHERE id = ${id}
        AND deleted_at IS NULL
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
    }
    const doc = result[0]
    // If the doc is private, only return minimal info so the page can redirect
    if (!doc.is_public) {
      return NextResponse.json({ error: 'Private' }, { status: 403 })
    }
    return NextResponse.json(doc)
  } catch (error) {
    console.error('Failed to fetch public doc:', error)
    return NextResponse.json({ error: 'Failed to fetch doc' }, { status: 500 })
  }
}
