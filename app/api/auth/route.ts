import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { createToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { getOrCreateWorkspace } from '@/lib/workspaces'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { email, password, action } = await request.json()

    if (action === 'signup') {
      const existing = await sql`
        SELECT * FROM users WHERE email = ${email}
      `
      if (existing.length > 0) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
      }

      const hashedPassword = await bcrypt.hash(password, 10)
      const verificationToken = crypto.randomBytes(32).toString('hex')

      const result = await sql`
        INSERT INTO users (email, password, email_verified, verification_token, theme)
        VALUES (${email}, ${hashedPassword}, false, ${verificationToken}, 'dark')
        RETURNING *
      `

      const user = result[0]
      await getOrCreateWorkspace(user.id, email.split('@')[0])

      const verifyUrl = `${process.env.APP_URL}/api/verify?token=${verificationToken}`

      await resend.emails.send({
        from: 'TWO <noreply@two.so>',
        to: email,
        subject: 'Verify your TWO account',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px;">Verify your email</h1>
            <p style="font-size: 15px; color: #555; margin-bottom: 32px;">Click the button below to verify your TWO account. This link expires in 24 hours.</p>
            <a href="${verifyUrl}" style="display: inline-block; background: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Verify email address</a>
            <p style="font-size: 13px; color: #999; margin-top: 32px;">If you didn't create a TWO account, you can safely ignore this email.</p>
          </div>
        `,
      })

      // Notify founder of new signup
      await resend.emails.send({
        from: 'TWO <noreply@two.so>',
        to: 'two@strevius.com',
        subject: `New TWO signup: ${email}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px;">New signup 🎉</h1>
            <p style="font-size: 15px; color: #555; margin-bottom: 8px;"><strong>${email}</strong> just signed up for TWO.</p>
            <p style="font-size: 13px; color: #999;">${new Date().toUTCString()}</p>
          </div>
        `,
      })

      return NextResponse.json({ success: true, emailSent: true })
    }

    if (action === 'login') {
      const result = await sql`
        SELECT * FROM users WHERE email = ${email}
      `
      if (result.length === 0) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      const user = result[0]
      const passwordMatch = await bcrypt.compare(password, user.password)
      if (!passwordMatch) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      if (!user.email_verified) {
        return NextResponse.json({ error: 'Please verify your email before logging in. Check your inbox.' }, { status: 403 })
      }

      const token = await createToken(user.id, user.email)
      const cookieStore = await cookies()
      cookieStore.set('auth-token', token, { httpOnly: true, maxAge: 604800 })
      return NextResponse.json({ success: true })
    }

    if (action === 'logout') {
      const cookieStore = await cookies()
      cookieStore.delete('auth-token')
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('auth-token')
  return NextResponse.json({ success: true })
}
