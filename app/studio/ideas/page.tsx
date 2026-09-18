'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { Search, Plus, List, LayoutGrid, MoreVertical, Trash2 } from 'lucide-react'

interface ContentIdea {
  id: number
  uuid: string
  title: string
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
const STATUS_ORDER: ContentIdea['status'][] = ['not_started', 'in_progress', 'published']

export default function IdeasPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'board'>('list')

  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [statusMenuId, setStatusMenuId] = useState<number | null>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)

  const [editingField, setEditingField] = useState<{ id: number; field: 'title' | 'platform' | 'category' } | null>(null)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/content-ideas')
      .then(r => r.json())
      .then(data => setIdeas(Array.isArray(data) ? data : []))
      .catch(() => setIdeas([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null) }
    if (menuOpenId !== null) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpenId])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setStatusMenuId(null) }
    if (statusMenuId !== null) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [statusMenuId])

  useEffect(() => {
    if (editingField && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingField])

  const startEdit = (idea: ContentIdea, field: 'title' | 'platform' | 'category') => {
    setMenuOpenId(null)
    setEditValue((idea[field] as string) ?? '')
    setEditingField({ id: idea.id, field })
  }

  const commitEdit = async (idea: ContentIdea) => {
    const field = editingField?.field
    setEditingField(null)
    if (!field) return
    const trimmed = editValue.trim()
    if (field === 'title' && !trimmed) return
    const value = trimmed || null
    if ((idea[field] ?? null) === value) return
    setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, [field]: value } : i))
    try {
      await fetch(`/api/content-ideas/${idea.uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
    } catch {}
  }

  const handleNewIdea = async () => {
    try {
      const res = await fetch('/api/content-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled idea' }),
      })
      if (!res.ok) return
      const idea = await res.json()
      setIdeas(prev => [idea, ...prev])
      setEditValue('Untitled idea')
      setEditingField({ id: idea.id, field: 'title' })
    } catch {}
  }

  const handleSetStatus = async (idea: ContentIdea, status: ContentIdea['status']) => {
    setStatusMenuId(null)
    if (idea.status === status) return
    setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, status } : i))
    try {
      await fetch(`/api/content-ideas/${idea.uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    } catch {}
  }

  const handleDelete = async (idea: ContentIdea) => {
    setMenuOpenId(null)
    if (!window.confirm(`Delete "${idea.title}"?`)) return
    setIdeas(prev => prev.filter(i => i.id !== idea.id))
    try { await fetch(`/api/content-ideas/${idea.uuid}`, { method: 'DELETE' }) } catch {}
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

  const trimmedQuery = search.trim().toLowerCase()
  const filteredIdeas = trimmedQuery
    ? ideas.filter(i =>
        i.title.toLowerCase().includes(trimmedQuery) ||
        (i.platform ?? '').toLowerCase().includes(trimmedQuery) ||
        (i.category ?? '').toLowerCase().includes(trimmedQuery)
      )
    : ideas

  const renderStatusControl = (idea: ContentIdea) => (
    <div style={{ position: 'relative' }} ref={statusMenuId === idea.id ? statusMenuRef : undefined}>
      <button
        onClick={e => { e.stopPropagation(); setStatusMenuId(prev => prev === idea.id ? null : idea.id) }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, color: STATUS_META[idea.status].color, padding: 0 }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: STATUS_META[idea.status].color, flexShrink: 0 }} />
        {STATUS_META[idea.status].label}
      </button>
      {statusMenuId === idea.id && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 0, top: 20, zIndex: 50, width: 140, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '4px 0', overflow: 'hidden', background: '#242428', border: '1px solid rgba(255,255,255,0.09)' }}>
          {STATUS_ORDER.map(s => (
            <button
              key={s}
              onClick={() => handleSetStatus(idea, s)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', fontSize: 12.5, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: STATUS_META[s].color, flexShrink: 0 }} />
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      )}
    </div>
  )

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
                placeholder="Search ideas..."
                className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="flex items-center gap-2.5" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <button
                  onClick={() => setView('list')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', fontSize: 12.5, border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', background: view === 'list' ? 'var(--bg-tertiary)' : 'transparent', color: view === 'list' ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  <List size={14} /> List
                </button>
                <button
                  onClick={() => setView('board')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', fontSize: 12.5, border: 'none', cursor: 'pointer', background: view === 'board' ? 'var(--bg-tertiary)' : 'transparent', color: view === 'board' ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  <LayoutGrid size={14} /> Board
                </button>
              </div>
              <button
                onClick={handleNewIdea}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13.5px] font-medium"
                style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg)' }}
              >
                <Plus size={14} /> New idea
              </button>
            </div>
          </div>

          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {trimmedQuery ? `${filteredIdeas.length} matching ideas` : `${ideas.length} ideas`}
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</span>
            </div>
          ) : filteredIdeas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{trimmedQuery ? 'No ideas match your search' : 'No ideas yet'}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{trimmedQuery ? 'Try a different search term' : 'Click New idea to get started'}</p>
            </div>
          ) : view === 'list' ? (
            <div className="flex flex-col">
              {filteredIdeas.map(idea => (
                <div
                  key={idea.id}
                  className="flex items-center group"
                  style={{ borderBottom: '1px solid var(--border)', padding: '12px 8px', gap: 12, borderRadius: 8 }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>
                    💡
                  </div>

                  {editingField?.id === idea.id && editingField.field === 'title' ? (
                    <input
                      ref={editInputRef}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(idea)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(idea); if (e.key === 'Escape') setEditingField(null) }}
                      style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', padding: '2px 6px' }}
                    />
                  ) : (
                    <div
                      className="truncate"
                      onClick={() => startEdit(idea, 'title')}
                      style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: '#eeede7', cursor: 'text' }}
                    >
                      {idea.title}
                    </div>
                  )}

                  <div style={{ width: 100, flexShrink: 0 }}>{renderStatusControl(idea)}</div>

                  {editingField?.id === idea.id && editingField.field === 'platform' ? (
                    <input
                      ref={editInputRef}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(idea)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(idea); if (e.key === 'Escape') setEditingField(null) }}
                      placeholder="Platform"
                      style={{ width: 110, flexShrink: 0, fontSize: 11, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', padding: '2px 6px' }}
                    />
                  ) : (
                    <div onClick={() => startEdit(idea, 'platform')} style={{ width: 110, flexShrink: 0, fontSize: 11, color: 'var(--text-muted)', cursor: 'text' }} className="truncate">
                      {idea.platform || '+ Platform'}
                    </div>
                  )}

                  {editingField?.id === idea.id && editingField.field === 'category' ? (
                    <input
                      ref={editInputRef}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(idea)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(idea); if (e.key === 'Escape') setEditingField(null) }}
                      placeholder="Category"
                      style={{ width: 90, flexShrink: 0, fontSize: 10.5, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', padding: '2px 6px' }}
                    />
                  ) : idea.category ? (
                    <span onClick={() => startEdit(idea, 'category')} className="truncate" style={{ width: 90, flexShrink: 0, fontSize: 10.5, padding: '2px 8px', borderRadius: 5, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'text' }}>
                      {idea.category}
                    </span>
                  ) : (
                    <div onClick={() => startEdit(idea, 'category')} style={{ width: 90, flexShrink: 0, fontSize: 10.5, color: 'var(--text-muted)', cursor: 'text' }}>+ Category</div>
                  )}

                  <button
                    onClick={() => handleDocAction(idea)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ fontSize: 11, color: '#8f89e6', background: 'transparent', border: 'none', padding: '5px 8px', whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0 }}
                  >
                    {idea.doc_uuid ? 'Open Doc' : 'Turn into Doc'}
                  </button>

                  <div style={{ position: 'relative' }} ref={menuOpenId === idea.id ? menuRef : undefined}>
                    <button
                      onClick={e => { e.stopPropagation(); setMenuOpenId(prev => prev === idea.id ? null : idea.id) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <MoreVertical size={15} />
                    </button>
                    {menuOpenId === idea.id && (
                      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: 30, zIndex: 50, width: 130, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '4px 0', overflow: 'hidden', background: '#242428', border: '1px solid rgba(255,255,255,0.09)' }}>
                        <button
                          onClick={() => handleDelete(idea)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', fontSize: 13, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-5">
              {STATUS_ORDER.map(status => {
                const columnIdeas = filteredIdeas.filter(i => i.status === status)
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-3">
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: STATUS_META[status].color, flexShrink: 0 }} />
                      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{STATUS_META[status].label}</span>
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{columnIdeas.length}</span>
                    </div>
                    {columnIdeas.length === 0 ? (
                      <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No ideas</p>
                    ) : (
                      <div className="flex flex-col" style={{ gap: 10 }}>
                        {columnIdeas.map(idea => (
                          <div key={idea.id} className="group" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                            {editingField?.id === idea.id && editingField.field === 'title' ? (
                              <input
                                ref={editInputRef}
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={() => commitEdit(idea)}
                                onKeyDown={e => { if (e.key === 'Enter') commitEdit(idea); if (e.key === 'Escape') setEditingField(null) }}
                                style={{ width: '100%', fontSize: 12.5, fontWeight: 500, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', padding: '2px 6px', marginBottom: 8 }}
                              />
                            ) : (
                              <div onClick={() => startEdit(idea, 'title')} style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 8, cursor: 'text', lineHeight: 1.4 }}>{idea.title}</div>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {idea.platform && <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 5, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{idea.platform}</span>}
                                {idea.category && <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 5, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{idea.category}</span>}
                              </div>
                              <button
                                onClick={() => handleDocAction(idea)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ fontSize: 10.5, color: '#8f89e6', background: 'transparent', border: 'none', padding: 0, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0 }}
                              >
                                {idea.doc_uuid ? 'Open Doc' : '→ Doc'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
