'use client'
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function CheckoutContent() {
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') ?? ''
  const email = searchParams.get('email') ?? ''

  const priceId = plan === 'founding'
    ? 'pri_01ksjx6e6xtrmq324ama45zyr0'
    : 'pri_01ksjx3b0n6pg6fw44hbq9r03p'

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    script.onload = () => {
      const Paddle = (window as any).Paddle
      Paddle.Environment.set('production')
      Paddle.Initialize({ token: 'live_5d79c55970d6730fce490b94bc1' })
      Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: email ? { email } : undefined,
      })
    }
    document.head.appendChild(script)
  }, [])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#161618', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px', color: '#e8e8e8' }}>TWO</span>
        <p style={{ marginTop: '16px', fontSize: '14px', color: '#a0a0a0' }}>Opening checkout...</p>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutContent />
    </Suspense>
  )
}
