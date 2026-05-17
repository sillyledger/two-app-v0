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

  // Get current user
  const userResult = await sql`
    SELECT * FROM users WHERE id = ${payload.userId}
  `
  if (userResult.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const user = userResult[0]

  // If trying to change password, verify current one
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
    }
    if (user.password !== currentPassword) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }
    // Update with new password
    const updated = await sql`
      UPDATE users 
      SET name = ${name || user.name}, email = ${email || user.email}, password = ${newPassword}
      WHERE id = ${payload.userId}
      RETURNING id, email, name
    `
    return NextResponse.json({ user: updated[0] })
  }

  // Update name and email only
  const updated = await sql`
    UPDATE users 
    SET name = ${name || user.name}, email = ${email || user.email}
    WHERE id = ${payload.userId}
    RETURNING id, email, name
  `
  return NextResponse.json({ user: updated[0] })
}
