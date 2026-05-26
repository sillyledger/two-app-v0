import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

function getPlanFromPriceId(priceId: string): string {
  if (priceId === process.env.PADDLE_FOUNDING_PRICE_ID) return 'founding'
  if (priceId === process.env.PADDLE_PRO_PRICE_ID) return 'pro'
  return 'free'
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('paddle-signature')

  if (!signature || !process.env.PADDLE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify signature
  const secret = process.env.PADDLE_WEBHOOK_SECRET
  const [tsPart, h1Part] = signature.split(';')
  const ts = tsPart?.replace('ts=', '')
  const h1 = h1Part?.replace('h1=', '')

  const signedPayload = `${ts}:${rawBody}`
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const msgData = encoder.encode(signedPayload)

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  const computedHash = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  if (computedHash !== h1) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)
  const eventType = event.event_type
  const data = event.data

  try {
    if (eventType === 'subscription.activated') {
      const email = data.customer?.email
      const priceId = data.items?.[0]?.price?.id
      const trialEndsAt = data.trial_dates?.ends_at ?? null
      if (email && priceId) {
        const plan = getPlanFromPriceId(priceId)
        await sql`
          UPDATE users SET plan = ${plan}, trial_ends_at = ${trialEndsAt}
          WHERE email = ${email}
        `
      }
    }

    if (eventType === 'transaction.completed') {
      const email = data.customer?.email
      const priceId = data.items?.[0]?.price?.id
      if (email && priceId) {
        const plan = getPlanFromPriceId(priceId)
        await sql`UPDATE users SET plan = ${plan} WHERE email = ${email}`
      }
    }

    if (eventType === 'subscription.canceled') {
      const email = data.customer?.email
      if (email) {
        await sql`UPDATE users SET plan = 'free' WHERE email = ${email}`
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Webhook DB error:', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
