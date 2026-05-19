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

  const result = await sql`
    SELECT id, email, name, avatar_url FROM users WHERE id = ${payload.userId}
  `
  if (result.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({ user: result[0] })
}
