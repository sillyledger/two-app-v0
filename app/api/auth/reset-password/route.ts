import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    // Find the token in the database
    const result = await sql`
      SELECT * FROM reset_tokens WHERE token = ${token}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
    }

    const resetToken = result[0]

    // Check if token has expired
    if (new Date() > new Date(resetToken.expires_at)) {
      await sql`DELETE FROM reset_tokens WHERE token = ${token}`
      return NextResponse.json({ error: 'Reset link has expired' }, { status: 400 })
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update the user's password
    await sql`
      UPDATE users SET password = ${hashedPassword} WHERE id = ${resetToken.user_id}
    `

    // Delete the used token
    await sql`
      DELETE FROM reset_tokens WHERE token = ${token}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
