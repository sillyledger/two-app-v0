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
  const folderId = searchParams.get('folder_id')

  try {
    const docs = folderId
      ? await sql`
          SELECT * FROM docs
          WHERE user_id = ${payload.userId} AND folder_id = ${folderId} AND deleted_at IS NULL
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT * FROM docs
          WHERE user_id = ${payload.userId} AND deleted_at IS NULL
          ORDER BY created_at DESC
        `
    return NextResponse.json(docs)
  } catch (error) {
    console.error('Failed to fetch docs:', error)
    return NextResponse.json({ error: 'Failed to fetch docs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { title, content, color, type = 'doc', folder_id = null } = await request.json()
    const result = await sql`
      INSERT INTO docs (title, content, color, type, user_id, folder_id)
      VALUES (${title}, ${content}, ${color}, ${type}, ${payload.userId}, ${folder_id})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create doc:', error)
    return NextResponse.json({ error: 'Failed to create doc' }, { status: 500 })
  }
}
