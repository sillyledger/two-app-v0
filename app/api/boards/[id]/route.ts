import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const { name } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    const result = await sql`
      UPDATE boards SET name = ${name.trim()} WHERE id = ${id} AND user_id = ${session.userId} RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to rename board:', error)
    return NextResponse.json({ error: 'Failed to rename board' }, { status: 500 })
  }
}
