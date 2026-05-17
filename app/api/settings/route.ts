import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function PUT(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, currentPassword, newPassword } = await request.json()

  // Verify current password first
  const userResult = await sql`
    SELECT * FROM users WHERE id = ${payload.userId}
  `
  if (userResult.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  
  const user = userResult[0]

  if (currentPassword && user.password !== currentPassword) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  // Update user
  const updated = await sql`
    UPDATE users SET
      name = COALESCE(${name}, name),
      email = COALESCE(${email}, email),
      password = CASE 
        WHEN ${newPassword} IS NOT NULL AND ${newPassword} != '' 
        THEN ${newPassword} 
        ELSE password 
      END
    WHERE id = ${payload.userId}
    RETURNING id, email, name
  `

  return NextResponse.json({ user: updated[0] })
}
