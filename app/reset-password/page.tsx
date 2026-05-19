'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new one.')
    }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Something went wrong.')
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/login'), 3000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 24px' }}>
        <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>
          Set a new password
        </h1>

        {success ? (
          <div>
            <p style={{ color: '#888', fontSize: '15px', lineHeight: '1.6' }}>
              Your password has been reset. Redirecting you to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ color: '#888', fontSize: '15px', marginBottom: '24px' }}>
              Choose a new password for your account.
            </p>

            {error && (
              <p style={{ color: '#ff4444', fontSize: '14px', marginBottom: '12px' }}>
                {error}
              </p>
            )}

            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
              {loading ? 'Saving...' : 'Set new password'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
