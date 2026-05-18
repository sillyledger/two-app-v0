import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await sql`
      UPDATE docs
      SET deleted_at = NULL
      WHERE id = ${params.id} AND user_id = ${payload.userId}
    `
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to restore doc:', error)
    return NextResponse.json({ error: 'Failed to restore doc' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await sql`
      DELETE FROM docs
      WHERE id = ${params.id} AND user_id = ${payload.userId}
    `
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to permanently delete doc:', error)
    return NextResponse.json({ error: 'Failed to permanently delete doc' }, { status: 500 })
  }
}
