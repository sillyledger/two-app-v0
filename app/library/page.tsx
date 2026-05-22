'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { FileText, Search } from 'lucide-react'

interface Label {
  id: number
  name: string
  color: string
}

interface Doc {
  id: number
  uuid: string
  title: string
  updated_at: string
  created_at: string
  labels: Label[]
}

interface Collection {
  label: Label
  docs: Doc[]
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function LibraryPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [unlabeled, setUnlabeled] = useState<Doc[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    fetch('/api/library')
      .then(r => r.json())
      .then(({ labels, docs }) => {
        if (!Array.isArray(labels) || !Array.isArray(docs)) return

        const built: Collection[] = labels.map((label: Label) => ({
          label,
          docs: docs.filter((d: Doc) =>
            d.labels.some(l => l.id === label.id)
          ),
        })).filter(c => c.docs.length > 0)

        const noLabel = docs.filter((d: Doc) => d.labels.length === 0)

        setCollections(built)
        setUnlabeled(noLabel)
        setLoading(false)
      })
  }, [])

  const filtered = collections.filter(c =>
    c.label.name.toLowerCase().includes(search.toLowerCase()) ||
    c.docs.some(d => d.title.toLowerCase().includes(search.toLowerCase()))
  )

  const handleNewDoc = async () => {
    const res = await fetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', content: '', color: 'yellow', type: 'doc' }),
    })
    const doc = await res.json()
    router.push(`/docs/${doc.uuid}`)
  }

  function cardSize(count: number) {
    if (count >= 8) return 'col-span-2 row-span-2'
    if (count >= 4) return 'col-span-2 row-span-1'
    return 'col-span-1 row-span-1'
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        onNewNote={handleNewDoc}
      />

      <main className="flex-1 overflow-y-auto">
        {/* Topbar */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-8 h-[44px]"
          style={{
            backgroundColor: 'var(--bg)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span
            className="text-[13px] font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            Library
          </span>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-2.5 py-1 rounded-md"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              <Search size={11} style={{ color: 'var(--text-muted)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search labels..."
                className="bg-transparent text-xs focus:outline-none w-32"
                style={{ color: 'var(--text-secondary)', }}
              />
            </div>
          </div>
        </div>

        <div className="px-8 py-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Loading...
              </span>
            </div>
          ) : collections.length === 0 && unlabeled.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <FileText size={20} style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No docs yet
              </p>
              <button
                onClick={handleNewDoc}
                className="text-xs underline underline-offset-2 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                Create your first doc
              </button>
            </div>
          ) : filtered.length === 0 && search ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No results for "{search}"
              </p>
            </div>
          ) : (
            <>
              {/* Collections grid */}
              {filtered.length > 0 && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="text-[10px] font-medium uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Collections · {filtered.length}
                    </span>
                    <div
                      className="flex-1 h-px"
                      style={{ backgroundColor: 'var(--border)' }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 auto-rows-auto mb-10">
                    {filtered.map(({ label, docs }) => (
                      <div
                        key={label.id}
                        className={`${cardSize(docs.length)} rounded-2xl p-5 flex flex-col gap-3`}
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderTop: `2px solid ${label.color}`,
                        }}
                      >
                        {/* Label header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: label.color }}
                            />
                            <span
                              className="text-[13px] font-semibold"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {label.name}
                            </span>
                          </div>
                          <span
                            className="text-[11px]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {docs.length} doc{docs.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Doc list */}
                        <div className="flex flex-col gap-1.5">
                          {docs.slice(0, 5).map(doc => (
                            <button
                              key={doc.uuid}
                              onClick={() => router.push(`/docs/${doc.uuid}`)}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors group"
                              style={{
                                backgroundColor: 'var(--bg-tertiary)',
                                border: '1px solid var(--border)',
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.backgroundColor = 'var(--bg)'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                              }}
                            >
                              <span
                                className="text-[12px] truncate transition-colors"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {doc.title || 'Untitled'}
                              </span>
                              <span
                                className="text-[10px] shrink-0"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {timeAgo(doc.updated_at)}
                              </span>
                            </button>
                          ))}
                          {docs.length > 5 && (
                            <p
                              className="text-[11px] px-2.5 pt-1"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              +{docs.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Unlabeled docs */}
              {unlabeled.length > 0 && !search && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="text-[10px] font-medium uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Unlabeled · {unlabeled.length}
                    </span>
                    <div
                      className="flex-1 h-px"
                      style={{ backgroundColor: 'var(--border)' }}
                    />
                  </div>

                  <div
                    className="rounded-2xl p-5"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div className="flex flex-wrap gap-2">
                      {unlabeled.map(doc => (
                        <button
                          key={doc.uuid}
                          onClick={() => router.push(`/docs/${doc.uuid}`)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors"
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = 'var(--bg)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                          }}
                        >
                          <FileText size={10} style={{ color: 'var(--text-muted)' }} />
                          <span className="text-[12px]">
                            {doc.title || 'Untitled'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
