'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { FileText, Search, Plus } from 'lucide-react'

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
  const [allDocs, setAllDocs] = useState<Doc[]>([])
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
        setAllDocs(docs)
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

  // Most recently updated doc
  const mostRecent = allDocs.length > 0
    ? [...allDocs].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
    : null

  // Docs created in the last 7 days, bucketed by day
  const docsThisWeek = (() => {
    const buckets = [0, 0, 0, 0, 0, 0, 0]
    const now = new Date()
    allDocs.forEach(d => {
      const diff = Math.floor((now.getTime() - new Date(d.created_at).getTime()) / 86400000)
      if (diff >= 0 && diff < 7) buckets[6 - diff]++
    })
    return buckets
  })()

  const maxBucket = Math.max(...docsThisWeek, 1)

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
          className="sticky top-0 z-10 h-[44px] flex items-center"
          style={{
            backgroundColor: 'var(--bg)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="max-w-5xl mx-auto px-10 w-full flex items-center justify-between">
            <span
              className="page-title text-[15px]"
              style={{ color: 'var(--text-primary)' }}
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
                  style={{ color: 'var(--text-secondary)' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-10 py-10">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Loading...
              </span>
            </div>
          ) : (
            <>
              {/* ── BENTO GRID ── */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(12, 1fr)',
                  gridAutoRows: '88px',
                  gap: '10px',
                  marginBottom: '40px',
                }}
              >
                {/* Hero — most recent doc, spans 7 cols × 2 rows */}
                <div
                  onClick={() => mostRecent && router.push(`/docs/${mostRecent.uuid}`)}
                  style={{
                    gridColumn: '1 / 8',
                    gridRow: '1 / 3',
                    borderRadius: '14px',
                    border: '1px solid var(--border)',
                    borderTop: '3px solid #7F77DD',
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '20px 22px',
                    cursor: mostRecent ? 'pointer' : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    overflow: 'hidden',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <span style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        backgroundColor: '#1D9E75', display: 'inline-block', flexShrink: 0,
                      }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                        Most recent
                      </span>
                    </div>
                    <div style={{
                      fontSize: '17px', fontWeight: 500,
                      color: 'var(--text-primary)', lineHeight: 1.35,
                      maxWidth: '340px',
                    }}>
                      {mostRecent ? (mostRecent.title || 'Untitled') : 'No documents yet'}
                    </div>
                    {mostRecent && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                        Updated {timeAgo(mostRecent.updated_at)}
                      </div>
                    )}
                  </div>
                  {mostRecent && mostRecent.labels.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {mostRecent.labels.slice(0, 3).map(l => (
                        <span key={l.id} style={{
                          fontSize: '11px', padding: '3px 9px',
                          borderRadius: '99px',
                          backgroundColor: l.color + '22',
                          color: l.color,
                          border: `1px solid ${l.color}44`,
                        }}>
                          {l.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stat — total docs */}
                <div style={{
                  gridColumn: '8 / 10', gridRow: '1 / 2',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  borderTop: '3px solid #1D9E75',
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '16px 18px',
                }}>
                  <div style={{ fontSize: '30px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {allDocs.length}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '5px' }}>
                    Total documents
                  </div>
                </div>

                {/* Stat — collections */}
                <div style={{
                  gridColumn: '10 / 13', gridRow: '1 / 2',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  borderTop: '3px solid #D85A30',
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '16px 18px',
                }}>
                  <div style={{ fontSize: '30px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {collections.length}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '5px' }}>
                    Collections
                  </div>
                </div>

                {/* Mini chart — docs created this week */}
                <div style={{
                  gridColumn: '8 / 13', gridRow: '2 / 3',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                    Docs created this week
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '36px' }}>
                    {docsThisWeek.map((count, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          borderRadius: '2px',
                          backgroundColor: i === 6 ? '#7F77DD' : 'var(--border)',
                          height: `${Math.max(12, (count / maxBucket) * 100)}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Doc card — most recent labeled doc */}
                {collections[0] && collections[0].docs[0] ? (
                  <div
                    onClick={() => router.push(`/docs/${collections[0].docs[0].uuid}`)}
                    style={{
                      gridColumn: '1 / 5', gridRow: '3 / 4',
                      borderRadius: '14px',
                      border: '1px solid var(--border)',
                      borderTop: `3px solid ${collections[0].label.color}`,
                      backgroundColor: 'var(--bg-secondary)',
                      padding: '16px 18px',
                      cursor: 'pointer',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      {collections[0].label.name}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                      {collections[0].docs[0].title || 'Untitled'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      {timeAgo(collections[0].docs[0].updated_at)}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    gridColumn: '1 / 5', gridRow: '3 / 4',
                    borderRadius: '14px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '16px 18px',
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Document</div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No collections yet</div>
                  </div>
                )}

                {/* Doc card — second collection */}
                {collections[1] && collections[1].docs[0] ? (
                  <div
                    onClick={() => router.push(`/docs/${collections[1].docs[0].uuid}`)}
                    style={{
                      gridColumn: '5 / 9', gridRow: '3 / 4',
                      borderRadius: '14px',
                      border: '1px solid var(--border)',
                      borderTop: `3px solid ${collections[1].label.color}`,
                      backgroundColor: 'var(--bg-secondary)',
                      padding: '16px 18px',
                      cursor: 'pointer',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      {collections[1].label.name}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                      {collections[1].docs[0].title || 'Untitled'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      {timeAgo(collections[1].docs[0].updated_at)}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    gridColumn: '5 / 9', gridRow: '3 / 4',
                    borderRadius: '14px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '16px 18px',
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Template</div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No second collection yet</div>
                  </div>
                )}

                {/* New document CTA */}
                <div
                  onClick={handleNewDoc}
                  style={{
                    gridColumn: '9 / 13', gridRow: '3 / 4',
                    borderRadius: '14px',
                    border: '1px dashed var(--border)',
                    backgroundColor: 'transparent',
                    padding: '16px 18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                  }}
                >
                  <Plus size={18} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>New document</span>
                </div>
              </div>
              {/* ── END BENTO GRID ── */}

              {/* Collections grid */}
              {!loading && collections.length === 0 && unlabeled.length === 0 ? (
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
            </>
          )}
        </div>
      </main>
    </div>
  )
}
