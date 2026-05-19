import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    // Check if user exists
    const result = await sql`
      SELECT * FROM users WHERE email = ${email}
    `

    // Always return success even if email not found (security best practice)
    if (result.length === 0) {
      return NextResponse.json({ success: true })
    }

    const user = result[0]

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex')

    // Set expiry to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    // Delete any existing reset tokens for this user
    await sql`
      DELETE FROM reset_tokens WHERE user_id = ${user.id}
    `

    // Save the new token
    await sql`
      INSERT INTO reset_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${token}, ${expiresAt})
    `

    // Send the email via Resend
    const resetUrl = `https://app.two.so/reset-password?token=${token}`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'TWO <noreply@two.so>',
        to: email,
        subject: 'Reset your TWO password',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Reset your password</h2>
            <p>Click the link below to reset your TWO password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Reset Password</a>
            <p style="margin-top: 24px; color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      }),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
