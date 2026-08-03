'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TEMPLATES } from '@/lib/templates'

function NewDocContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch('/api/auth/me').then(async (authRes) => {
      if (cancelled) return
      if (!authRes.ok) {
        router.push('/login')
        return
      }

      const templateId = searchParams.get('template')
      const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0]

      try {
        const res = await fetch('/api/docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: template.id === 'blank' ? 'Untitled' : template.label,
            content: template.content,
            color: 'yellow',
            type: 'doc',
          }),
        })
        if (!res.ok) throw new Error('Failed to create doc')
        const doc = await res.json()
        if (cancelled) return
        router.replace(`/docs/${doc.uuid}`)
      } catch {
        if (!cancelled) setError(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Something went wrong creating your doc.</p>
          <a
            href="/docs"
            style={{ marginTop: '12px', display: 'inline-block', fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            Back to docs
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" style={{ margin: '0 auto' }} />
        <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>Creating your doc…</p>
      </div>
    </div>
  )
}

export default function NewDocPage() {
  return (
    <Suspense>
      <NewDocContent />
    </Suspense>
  )
}
