import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function PUT(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, currentPassword, newPassword, theme, fontSize, docWideMode, timezone, dateFormat } = await request.json()

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
    const passwordMatch = await bcrypt.compare(currentPassword, user.password)
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }
    // Update with new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    const updated = await sql`
      UPDATE users
      SET name = ${name || user.name}, email = ${email || user.email}, password = ${hashedPassword}
      WHERE id = ${payload.userId}
      RETURNING id, email, name
    `
    return NextResponse.json({ user: updated[0] })
  }

  // Update name, email, and account-level preferences
  const updated = await sql`
    UPDATE users
    SET name = ${name ?? user.name},
        email = ${email ?? user.email},
        theme = ${theme ?? user.theme},
        font_size = ${fontSize ?? user.font_size},
        doc_wide_mode = ${docWideMode ?? user.doc_wide_mode},
        timezone = ${timezone ?? user.timezone},
        date_format = ${dateFormat ?? user.date_format}
    WHERE id = ${payload.userId}
    RETURNING id, email, name
  `
  return NextResponse.json({ user: updated[0] })
}
