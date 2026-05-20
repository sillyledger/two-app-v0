import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    console.error('[client-error]', JSON.stringify(body, null, 2))
  } catch (e) {
    console.error('[client-error] failed to parse body', e)
  }

  return NextResponse.json({ received: true })
}
