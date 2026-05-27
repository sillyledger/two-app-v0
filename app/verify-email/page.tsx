'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#161618', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 24px' }}>

        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px', color: '#e8e8e8' }}>TWO</span>
        </div>

        {/* Card */}
        <div style={{ backgroundColor: '#1e1e20', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>

          {/* Icon */}
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(83,74,183,0.15)', border: '1px solid rgba(83,74,183,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '22px' }}>
            ✉️
          </div>

          <h1 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '600', color: '#e8e8e8' }}>Check your inbox</h1>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#a0a0a0', lineHeight: '1.6' }}>
            We sent a verification link to
          </p>

          {email && (
            <p style={{ margin: '0 0 20px', fontSize: '14px', fontWeight: '600', color: '#e8e8e8' }}>
              {email}
            </p>
          )}

          <p style={{ margin: '0 0 28px', fontSize: '13px', color: '#606060', lineHeight: '1.6' }}>
            Click the link in the email to activate your account. It expires in 24 hours.
          </p>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
            <p style={{ margin: '0', fontSize: '13px', color: '#606060' }}>
              Already verified?{' '}
              <a href="/login" style={{ color: '#e8e8e8', textDecoration: 'underline' }}>Log in</a>
            </p>
          </div>
        </div>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#606060' }}>
          Wrong email?{' '}
          <a href="/signup" style={{ color: '#a0a0a0', textDecoration: 'underline' }}>Sign up again</a>
        </p>

      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}
