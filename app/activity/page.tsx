'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'

type FilterTab = 'all' | 'created' | 'edited'

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

function isCreated(doc: any): boolean {
  return Math.abs(new Date(doc.updated_at).getTime() - new Date(doc.created_at).getTime()) < 5000
}

export default function ActivityPage() {
  const router = useRouter()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

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

  const createdDocs = docs.filter(d => isCreated(d))
  const editedDocs = docs.filter(d => !isCreated(d))

  const filteredDocs =
    activeTab === 'created' ? createdDocs :
    activeTab === 'edited' ? editedDocs :
    docs

  const grouped = groupByDay(filteredDocs)
  const days = Object.keys(grouped)

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: docs.length },
    { key: 'created', label: 'Created', count: createdDocs.length },
    { key: 'edited', label: 'Edited', count: editedDocs.length },
  ]

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => {
          const next = !collapsed
          setCollapsed(next)
          localStorage.setItem('sidebar-collapsed', String(next))
        }}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-10 py-12">

          <div className="mb-8">
            <h1 className="text-[32px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Activity
            </h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Everything you've touched in the last 30 days
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-8">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 px-3.5 py-[5px] rounded-full text-[13px] font-medium transition-colors"
                style={{
                  backgroundColor: activeTab === tab.key ? 'var(--text-primary)' : 'var(--bg-secondary)',
                  color: activeTab === tab.key ? 'var(--bg)' : 'var(--text-secondary)',
                  border: activeTab === tab.key ? '1px solid transparent' : '1px solid var(--border)',
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="text-[11px]" style={{ opacity: 0.6 }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading && (
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading...</p>
          )}

          {!loading && days.length === 0 && (
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No activity yet.</p>
          )}

          {!loading && days.length > 0 && (
            <div className="space-y-8">
              {days.map((day) => (
                <div key={day}>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wider mb-2 px-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {day}
                  </p>
                  <div>
                    {grouped[day].map((doc: any) => {
                      const created = isCreated(doc)
                      return (
                        <Link
                          key={doc.uuid}
                          href={`/docs/${doc.uuid}`}
                          className="flex items-center justify-between px-4 py-[10px] rounded-lg transition-colors"
                          style={{ color: 'inherit' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="text-[11px] font-medium px-2 py-0.5 rounded-md w-[52px] text-center shrink-0"
                              style={
                                created
                                  ? { backgroundColor: 'var(--bg-success, #dcfce7)', color: 'var(--text-success, #16a34a)' }
                                  : { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }
                              }
                            >
                              {created ? 'created' : 'edited'}
                            </span>
                            <span
                              className="text-[13px] truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {doc.title || 'Untitled'}
                            </span>
                          </div>
                          <span
                            className="text-[12px] shrink-0 ml-4"
                            style={{ color: 'var(--text-muted)' }}
                          >
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
