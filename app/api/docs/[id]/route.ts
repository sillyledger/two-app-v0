import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const result = await sql`
      SELECT docs.*, folders.name AS folder_name, folders.id AS folder_uuid
      FROM docs
      LEFT JOIN folders ON folders.id::text = docs.folder_id::text
      WHERE docs.uuid = ${id} AND docs.user_id = ${payload.userId} AND docs.deleted_at IS NULL
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
    }
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to fetch doc:', error)
    return NextResponse.json({ error: 'Failed to fetch doc' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json()
    const { title, content, color, is_starred, type, folder_id, priority } = body
    if (folder_id !== undefined) {
      const result = await sql`
        UPDATE docs
        SET folder_id = ${folder_id},
            updated_at = CURRENT_TIMESTAMP
        WHERE uuid = ${id} AND user_id = ${payload.userId}
        RETURNING *
      `
      if (result.length === 0) {
        return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
      }
      return NextResponse.json(result[0])
    }
    const result = await sql`
      UPDATE docs 
      SET 
        title = COALESCE(${title ?? null}, title),
        content = COALESCE(${content ?? null}, content),
        color = COALESCE(${color ?? null}, color),
        is_starred = COALESCE(${is_starred ?? null}, is_starred),
        type = COALESCE(${type ?? null}, type),
        priority = COALESCE(${priority ?? null}, priority),
        updated_at = CURRENT_TIMESTAMP
      WHERE uuid = ${id} AND user_id = ${payload.userId}
      RETURNING *
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
    }
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to update doc:', error)
    return NextResponse.json({ error: 'Failed to update doc' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const { is_public } = await request.json()
    const result = await sql`
      UPDATE docs
      SET is_public = ${is_public},
          updated_at = CURRENT_TIMESTAMP
      WHERE uuid = ${id} AND user_id = ${payload.userId}
      RETURNING *
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
    }
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to update doc:', error)
    return NextResponse.json({ error: 'Failed to update doc' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const result = await sql`
      UPDATE docs
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE uuid = ${id} AND user_id = ${payload.userId}
      RETURNING *
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete doc:', error)
    return NextResponse.json({ error: 'Failed to update doc' }, { status: 500 })
  }
}
