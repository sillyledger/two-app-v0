'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupByDay(docs: any[]) {
  const groups: Record<string, any[]> = {}
  for (const doc of docs) {
    const date = new Date(doc.updated_at)
    const key = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(doc)
  }
  return groups
}

export default function ActivityPage() {
  const router = useRouter()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    fetch('/api/activity')
      .then((r) => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.json()
      })
      .then((data) => {
        if (data) setDocs(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  const grouped = groupByDay(docs)
  const days = Object.keys(grouped)

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-2xl mx-auto w-full">
          <div className="mb-8">
            <h1 className="page-title text-3xl" style={{ color: 'var(--text-primary)' }}>Activity</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Everything you've touched in the last 30 days</p>
          </div>

          {loading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
          ) : days.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No activity yet.</p>
          ) : (
            <div className="space-y-8">
              {days.map((day) => (
                <div key={day}>
                  <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>{day}</p>
                  <div className="space-y-1">
                    {grouped[day].map((doc: any) => {
                      const isNew =
                        Math.abs(new Date(doc.updated_at).getTime() - new Date(doc.created_at).getTime()) < 5000
                      return (
                        <Link
                          key={doc.uuid}
                          href={`/docs/${doc.uuid}`}
                          className="flex items-center justify-between px-4 py-3 rounded-lg transition-colors group"
                          style={{ color: 'inherit' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs w-14 shrink-0">
                              {isNew ? (
                                <span className="text-emerald-500 font-medium">created</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>edited</span>
                              )}
                            </span>
                            <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                              {doc.title || 'Untitled'}
                            </span>
                          </div>
                          <span className="text-xs shrink-0 ml-4" style={{ color: 'var(--text-muted)' }}>
                            {timeAgo(doc.updated_at)}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
