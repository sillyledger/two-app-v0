import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const docs = await sql`
      SELECT * FROM docs
      WHERE user_id = ${payload.userId} AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `
    return NextResponse.json(docs)
  } catch (error) {
    console.error('Failed to fetch trash:', error)
    return NextResponse.json({ error: 'Failed to fetch trash' }, { status: 500 })
  }
}
