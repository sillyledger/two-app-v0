'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { Search, Plus, List, LayoutGrid, MoreVertical, Trash2, Pencil } from 'lucide-react'
import PusherJS from 'pusher-js'

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
const STATUS_ORDER: ContentIdea['status'][] = ['not_started', 'in_progress', 'published']

const TYPE_META: Record<string, { label: string; color: string }> = {
  post: { label: 'Post', color: '#8f89e6' },
  audio: { label: 'Audio', color: '#c98a5e' },
  video: { label: 'Video', color: '#e0687a' },
  other: { label: 'Other', color: 'var(--text-muted)' },
}
const TYPE_ORDER = ['post', 'audio', 'video', 'other']

const GRID_COLS = '1fr 110px 130px 120px 110px 120px 26px'

const FONT = "'DM Sans', system-ui, sans-serif"

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
  const [typeMenuId, setTypeMenuId] = useState<number | null>(null)
  const typeMenuRef = useRef<HTMLDivElement>(null)

  const [editingField, setEditingField] = useState<{ id: number; field: 'title' | 'platform' | 'category' } | null>(null)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const [renamingSuggestion, setRenamingSuggestion] = useState<{ field: 'platform' | 'category'; value: string } | null>(null)
  const [renameSuggestionValue, setRenameSuggestionValue] = useState('')
  const renameSuggestionInputRef = useRef<HTMLInputElement>(null)
  const fieldEditWrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/content-ideas')
      .then(r => r.json())
      .then(data => setIdeas(Array.isArray(data) ? data : []))
      .catch(() => setIdeas([]))
      .finally(() => setLoading(false))
  }, [])

  const linkedDocUuidsKey = Array.from(new Set(ideas.map(i => i.doc_uuid).filter(Boolean))).sort().join(',')

  useEffect(() => {
    if (!linkedDocUuidsKey) return

    const docUuids = linkedDocUuidsKey.split(',')
    const pusher = new PusherJS(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    })

    const channels = docUuids.map(docUuid => {
      const channel = pusher.subscribe(`doc-${docUuid}`)
      channel.bind('updated', () => {
        fetch('/api/content-ideas')
          .then(r => r.json())
          .then(data => setIdeas(Array.isArray(data) ? data : []))
          .catch(() => {})
      })
      return channel
    })

    return () => {
      channels.forEach((channel, i) => {
        channel.unbind_all()
        pusher.unsubscribe(`doc-${docUuids[i]}`)
      })
      pusher.disconnect()
    }
  }, [linkedDocUuidsKey])

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
    const h = (e: MouseEvent) => { if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) setTypeMenuId(null) }
    if (typeMenuId !== null) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [typeMenuId])

  useEffect(() => {
    if (editingField && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingField])

  useEffect(() => {
    if (renamingSuggestion && renameSuggestionInputRef.current) {
      renameSuggestionInputRef.current.focus()
      renameSuggestionInputRef.current.select()
    }
  }, [renamingSuggestion])

  const startEdit = (idea: ContentIdea, field: 'title' | 'platform' | 'category') => {
    setMenuOpenId(null)
    setEditValue((idea[field] as string) ?? '')
    setEditingField({ id: idea.id, field })
  }

  const commitFieldValue = async (idea: ContentIdea, field: 'title' | 'platform' | 'category', rawValue: string) => {
    setEditingField(null)
    const trimmed = rawValue.trim()
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

  const commitEdit = (idea: ContentIdea) => {
    if (!editingField) return
    commitFieldValue(idea, editingField.field, editValue)
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

  const handleSetType = async (idea: ContentIdea, type: string) => {
    setTypeMenuId(null)
    if (idea.type === type) return
    setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, type } : i))
    try {
      await fetch(`/api/content-ideas/${idea.uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
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

  const handleBulkFieldUpdate = async (field: 'platform' | 'category', from: string, to: string | null) => {
    setIdeas(prev => prev.map(i => (i[field] === from ? { ...i, [field]: to } : i)))
    try {
      await fetch('/api/content-ideas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, from, to }),
      })
    } catch {}
  }

  const handleDeleteSuggestion = (field: 'platform' | 'category', value: string) => {
    if (!window.confirm(`Remove "${value}" from every idea using it?`)) return
    handleBulkFieldUpdate(field, value, null)
  }

  const startRenameSuggestion = (field: 'platform' | 'category', value: string) => {
    setRenameSuggestionValue(value)
    setRenamingSuggestion({ field, value })
  }

  const commitRenameSuggestion = () => {
    if (!renamingSuggestion) return
    const { field, value: from } = renamingSuggestion
    const to = renameSuggestionValue.trim()
    setRenamingSuggestion(null)
    setEditingField(null)
    if (!to || to === from) return
    handleBulkFieldUpdate(field, from, to)
  }

  const trimmedQuery = search.trim().toLowerCase()
  const filteredIdeas = trimmedQuery
    ? ideas.filter(i =>
        i.title.toLowerCase().includes(trimmedQuery) ||
        (i.platform ?? '').toLowerCase().includes(trimmedQuery) ||
        (i.category ?? '').toLowerCase().includes(trimmedQuery) ||
        (i.type ?? '').toLowerCase().includes(trimmedQuery)
      )
    : ideas

  const platformOptions = Array.from(new Set(ideas.map(i => i.platform).filter((v): v is string => !!v))).sort()
  const categoryOptions = Array.from(new Set(ideas.map(i => i.category).filter((v): v is string => !!v))).sort()

  const renderSuggestionDropdown = (idea: ContentIdea, field: 'platform' | 'category', options: string[], top: number) => {
    const suggestions = options.filter(o => o.toLowerCase().includes(editValue.trim().toLowerCase()))
    if (suggestions.length === 0) return null
    return (
      <div onMouseDown={e => e.preventDefault()} style={{ position: 'absolute', left: 0, top, zIndex: 50, minWidth: 170, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '4px 0', overflow: 'hidden', background: '#242428', border: '1px solid rgba(255,255,255,0.09)' }}>
        {suggestions.map(opt => (
          renamingSuggestion?.field === field && renamingSuggestion.value === opt ? (
            <input
              key={opt}
              ref={renameSuggestionInputRef}
              value={renameSuggestionValue}
              onChange={e => setRenameSuggestionValue(e.target.value)}
              onBlur={commitRenameSuggestion}
              onKeyDown={e => { if (e.key === 'Enter') commitRenameSuggestion(); if (e.key === 'Escape') setRenamingSuggestion(null) }}
              style={{ display: 'block', width: 'calc(100% - 16px)', margin: '2px 8px', fontSize: 12.5, fontFamily: FONT, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', padding: '5px 6px' }}
            />
          ) : (
            <div key={opt} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 8px 7px 12px' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <button
                onClick={() => commitFieldValue(idea, field, opt)}
                style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 12.5, fontFamily: FONT, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                className="truncate"
              >
                {opt}
              </button>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: 0.5 }}>
                <button onClick={() => startRenameSuggestion(field, opt)} style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 4 }}>
                  <Pencil size={11} />
                </button>
                <button onClick={() => handleDeleteSuggestion(field, opt)} style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', borderRadius: 4 }}>
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          )
        ))}
      </div>
    )
  }

  const renderStatusControl = (idea: ContentIdea) => (
    <div style={{ position: 'relative' }} ref={statusMenuId === idea.id ? statusMenuRef : undefined}>
      <button
        onClick={e => { e.stopPropagation(); setStatusMenuId(prev => prev === idea.id ? null : idea.id) }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: FONT, color: STATUS_META[idea.status].color, padding: 0 }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: STATUS_META[idea.status].color, flexShrink: 0 }} />
        {STATUS_META[idea.status].label}
      </button>
      {statusMenuId === idea.id && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 0, top: 22, zIndex: 50, width: 140, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '4px 0', overflow: 'hidden', background: '#242428', border: '1px solid rgba(255,255,255,0.09)' }}>
          {STATUS_ORDER.map(s => (
            <button
              key={s}
              onClick={() => handleSetStatus(idea, s)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', fontSize: 12.5, fontFamily: FONT, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
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

  const renderTypeControl = (idea: ContentIdea) => (
    <div style={{ position: 'relative' }} ref={typeMenuId === idea.id ? typeMenuRef : undefined}>
      {idea.type ? (
        <button
          onClick={e => { e.stopPropagation(); setTypeMenuId(prev => prev === idea.id ? null : idea.id) }}
          style={{ fontSize: 12, fontFamily: FONT, padding: 0, background: 'transparent', color: TYPE_META[idea.type]?.color ?? 'var(--text-muted)', border: 'none', cursor: 'pointer' }}
        >
          {TYPE_META[idea.type]?.label ?? idea.type}
        </button>
      ) : (
        <button
          onClick={e => { e.stopPropagation(); setTypeMenuId(prev => prev === idea.id ? null : idea.id) }}
          style={{ fontSize: 12, fontFamily: FONT, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          + Type
        </button>
      )}
      {typeMenuId === idea.id && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: 0, top: 22, zIndex: 50, width: 120, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '4px 0', overflow: 'hidden', background: '#242428', border: '1px solid rgba(255,255,255,0.09)' }}>
          {TYPE_ORDER.map(t => (
            <button
              key={t}
              onClick={() => handleSetType(idea, t)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', fontSize: 12.5, fontFamily: FONT, color: TYPE_META[t].color, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {TYPE_META[t].label}
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
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: FONT }}
              />
            </div>
            <div className="flex items-center gap-2.5" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <button
                  onClick={() => setView('list')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', fontSize: 12.5, fontFamily: FONT, border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', background: view === 'list' ? 'var(--bg-tertiary)' : 'transparent', color: view === 'list' ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  <List size={14} /> List
                </button>
                <button
                  onClick={() => setView('board')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', fontSize: 12.5, fontFamily: FONT, border: 'none', cursor: 'pointer', background: view === 'board' ? 'var(--bg-tertiary)' : 'transparent', color: view === 'board' ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  <LayoutGrid size={14} /> Board
                </button>
              </div>
              <button
                onClick={handleNewIdea}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13.5px] font-medium"
                style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg)', fontFamily: FONT }}
              >
                <Plus size={14} /> New idea
              </button>
            </div>
          </div>

          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)', fontFamily: FONT }}>
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
                  className="group"
                  style={{ display: 'grid', gridTemplateColumns: GRID_COLS, alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', padding: '14px 8px', borderRadius: 8 }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {editingField?.id === idea.id && editingField.field === 'title' ? (
                    <input
                      ref={editInputRef}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(idea)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(idea); if (e.key === 'Escape') setEditingField(null) }}
                      style={{ minWidth: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.4, fontFamily: FONT, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', padding: '2px 6px' }}
                    />
                  ) : (
                    <div
                      className="truncate"
                      onClick={() => startEdit(idea, 'title')}
                      style={{ minWidth: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.4, fontFamily: FONT, color: '#eeede7', cursor: 'text' }}
                    >
                      {idea.title}
                    </div>
                  )}

                  {renderTypeControl(idea)}

                  {editingField?.id === idea.id && editingField.field === 'platform' ? (
                    <div style={{ position: 'relative' }} ref={fieldEditWrapperRef}>
                      <input
                        ref={editInputRef}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={e => { if (fieldEditWrapperRef.current && e.relatedTarget && fieldEditWrapperRef.current.contains(e.relatedTarget as Node)) return; commitEdit(idea) }}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(idea); if (e.key === 'Escape') setEditingField(null) }}
                        placeholder="Platform"
                        style={{ fontSize: 12.5, fontFamily: FONT, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', padding: '2px 6px', width: '100%' }}
                      />
                      {renderSuggestionDropdown(idea, 'platform', platformOptions, 26)}
                    </div>
                  ) : (
                    <div onClick={() => startEdit(idea, 'platform')} style={{ fontSize: 12, fontFamily: FONT, color: 'var(--text-muted)', cursor: 'text' }} className="truncate">
                      {idea.platform || '+ Platform'}
                    </div>
                  )}

                  {renderStatusControl(idea)}

                  {editingField?.id === idea.id && editingField.field === 'category' ? (
                    <div style={{ position: 'relative' }} ref={fieldEditWrapperRef}>
                      <input
                        ref={editInputRef}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={e => { if (fieldEditWrapperRef.current && e.relatedTarget && fieldEditWrapperRef.current.contains(e.relatedTarget as Node)) return; commitEdit(idea) }}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(idea); if (e.key === 'Escape') setEditingField(null) }}
                        placeholder="Category"
                        style={{ fontSize: 12.5, fontFamily: FONT, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', padding: '2px 6px', width: '100%' }}
                      />
                      {renderSuggestionDropdown(idea, 'category', categoryOptions, 26)}
                    </div>
                  ) : idea.category ? (
                    <span onClick={() => startEdit(idea, 'category')} className="truncate" style={{ fontSize: 12, fontFamily: FONT, padding: '3px 10px', borderRadius: 6, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'text', width: 'fit-content' }}>
                      {idea.category}
                    </span>
                  ) : (
                    <div onClick={() => startEdit(idea, 'category')} style={{ fontSize: 12, fontFamily: FONT, color: 'var(--text-muted)', cursor: 'text' }}>+ Category</div>
                  )}

                  <button
                    onClick={() => handleDocAction(idea)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ fontSize: 12, fontFamily: FONT, color: '#8f89e6', background: 'transparent', border: 'none', padding: '5px 8px', whiteSpace: 'nowrap', cursor: 'pointer' }}
                  >
                    {idea.doc_uuid ? 'Open Doc' : 'Turn into Doc'}
                  </button>

                  <div style={{ position: 'relative' }} ref={menuOpenId === idea.id ? menuRef : undefined}>
                    <button
                      onClick={e => { e.stopPropagation(); setMenuOpenId(prev => prev === idea.id ? null : idea.id) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      <MoreVertical size={15} />
                    </button>
                    {menuOpenId === idea.id && (
                      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: 30, zIndex: 50, width: 130, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '4px 0', overflow: 'hidden', background: '#242428', border: '1px solid rgba(255,255,255,0.09)' }}>
                        <button
                          onClick={() => handleDelete(idea)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', fontSize: 13, fontFamily: FONT, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
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
                                style={{ width: '100%', fontSize: 12.5, fontWeight: 500, fontFamily: FONT, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', padding: '2px 6px', marginBottom: 8 }}
                              />
                            ) : (
                              <div onClick={() => startEdit(idea, 'title')} style={{ fontSize: 12.5, fontWeight: 500, fontFamily: FONT, marginBottom: 8, cursor: 'text', lineHeight: 1.4 }}>{idea.title}</div>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {idea.type && <span style={{ fontSize: 12, fontFamily: FONT, padding: '2px 8px', borderRadius: 5, background: 'var(--bg-tertiary)', color: TYPE_META[idea.type]?.color ?? 'var(--text-muted)' }}>{TYPE_META[idea.type]?.label ?? idea.type}</span>}
                                {idea.platform && <span style={{ fontSize: 12, fontFamily: FONT, padding: '2px 8px', borderRadius: 5, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{idea.platform}</span>}
                                {idea.category && <span style={{ fontSize: 12, fontFamily: FONT, padding: '2px 8px', borderRadius: 5, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{idea.category}</span>}
                              </div>
                              <button
                                onClick={() => handleDocAction(idea)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ fontSize: 10.5, fontFamily: FONT, color: '#8f89e6', background: 'transparent', border: 'none', padding: 0, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0 }}
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
