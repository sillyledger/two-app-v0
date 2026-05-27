'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, action: 'signup' }),
    })
    const data = await res.json()

    if (res.ok) {
      router.push(`/verify-email?email=${encodeURIComponent(email)}`)
    } else {
      setError(data.error || 'Signup failed')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#161618', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 24px' }}>

        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px', color: '#e8e8e8' }}>TWO</span>
        </div>

        {/* Card */}
        <div style={{ backgroundColor: '#1e1e20', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '32px' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '600', color: '#e8e8e8' }}>Create your account</h1>
          <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#a0a0a0' }}>A better place to think and write.</p>

          {error && (
            <p style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', fontSize: '13px', color: '#f87171' }}>
              {error}
            </p>
          )}

          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: '#c4c4c4' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{ width: '100%', padding: '10px 12px', backgroundColor: '#242426', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '14px', color: '#e8e8e8', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: '#c4c4c4' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                style={{ width: '100%', padding: '10px 12px', backgroundColor: '#242426', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '14px', color: '#e8e8e8', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '11px', backgroundColor: '#e8e8e8', color: '#161618', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: '#a0a0a0' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: '#e8e8e8', textDecoration: 'underline' }}>Log in</a>
          </p>
        </div>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#606060' }}>
          By signing up you agree to our Terms & Privacy Policy
        </p>
      </div>
    </div>
  )
}
