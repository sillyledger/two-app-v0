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
    const ideas = await sql`
      SELECT * FROM content_ideas
      WHERE user_id = ${payload.userId}
      ORDER BY created_at DESC
    `
    return NextResponse.json(ideas)
  } catch (error) {
    console.error('Failed to fetch content ideas:', error)
    return NextResponse.json({ error: 'Failed to fetch content ideas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { title, type = null, platform = null, category = null } = await request.json()
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    const result = await sql`
      INSERT INTO content_ideas (user_id, title, type, platform, category)
      VALUES (${payload.userId}, ${title.trim()}, ${type}, ${platform}, ${category})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create content idea:', error)
    return NextResponse.json({ error: 'Failed to create content idea' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { field, from, to } = await request.json()
    if (field !== 'platform' && field !== 'category') {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
    }
    if (!from) {
      return NextResponse.json({ error: 'from is required' }, { status: 400 })
    }
    const newValue = to && String(to).trim() ? String(to).trim() : null
    const result = field === 'platform'
      ? await sql`UPDATE content_ideas SET platform = ${newValue}, updated_at = now() WHERE user_id = ${payload.userId} AND platform = ${from} RETURNING id`
      : await sql`UPDATE content_ideas SET category = ${newValue}, updated_at = now() WHERE user_id = ${payload.userId} AND category = ${from} RETURNING id`
    return NextResponse.json({ updated: result.length })
  } catch (error) {
    console.error('Failed to bulk update content ideas field:', error)
    return NextResponse.json({ error: 'Failed to bulk update' }, { status: 500 })
  }
}
