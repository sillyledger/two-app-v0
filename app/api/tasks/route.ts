import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { jwtVerify } from 'jose'

const sql = neon(process.env.DATABASE_URL!)

async function getUserId(request: NextRequest): Promise<number | null> {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) return null
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    return payload.userId as number
  } catch {
    return null
  }
}

// GET /api/tasks — fetch all tasks (or filtered by docId) for the logged-in user
export async function GET(request: NextRequest) {
  const userId = await getUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const docId = searchParams.get('docId')

  let tasks
  if (docId) {
    tasks = await sql`
      SELECT * FROM tasks
      WHERE user_id = ${userId} AND doc_id = ${docId}
      ORDER BY created_at DESC
    `
  } else {
    tasks = await sql`
      SELECT * FROM tasks
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `
  }

  return NextResponse.json(tasks)
}

// POST /api/tasks — create a new task
export async function POST(request: NextRequest) {
  const userId = await getUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, due_date, doc_id, doc_title } = body

  if (!title || !doc_id) {
    return NextResponse.json({ error: 'title and doc_id are required' }, { status: 400 })
  }

  const [task] = await sql`
    INSERT INTO tasks (user_id, title, due_date, doc_id, doc_title)
    VALUES (${userId}, ${title}, ${due_date ?? null}, ${doc_id}, ${doc_title ?? ''})
    RETURNING *
  `
  return NextResponse.json(task, { status: 201 })
}

// PATCH /api/tasks — toggle complete/incomplete
export async function PATCH(request: NextRequest) {
  const userId = await getUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, completed } = body

  const [task] = await sql`
    UPDATE tasks
    SET completed = ${completed}
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `
  return NextResponse.json(task)
}

// DELETE /api/tasks — delete a task
export async function DELETE(request: NextRequest) {
  const userId = await getUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id } = body

  await sql`DELETE FROM tasks WHERE id = ${id} AND user_id = ${userId}`
  return NextResponse.json({ success: true })
}
