import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

type PaidPlan = 'founding' | 'pro'
type PaddleItem = { price?: { id?: string } }

// Same IDs as app/settings/page.tsx and app/checkout/page.tsx
const PRICE_PLANS: Record<string, PaidPlan> = {
  'pri_01ksjx6e6xtrmq324ama45zyr0': 'founding',
  'pri_01ksjx3b0n6pg6fw44hbq9r03p': 'pro', // Pro Monthly
  'pri_01ksxjysx4n6ewv4dq2mxn5kjr': 'pro', // Pro Annual
}

function getPlanFromPriceIds(priceIds: (string | undefined)[]): PaidPlan | null {
  const plans = priceIds.map(id => (id ? PRICE_PLANS[id] : undefined))
  if (plans.includes('founding')) return 'founding'
  if (plans.includes('pro')) return 'pro'
  return null
}

async function findUserByEmail(email: string): Promise<{ id: string; plan: string } | null> {
  const rows = await sql`SELECT id, plan FROM users WHERE LOWER(email) = LOWER(${email})`
  return (rows[0] as { id: string; plan: string } | undefined) ?? null
}

async function getCustomerEmail(customerId: string): Promise<string | null> {
  const paddleEnv = process.env.PADDLE_ENVIRONMENT === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com'

  const res = await fetch(`${paddleEnv}/customers/${customerId}`, {
    headers: { 'Authorization': `Bearer ${process.env.PADDLE_API_KEY}` },
  })
  if (!res.ok) {
    console.error('Paddle customer lookup failed:', res.status)
    return null
  }
  const json = await res.json()
  return json?.data?.email ?? null
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
      const priceIds: (string | undefined)[] = (data.items ?? []).map((item: PaddleItem) => item.price?.id)
      const plan = getPlanFromPriceIds(priceIds)
      const trialEndsAt = data.trial_dates?.ends_at ?? null
      const customerId = data.customer_id ?? null
      if (!plan) {
        console.error('Paddle webhook: unknown price', { eventType, transactionId: data.id, priceIds })
      } else {
        const email = data.customer?.email ?? (data.customer_id ? await getCustomerEmail(data.customer_id) : null)
        const user = email ? await findUserByEmail(email) : null
        if (!user) {
          console.error('Paddle webhook: no user matched', { eventType, transactionId: data.id, customerId: data.customer_id, email: email ?? null, priceIds })
        } else if (user.plan === 'founding' && plan !== 'founding') {
          console.log('Paddle webhook: skipped, user is founding', { eventType, userId: user.id })
        } else {
          await sql`
            UPDATE users SET plan = ${plan}, trial_ends_at = ${trialEndsAt}, paddle_customer_id = COALESCE(${customerId}, paddle_customer_id)
            WHERE id = ${user.id}
          `
        }
      }
    }

    if (eventType === 'transaction.completed') {
      const priceIds: (string | undefined)[] = (data.items ?? []).map((item: PaddleItem) => item.price?.id)
      const plan = getPlanFromPriceIds(priceIds)
      const customerId = data.customer_id ?? null
      if (!plan) {
        console.error('Paddle webhook: unknown price', { eventType, transactionId: data.id, priceIds })
      } else {
        const email = data.customer?.email ?? (data.customer_id ? await getCustomerEmail(data.customer_id) : null)
        const user = email ? await findUserByEmail(email) : null
        if (!user) {
          console.error('Paddle webhook: no user matched', { eventType, transactionId: data.id, customerId: data.customer_id, email: email ?? null, priceIds })
        } else if (user.plan === 'founding' && plan !== 'founding') {
          console.log('Paddle webhook: skipped, user is founding', { eventType, userId: user.id })
        } else {
          await sql`
            UPDATE users SET plan = ${plan}, paddle_customer_id = COALESCE(${customerId}, paddle_customer_id)
            WHERE id = ${user.id}
          `
        }
      }
    }

    if (eventType === 'subscription.canceled') {
      let user: { id: string; plan: string } | null = null
      if (data.customer_id) {
        const rows = await sql`SELECT id, plan FROM users WHERE paddle_customer_id = ${data.customer_id}`
        user = (rows[0] as { id: string; plan: string } | undefined) ?? null
        if (!user) {
          const email = await getCustomerEmail(data.customer_id)
          if (email) user = await findUserByEmail(email)
        }
      }
      if (!user) {
        console.error('Paddle webhook: no user matched', { eventType, subscriptionId: data.id, customerId: data.customer_id })
      } else if (user.plan !== 'founding') {
        await sql`UPDATE users SET plan = 'free' WHERE id = ${user.id}`
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Webhook DB error:', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
