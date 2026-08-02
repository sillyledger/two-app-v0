import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspace_id')

  try {
    const boards = workspaceId
      ? await sql`SELECT * FROM boards WHERE user_id = ${session.userId} AND workspace_id = ${workspaceId} ORDER BY created_at DESC`
      : await sql`SELECT * FROM boards WHERE user_id = ${session.userId} ORDER BY created_at DESC`
    return NextResponse.json(boards)
  } catch (error) {
    console.error('Failed to fetch boards:', error)
    return NextResponse.json({ error: 'Failed to fetch boards' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { name, type, workspace_id } = await request.json()
    if (!name?.trim() || (type !== 'wall' && type !== 'canvas')) {
      return NextResponse.json({ error: 'Invalid name or type' }, { status: 400 })
    }
    const result = await sql`
      INSERT INTO boards (name, type, workspace_id, user_id)
      VALUES (${name.trim()}, ${type}, ${workspace_id}, ${session.userId})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create board:', error)
    return NextResponse.json({ error: 'Failed to create board' }, { status: 500 })
  }
}
