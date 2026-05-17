import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { createToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { getOrCreateWorkspace } from '@/lib/workspaces'

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

      const result = await sql`
        INSERT INTO users (email, password)
        VALUES (${email}, ${password})
        RETURNING *
      `
      const user = result[0]
      await getOrCreateWorkspace(user.id, email.split('@')[0])
      const token = await createToken(user.id, user.email)
      const cookieStore = await cookies()
      cookieStore.set('auth-token', token, { httpOnly: true, maxAge: 604800 })
      return NextResponse.json({ success: true })
    }

    if (action === 'login') {
      const result = await sql`
        SELECT * FROM users WHERE email = ${email} AND password = ${password}
      `
      if (result.length === 0) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }
      const user = result[0]
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
