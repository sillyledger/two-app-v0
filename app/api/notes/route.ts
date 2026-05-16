import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { auth } from '@/lib/auth/server'

export async function GET() {
  try {
    const session = await auth.getSession()
    
    if (!session?.data?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notes = await sql`
      SELECT * FROM notes 
      WHERE user_id = ${session.data.user.id}
      ORDER BY created_at DESC
    `
    return NextResponse.json(notes)
  } catch (error) {
    console.error('Failed to fetch notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.getSession()
    
    if (!session?.data?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, content, color } = body

    const result = await sql`
      INSERT INTO notes (title, content, color, user_id)
      VALUES (${title}, ${content}, ${color}, ${session.data.user.id})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}
