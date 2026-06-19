import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('category_id')

  try {
    if (categoryId) {
      const notes = await sql`
        SELECT notes.*, note_categories.name AS category_name, note_categories.color AS category_color
        FROM notes
        LEFT JOIN note_categories ON note_categories.id = notes.category_id
        WHERE notes.user_id = ${payload.userId}
          AND notes.category_id::text = ${categoryId}
          AND notes.deleted_at IS NULL
        ORDER BY notes.updated_at DESC
      `
      return NextResponse.json(notes)
    }

    const notes = await sql`
      SELECT notes.*, note_categories.name AS category_name, note_categories.color AS category_color
      FROM notes
      LEFT JOIN note_categories ON note_categories.id = notes.category_id
      WHERE notes.user_id = ${payload.userId}
        AND notes.deleted_at IS NULL
      ORDER BY notes.updated_at DESC
    `
    return NextResponse.json(notes)
  } catch (error) {
    console.error('Failed to fetch notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { title = '', content = '', category_id = null } = await request.json().catch(() => ({}))

    const result = await sql`
      INSERT INTO notes (user_id, title, content, category_id, uuid)
      VALUES (${payload.userId}, ${title}, ${content}, ${category_id}, gen_random_uuid()::TEXT)
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}
