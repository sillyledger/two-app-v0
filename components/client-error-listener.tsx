"use client"

import { useEffect } from 'react'

export default function ClientErrorListener() {
  useEffect(() => {
    const send = (payload: any) => {
      try {
        fetch('/api/client-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {})
      } catch {}
    }

    const onError = (ev: ErrorEvent) => {
      send({ type: 'error', message: ev.message, filename: ev.filename, lineno: ev.lineno, colno: ev.colno, stack: (ev.error && ev.error.stack) || null })
    }

    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason
      send({ type: 'unhandledrejection', reason: typeof reason === 'string' ? reason : (reason && reason.message) || String(reason), stack: reason && reason.stack })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
