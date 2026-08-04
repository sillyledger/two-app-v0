'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
import Sidebar from '@/components/sidebar'
import { formatDate, formatDayHeader, dayKey, getUserDatePrefs } from '@/lib/format-date'

type FilterTab = 'all' | 'created' | 'edited'
type SpaceTab = 'all' | 'mine' | 'shared'

const ACCENT_COLORS = [
  "#EF9F27", "#85B7EB", "#5DCAA5", "#F0997B",
  "#AFA9EC", "#97C459", "#ED93B1", "#B4B2A9", "#5DCAA5",
]

function folderDotColor(folderId: string | null) {
  if (!folderId) return null
  let hash = 0
  for (let i = 0; i < folderId.length; i++) hash = (hash * 31 + folderId.charCodeAt(i)) >>> 0
  return ACCENT_COLORS[hash % ACCENT_COLORS.length]
}

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
  const { timezone, dateFormat } = getUserDatePrefs()
  return formatDate(date, dateFormat, timezone)
}

function groupByDay(docs: any[], timezone: string) {
  const groups: Record<string, any[]> = {}
  for (const doc of docs) {
    const key = dayKey(doc.updated_at, timezone)
    if (!groups[key]) groups[key] = []
    groups[key].push(doc)
  }
  return groups
}

function isCreated(doc: any): boolean {
  return Math.abs(new Date(doc.updated_at).getTime() - new Date(doc.created_at).getTime()) < 5000
}

function initials(name: string | null | undefined): string {
  if (!name) return 'Y'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? 'Y'
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

export default function ActivityPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [spaceTab, setSpaceTab] = useState<SpaceTab>('all')

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
        if (data) setEntries(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  const createdEntries = entries.filter(e => isCreated(e))
  const editedEntries = entries.filter(e => !isCreated(e))

  const tabFiltered =
    activeTab === 'created' ? createdEntries :
    activeTab === 'edited' ? editedEntries :
    entries

  const spaceFiltered =
    spaceTab === 'mine' ? tabFiltered.filter(e => !e.is_shared) :
    spaceTab === 'shared' ? tabFiltered.filter(e => e.is_shared) :
    tabFiltered

  const { timezone } = getUserDatePrefs()
  const grouped = groupByDay(spaceFiltered, timezone)
  const days = Object.keys(grouped)

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: entries.length },
    { key: 'created', label: 'Created', count: createdEntries.length },
    { key: 'edited', label: 'Edited', count: editedEntries.length },
  ]

  const spaceTabs: { key: SpaceTab; label: string }[] = [
    { key: 'all', label: 'All spaces' },
    { key: 'mine', label: 'My workspace' },
    { key: 'shared', label: 'Shared' },
  ]

  type Row =
    | { kind: 'day'; key: string; label: string }
    | { kind: 'item'; key: string; entry: any }

  const rows: Row[] = []
  for (const day of days) {
    const label = formatDayHeader(grouped[day][0].updated_at, timezone)
    rows.push({ kind: 'day', key: `day-${day}`, label })
    for (const entry of grouped[day]) {
      rows.push({ kind: 'item', key: `${entry.type}-${entry.uuid}`, entry })
    }
  }

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

          <div className="flex items-center justify-between flex-wrap gap-2 mb-8">
            <div className="flex items-center gap-2 flex-wrap">
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

            <div className="flex items-center gap-2 flex-wrap">
              {spaceTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSpaceTab(tab.key)}
                  className="px-3.5 py-[5px] rounded-full text-[13px] font-medium transition-colors"
                  style={{
                    backgroundColor: spaceTab === tab.key ? 'var(--text-primary)' : 'var(--bg-secondary)',
                    color: spaceTab === tab.key ? 'var(--bg)' : 'var(--text-secondary)',
                    border: spaceTab === tab.key ? '1px solid transparent' : '1px solid var(--border)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading...</p>
          )}

          {!loading && days.length === 0 && (
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No activity yet.</p>
          )}

          {!loading && days.length > 0 && (
            <div className="thread" style={{ display: 'flex', flexDirection: 'column' }}>
              {rows.map((row, i) => {
                const isLastRow = i === rows.length - 1

                if (row.kind === 'day') {
                  return (
                    <div key={row.key} style={{ display: 'flex', gap: 14 }}>
                      <div style={{ width: 30, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--text-muted)', flexShrink: 0 }} />
                        {!isLastRow && <span style={{ width: 2, flex: 1, backgroundColor: 'var(--border)', marginTop: 4 }} />}
                      </div>
                      <div style={{ paddingBottom: 10 }}>
                        <p
                          className="text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {row.label}
                        </p>
                      </div>
                    </div>
                  )
                }

                const entry = row.entry
                const created = isCreated(entry)
                const href = entry.type === 'doc' ? `/docs/${entry.uuid}` : `/notes/${entry.uuid}`
                const isYou = entry.is_you === true
                const actorName = isYou ? 'You' : (entry.editor_name ? entry.editor_name.split(' ')[0] : 'Someone')
                const dotColor = entry.type === 'doc' ? folderDotColor(entry.context_id) : entry.context_color

                return (
                  <div key={row.key} style={{ display: 'flex', gap: 14 }}>
                    <div style={{ width: 30, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div
                        style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 600,
                          backgroundColor: isYou ? 'var(--bg-tertiary)' : 'rgba(93,202,165,0.18)',
                          color: isYou ? 'var(--text-muted)' : '#5dcaa5',
                        }}
                      >
                        {initials(entry.editor_name)}
                      </div>
                      {!isLastRow && <span style={{ width: 2, flex: 1, backgroundColor: 'var(--border)', marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: 20 }}>
                      <p className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
                        {actorName} {created ? 'created' : 'edited'}{' '}
                        <Link href={href} className="font-semibold hover:underline" style={{ color: 'var(--text-primary)' }}>
                          {entry.title || 'Untitled'}
                        </Link>
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                        {entry.is_shared ? (
                          <>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#e0b48c', backgroundColor: '#e0b48c1a', borderRadius: 20, padding: '2px 8px' }}>
                              <Users size={10} />
                              {entry.workspace_name}
                            </span>
                            <span>·</span>
                            <span>{timeAgo(entry.updated_at)}</span>
                          </>
                        ) : entry.context_name ? (
                          <>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColor || 'var(--text-muted)', flexShrink: 0 }} />
                            <span>{entry.context_name}</span>
                            <span>·</span>
                            <span>{timeAgo(entry.updated_at)}</span>
                          </>
                        ) : (
                          <span>{timeAgo(entry.updated_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
