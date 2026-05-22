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

        // Build collections: one per label
        const built: Collection[] = labels.map((label: Label) => ({
          label,
          docs: docs.filter((d: Doc) =>
            d.labels.some(l => l.id === label.id)
          ),
        })).filter(c => c.docs.length > 0)

        // Docs with no labels at all
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

  // Determine card size based on doc count
  function cardSize(count: number) {
    if (count >= 8) return 'col-span-2 row-span-2'
    if (count >= 4) return 'col-span-2 row-span-1'
    return 'col-span-1 row-span-1'
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#111]">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        onNewNote={handleNewDoc}
      />

      <main className="flex-1 overflow-y-auto">
        {/* Topbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-8 h-[44px] border-b border-white/6 bg-[#111]">
          <span className="text-[13px] font-medium text-white/60">Library</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/5 border border-white/8">
              <Search size={11} className="text-white/30" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search labels..."
                className="bg-transparent text-xs text-white/60 placeholder:text-white/20 focus:outline-none w-32"
              />
            </div>
          </div>
        </div>

        <div className="px-8 py-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-xs text-white/20">Loading...</span>
            </div>
          ) : collections.length === 0 && unlabeled.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                <FileText size={20} className="text-white/20" />
              </div>
              <p className="text-sm text-white/30">No docs yet</p>
              <button
                onClick={handleNewDoc}
                className="text-xs text-white/40 hover:text-white/60 transition-colors underline underline-offset-2"
              >
                Create your first doc
              </button>
            </div>
          ) : filtered.length === 0 && search ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-xs text-white/20">No results for "{search}"</p>
            </div>
          ) : (
            <>
              {/* Collections grid */}
              {filtered.length > 0 && (
                <>
                  <p className="text-[10px] font-medium text-white/20 uppercase tracking-wider mb-4">
                    Collections · {filtered.length}
                  </p>
                  <div className="grid grid-cols-3 gap-3 auto-rows-auto mb-10">
                    {filtered.map(({ label, docs }) => (
                      <div
                        key={label.id}
                        className={`${cardSize(docs.length)} rounded-2xl border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-5 flex flex-col gap-3 cursor-default`}
                      >
                        {/* Label header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: label.color }}
                            />
                            <span className="text-[13px] font-semibold text-white/80">{label.name}</span>
                          </div>
                          <span className="text-[11px] text-white/25">{docs.length} doc{docs.length !== 1 ? 's' : ''}</span>
                        </div>

                        {/* Colored top accent */}
                        <div
                          className="h-px w-full rounded-full opacity-40"
                          style={{ backgroundColor: label.color }}
                        />

                        {/* Doc list */}
                        <div className="flex flex-col gap-1.5">
                          {docs.slice(0, 5).map(doc => (
                            <button
                              key={doc.uuid}
                              onClick={() => router.push(`/docs/${doc.uuid}`)}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-colors text-left group"
                            >
                              <span className="text-[12px] text-white/50 group-hover:text-white/70 truncate transition-colors">
                                {doc.title || 'Untitled'}
                              </span>
                              <span className="text-[10px] text-white/20 shrink-0">
                                {timeAgo(doc.updated_at)}
                              </span>
                            </button>
                          ))}
                          {docs.length > 5 && (
                            <p className="text-[11px] text-white/20 px-2.5 pt-1">
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
                  <p className="text-[10px] font-medium text-white/20 uppercase tracking-wider mb-4">
                    Unlabeled · {unlabeled.length}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-3 rounded-2xl border border-white/6 bg-white/[0.02] p-5 flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        {unlabeled.map(doc => (
                          <button
                            key={doc.uuid}
                            onClick={() => router.push(`/docs/${doc.uuid}`)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-colors group"
                          >
                            <FileText size={10} className="text-white/20" />
                            <span className="text-[12px] text-white/40 group-hover:text-white/60 transition-colors">
                              {doc.title || 'Untitled'}
                            </span>
                          </button>
                        ))}
                      </div>
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
