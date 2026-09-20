'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/sidebar'
import { Search, Plus, Atom } from 'lucide-react'

interface ContentIdea {
  id: number
  uuid: string
  title: string
  type: string | null
  status: 'not_started' | 'in_progress' | 'published'
  platform: string | null
  category: string | null
  doc_uuid: string | null
  created_at: string
}

const STATUS_META: Record<ContentIdea['status'], { label: string; color: string }> = {
  not_started: { label: 'Not started', color: 'var(--text-muted)' },
  in_progress: { label: 'In progress', color: '#e0a44d' },
  published: { label: 'Published', color: '#5dbb7a' },
}

const FONT = "'DM Sans', system-ui, sans-serif"

interface Board {
  id: number
  uuid: string
  name: string
  type: 'canvas'
  created_at: string
}

export default function StudioOverviewPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')

  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [ideasLoading, setIdeasLoading] = useState(true)

  const [boards, setBoards] = useState<Board[]>([])
  const [boardsLoading, setBoardsLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    fetch('/api/content-ideas')
      .then(r => r.json())
      .then(data => setIdeas(Array.isArray(data) ? data : []))
      .catch(() => setIdeas([]))
      .finally(() => setIdeasLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/boards')
      .then(r => r.json())
      .then(data => setBoards(Array.isArray(data) ? data : []))
      .catch(() => setBoards([]))
      .finally(() => setBoardsLoading(false))
  }, [])

  const handleNewIdea = async () => {
    try {
      const res = await fetch('/api/content-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled idea' }),
      })
      if (!res.ok) return
      router.push('/studio/ideas')
    } catch {}
  }

  const handleDocAction = async (idea: ContentIdea) => {
    if (idea.doc_uuid) {
      router.push(`/docs/${idea.doc_uuid}`)
      return
    }
    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: idea.title, content: '', color: 'yellow', type: 'doc' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error === 'free_limit_reached' ? "You've reached the free plan's doc limit." : 'Failed to create doc.')
        return
      }
      const doc = await res.json()
      setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, status: 'in_progress', doc_uuid: doc.uuid } : i))
      fetch(`/api/content-ideas/${idea.uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress', doc_uuid: doc.uuid }),
      }).catch(() => {})
      router.push(`/docs/${doc.uuid}`)
    } catch {}
  }

  const createBoard = async () => {
    const workspaceRes = await fetch('/api/workspace')
    const workspace = await workspaceRes.json()
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Untitled canvas', type: 'canvas', workspace_id: workspace.id }),
    })
    const board = await res.json()
    router.push(`/studio/canvas/${board.uuid}`)
  }

  const trimmedQuery = search.trim().toLowerCase()

  const filteredIdeas = trimmedQuery
    ? ideas.filter(i => i.title.toLowerCase().includes(trimmedQuery))
    : ideas
  const visibleIdeas = trimmedQuery ? filteredIdeas : filteredIdeas.slice(0, 3)

  const filteredBoards = trimmedQuery
    ? boards.filter(b => b.name.toLowerCase().includes(trimmedQuery))
    : boards
  const visibleBoards = trimmedQuery ? filteredBoards : filteredBoards.slice(0, 3)

  const newBtnStyle: React.CSSProperties = {
    fontSize: 12.5, fontWeight: 500, fontFamily: FONT,
    background: 'var(--text-primary)', color: 'var(--bg)', border: 'none',
    borderRadius: 8, padding: '7px 13px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    width: 112,
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1180px] mx-auto px-10 py-10">
          <div className="flex items-center justify-between mb-6 gap-4">
            <div className="relative flex-1" style={{ maxWidth: 420 }}>
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search ideas and boards..."
                className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none placeholder-[var(--text-muted)]"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Ideas section */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, color: 'var(--text-primary)' }}>Ideas</span>
              <span style={{ fontSize: 11.5, fontFamily: FONT, color: 'var(--text-muted)' }}>
                {trimmedQuery ? `${filteredIdeas.length} matching` : `${ideas.length}`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleNewIdea} style={newBtnStyle}>
                <Plus size={12} /> New idea
              </button>
              <Link href="/studio/ideas" style={{ fontSize: 11.5, fontFamily: FONT, color: '#8f89e6', textDecoration: 'none' }}>
                View all →
              </Link>
            </div>
          </div>

          {ideasLoading ? (
            <div className="flex items-center justify-center h-32 mb-10">
              <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: FONT }}>Loading...</span>
            </div>
          ) : visibleIdeas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 mb-10">
              <p style={{ fontSize: 13, fontFamily: FONT, color: 'var(--text-muted)' }}>
                {trimmedQuery ? 'No ideas match your search' : 'No ideas yet'}
              </p>
              <p style={{ fontSize: 11.5, fontFamily: FONT, color: 'var(--text-muted)' }}>
                {trimmedQuery ? 'Try a different search term' : 'Click + New idea to get started'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col mb-10">
              {visibleIdeas.map(idea => (
                <div
                  key={idea.id}
                  onClick={() => router.push('/studio/ideas')}
                  className="cursor-pointer group"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 130px 140px 120px 90px', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', padding: '12px 8px', borderRadius: 8 }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div className="truncate" style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4, fontFamily: FONT, color: '#eeede7' }}>
                    {idea.title}
                  </div>
                  <div className="truncate" style={{ fontSize: 12, fontFamily: FONT, color: 'var(--text-muted)' }}>
                    {idea.platform || '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: FONT, color: STATUS_META[idea.status].color }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: STATUS_META[idea.status].color, flexShrink: 0 }} />
                    {STATUS_META[idea.status].label}
                  </div>
                  {idea.category ? (
                    <span className="truncate" style={{ fontSize: 12, fontFamily: FONT, padding: '3px 10px', borderRadius: 6, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', width: 'fit-content' }}>
                      {idea.category}
                    </span>
                  ) : (
                    <div style={{ fontSize: 12, fontFamily: FONT, color: 'var(--text-muted)' }}>+ Category</div>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleDocAction(idea) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ fontSize: 11, fontFamily: FONT, color: '#8f89e6', background: 'transparent', border: 'none', padding: '5px 8px', whiteSpace: 'nowrap', cursor: 'pointer', textAlign: 'right' }}
                  >
                    {idea.doc_uuid ? 'Open Doc' : 'Turn into Doc'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: 56 }} />

          {/* Canvas section */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, color: 'var(--text-primary)' }}>Canvas</span>
              <span style={{ fontSize: 11.5, fontFamily: FONT, color: 'var(--text-muted)' }}>
                {trimmedQuery ? `${filteredBoards.length} matching` : `${boards.length}`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={createBoard} style={newBtnStyle}>
                <Plus size={12} /> New canvas
              </button>
              <Link href="/studio/canvas" style={{ fontSize: 11.5, fontFamily: FONT, color: '#8f89e6', textDecoration: 'none' }}>
                View all →
              </Link>
            </div>
          </div>

          {boardsLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: FONT }}>Loading...</span>
            </div>
          ) : visibleBoards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <p style={{ fontSize: 13, fontFamily: FONT, color: 'var(--text-muted)' }}>
                {trimmedQuery ? 'No boards match your search' : 'No boards yet'}
              </p>
              <p style={{ fontSize: 11.5, fontFamily: FONT, color: 'var(--text-muted)' }}>
                {trimmedQuery ? 'Try a different search term' : 'Click + New canvas to create your first one'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3.5">
              {visibleBoards.map(board => (
                <div
                  key={board.id}
                  onClick={() => router.push(`/studio/canvas/${board.uuid}`)}
                  className="rounded-xl p-4 flex flex-col justify-between cursor-pointer transition-colors"
                  style={{ backgroundColor: 'var(--bg-secondary)', height: 110 }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                >
                  <Atom size={18} style={{ color: '#c98a5e' }} />
                  <p className="truncate" style={{ fontSize: 14, fontWeight: 500, fontFamily: FONT, color: 'var(--text-primary)' }}>{board.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
