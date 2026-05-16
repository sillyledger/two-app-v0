import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const notes = await sql`
      SELECT * FROM notes 
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
    const body = await request.json()
    const { title, content, color } = body

    const result = await sql`
      INSERT INTO notes (title, content, color)
      VALUES (${title}, ${content}, ${color})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}
