'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 24px' }}>
        <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>
          Reset your password
        </h1>

        {submitted ? (
          <div>
            <p style={{ color: '#888', fontSize: '15px', lineHeight: '1.6' }}>
              If an account exists for <strong style={{ color: '#fff' }}>{email}</strong>, you'll receive a password reset link shortly.
            </p>
            <Link href="/login" style={{ display: 'inline-block', marginTop: '24px', color: '#fff', fontSize: '14px' }}>
              ← Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ color: '#888', fontSize: '15px', marginBottom: '24px' }}>
              Enter your email and we'll send you a reset link.
            </p>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #333',
                background: '#111',
                color: '#fff',
                fontSize: '15px',
                marginBottom: '12px',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#fff',
                color: '#000',
                fontWeight: '600',
                fontSize: '15px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <Link href="/login" style={{ display: 'inline-block', marginTop: '16px', color: '#888', fontSize: '14px' }}>
              ← Back to login
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
