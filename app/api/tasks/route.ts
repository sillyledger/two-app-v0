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
  const docId = searchParams.get('docId')

  try {
    const tasks = docId
      ? await sql`
          SELECT * FROM tasks
          WHERE user_id = ${payload.userId} AND doc_id = ${docId}
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT * FROM tasks
          WHERE user_id = ${payload.userId}
          ORDER BY created_at DESC
        `
    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Failed to fetch tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { title, due_date, doc_id, doc_title } = await request.json()
    if (!title || !doc_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const result = await sql`
      INSERT INTO tasks (user_id, title, due_date, doc_id, doc_title)
      VALUES (${payload.userId}, ${title}, ${due_date ?? null}, ${doc_id}, ${doc_title ?? ''})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, completed } = await request.json()
    const result = await sql`
      UPDATE tasks SET completed = ${completed}
      WHERE id = ${id} AND user_id = ${payload.userId}
      RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to update task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await request.json()
    await sql`DELETE FROM tasks WHERE id = ${id} AND user_id = ${payload.userId}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete task:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
