import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const categories = await sql`
      SELECT * FROM note_categories
      WHERE user_id = ${payload.userId}
      ORDER BY created_at ASC
    `
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Failed to fetch note categories:', error)
    return NextResponse.json({ error: 'Failed to fetch note categories' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { name, color } = await request.json()
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    const result = await sql`
      INSERT INTO note_categories (user_id, name, color)
      VALUES (${payload.userId}, ${name.trim()}, ${color || '#888890'})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create note category:', error)
    return NextResponse.json({ error: 'Failed to create note category' }, { status: 500 })
  }
}
