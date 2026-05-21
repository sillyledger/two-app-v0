import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'secret')

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload.userId as string
  } catch {
    return null
  }
}

// GET /api/labels — fetch all labels for the current user
export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const labels = await sql`
    SELECT id, name, color FROM labels
    WHERE user_id = ${userId}
    ORDER BY name ASC
  `
  return NextResponse.json(labels)
}

// POST /api/labels — create a new label
export async function POST(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, color } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const [label] = await sql`
    INSERT INTO labels (user_id, name, color)
    VALUES (${userId}, ${name}, ${color || '#888888'})
    RETURNING id, name, color
  `
  return NextResponse.json(label)
}
