import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET /api/labels — fetch all labels for the current user
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const labels = await sql`
    SELECT id, name, color FROM labels
    WHERE user_id = ${session.userId}
    ORDER BY name ASC
  `
  return NextResponse.json(labels)
}

// POST /api/labels — create a new label
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, color } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const [label] = await sql`
    INSERT INTO labels (user_id, name, color)
    VALUES (${session.userId}, ${name}, ${color || '#888888'})
    RETURNING id, name, color
  `
  return NextResponse.json(label)
}
