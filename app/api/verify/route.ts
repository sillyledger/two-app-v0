import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(`${process.env.APP_URL}/login?error=invalid-token`)
  }

  try {
    const result = await sql`
      SELECT * FROM users WHERE verification_token = ${token}
    `

    if (result.length === 0) {
      return NextResponse.redirect(`${process.env.APP_URL}/login?error=invalid-token`)
    }

    const user = result[0]

    if (user.email_verified) {
      return NextResponse.redirect(`${process.env.APP_URL}/login?verified=already`)
    }

    await sql`
      UPDATE users
      SET email_verified = true, verification_token = null
      WHERE id = ${user.id}
    `

    return NextResponse.redirect(`${process.env.APP_URL}/login?verified=true`)

  } catch (error) {
    console.error('Verify error:', error)
    return NextResponse.redirect(`${process.env.APP_URL}/login?error=server-error`)
  }
}
