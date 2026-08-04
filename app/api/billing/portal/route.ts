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

  const result = await sql`SELECT email, paddle_customer_id FROM users WHERE id = ${payload.userId}`
  const user = result[0]
  let customerId = user?.paddle_customer_id

  const paddleEnv = process.env.PADDLE_ENVIRONMENT === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com'

  if (!customerId && user?.email) {
    const lookupRes = await fetch(`${paddleEnv}/customers?email=${encodeURIComponent(user.email)}`, {
      headers: { 'Authorization': `Bearer ${process.env.PADDLE_API_KEY}` },
    })
    if (lookupRes.ok) {
      const lookupData = await lookupRes.json()
      const found = lookupData?.data?.[0]?.id
      if (found) {
        customerId = found
        await sql`UPDATE users SET paddle_customer_id = ${found} WHERE id = ${payload.userId}`
      }
    }
  }

  if (!customerId) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
  }

  const res = await fetch(`${paddleEnv}/customers/${customerId}/portal-sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Could not open billing portal' }, { status: 502 })
  }

  const portalData = await res.json()
  const url = portalData?.data?.urls?.general?.overview
  if (!url) {
    return NextResponse.json({ error: 'Could not open billing portal' }, { status: 502 })
  }

  return NextResponse.json({ url })
}
