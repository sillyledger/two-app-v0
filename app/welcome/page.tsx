'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function WelcomePage() {
  const router = useRouter()
  const [plan, setPlan] = useState<string | null>(null)
  const [name, setName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setPlan(data.user.plan || 'free')
          setName(data.user.name || '')
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const isFounding = plan === 'founding'
  const isPro = plan === 'pro'

  const accentColor = isFounding ? '#f59e0b' : '#a78bfa'
  const badgeBg = isFounding ? 'rgba(186,117,23,0.15)' : 'rgba(83,74,183,0.15)'
  const badgeBorder = isFounding ? 'rgba(186,117,23,0.4)' : 'rgba(83,74,183,0.4)'
  const planLabel = isFounding ? 'Founding Member' : isPro ? 'Pro' : 'Free'
  const planDesc = isFounding
    ? 'You have lifetime access to everything in TWO. No subscriptions, ever.'
    : 'Your 14-day Pro trial is active. Add a payment method before it ends to keep Pro.'

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#161618', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '20px', height: '20px', border: '2px solid #333', borderTopColor: '#888', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#161618', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', padding: '24px' }}>

      {/* Wordmark */}
      <div style={{ marginBottom: '48px' }}>
        <span style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px', color: '#e8e8e8' }}>TWO</span>
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: '440px', backgroundColor: '#1e1e20', border: '1px solid #2a2a2e', borderRadius: '20px', padding: '40px', textAlign: 'center' }}>

        {/* Success icon */}
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8e8e8', marginBottom: '8px', letterSpacing: '-0.3px' }}>
          {name ? `Welcome, ${name}!` : 'Payment confirmed!'}
        </h1>

        <p style={{ fontSize: '13px', color: '#888', marginBottom: '24px', lineHeight: '1.6' }}>
          Your payment was successful. You now have access to TWO.
        </p>

        {/* Plan badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: badgeBg, border: `1px solid ${badgeBorder}`, borderRadius: '10px', padding: '10px 16px', marginBottom: '24px' }}>
          <span style={{ fontSize: '15px' }}>{isFounding ? '👑' : '✦'}</span>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: accentColor, margin: 0 }}>{planLabel}</p>
            <p style={{ fontSize: '11px', color: '#666', margin: 0, marginTop: '2px' }}>{planDesc}</p>
          </div>
        </div>

        {/* What's included */}
        <div style={{ backgroundColor: '#161618', border: '1px solid #2a2a2e', borderRadius: '12px', padding: '16px', marginBottom: '28px', textAlign: 'left' }}>
          <p style={{ fontSize: '11px', fontWeight: '600', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>What you have access to</p>
          {[
            'Unlimited docs',
            'Unlimited workspaces',
            '10 GB storage',
            isFounding ? 'Lifetime access — no subscription' : 'Priority support',
            'Export to PDF & Markdown',
          ].map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ fontSize: '12px', color: '#aaa' }}>{item}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => router.push('/')}
          style={{ width: '100%', padding: '12px', borderRadius: '10px', backgroundColor: accentColor, color: isFounding ? '#000' : '#fff', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', letterSpacing: '-0.1px' }}
        >
          Start writing →
        </button>
      </div>

      {/* Footer */}
      <p style={{ marginTop: '24px', fontSize: '12px', color: '#444' }}>
        Questions? Email us at <a href="mailto:hello@two.so" style={{ color: '#666', textDecoration: 'none' }}>hello@two.so</a>
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
