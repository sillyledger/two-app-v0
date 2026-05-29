'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function AcceptInviteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (token) {
      setStatus('ready')
    } else {
      setErrorMessage('Invalid invite link.')
      setStatus('error')
    }
  }, [token])

  async function handleAccept() {
    setStatus('accepting')
    try {
      const res = await fetch('/api/workspaces/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await res.json()

      if (res.status === 401) {
        router.push(`/login?redirect=/accept-invite%3Ftoken%3D${token}`)
        return
      }

      if (!res.ok) {
        setErrorMessage(data.error || 'Something went wrong.')
        setStatus('error')
        return
      }

      router.push('/')
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: '12px',
        padding: '40px',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
      }}>
        {status === 'loading' && (
          <p style={{ color: '#888', fontSize: '15px' }}>Loading...</p>
        )}

        {status === 'ready' && (
          <>
            <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>
              You've been invited
            </h1>
            <p style={{ color: '#888', fontSize: '15px', marginBottom: '32px' }}>
              Click below to accept your invite and join the workspace.
            </p>
            <button
              onClick={handleAccept}
              style={{
                background: '#fff',
                color: '#0f0f0f',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 28px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Accept invite
            </button>
          </>
        )}

        {status === 'accepting' && (
          <p style={{ color: '#888', fontSize: '15px' }}>Joining workspace...</p>
        )}

        {status === 'error' && (
          <>
            <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#f87171', fontSize: '15px' }}>{errorMessage}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        background: '#0f0f0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p style={{ color: '#888', fontSize: '15px', fontFamily: 'DM Sans, sans-serif' }}>Loading...</p>
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  )
}
