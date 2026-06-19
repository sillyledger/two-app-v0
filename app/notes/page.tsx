'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'

interface NoteCategory {
  id: number
  name: string
  color: string
}

interface Note {
  id: number
  uuid: string
  title: string
  content: string | null
  category_id: number | null
  category_name: string | null
  category_color: string | null
  updated_at: string
}

const FONT = "'DM Sans', system-ui, sans-serif"

const SWATCHES = [
  '#7F77DD', '#1D9E75', '#D85A30', '#D4537E',
  '#378ADD', '#639922', '#BA7517', '#E24B4A', '#888890',
]

const SPAN_PATTERN = [
  { col: 2, row: 2 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 2, row: 1 },
  { col: 1, row: 2 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
  { col: 1, row: 1 },
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return hours + 'h ago'
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return days + 'd ago'
  if (days < 30) return Math.floor(days / 7) + 'w ago'
  return Math.floor(days / 30) + 'mo ago'
}

function excerpt(content: string | null) {
  if (!content) return ''
  const text = content.replace(/<[^>]+>/g, '')
  return text.length > 140 ? text.slice(0, 140) + '...' : text
}

export default function NotesPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [categories, setCategories] = useState<NoteCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<number | 'all'>('all')
  const [creating, setCreating] = useState(false)

  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(SWATCHES[0])
  const categoryNameRef = useRef<HTMLInputElement>(null)

  const [openCategoryMenuId, setOpenCategoryMenuId] = useState<number | null>(null)
  const categoryMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) router.push('/login')
      else setAuthChecked(true)
    })
  }, [])

  useEffect(() => {
    if (!authChecked) return
    loadData()
  }, [authChecked])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) setOpenCategoryMenuId(null)
    }
    if (openCategoryMenuId !== null) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [openCategoryMenuId])

  function loadData() {
    setLoading(true)
    Promise.all([
      fetch('/api/notes').then(r => r.json()),
      fetch('/api/note-categories').then(r => r.json()),
    ]).then(([notesData, categoriesData]) => {
      setNotes(Array.isArray(notesData) ? notesData : [])
      setCategories(Array.isArray(categoriesData) ? categoriesData : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  const filtered = activeCategory === 'all'
    ? notes
    : notes.filter(n => n.category_id === activeCategory)

  async function handleNewNote() {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '',
          content: '',
          category_id: activeCategory === 'all' ? null : activeCategory,
        }),
      })
      const note = await res.json()
      router.push(`/notes/${note.uuid}`)
    } finally {
      setCreating(false)
    }
  }

  function openCategoryModal() {
    setNewCategoryName('')
    setNewCategoryColor(SWATCHES[0])
    setShowCategoryModal(true)
    setTimeout(() => categoryNameRef.current?.focus(), 50)
  }

  async function handleCreateCategory() {
    const name = newCategoryName.trim()
    if (!name) { setShowCategoryModal(false); return }
    setShowCategoryModal(false)
    try {
      const res = await fetch('/api/note-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: newCategoryColor }),
      })
      const category = await res.json()
      setCategories(prev => [...prev, category])
    } catch {}
  }

  async function handleDeleteCategory(id: number) {
    setOpenCategoryMenuId(null)
    if (!confirm('Delete this category? Notes inside it will not be deleted — they\'ll just lose their category.')) return
    setCategories(prev => prev.filter(c => c.id !== id))
    setNotes(prev => prev.map(n => n.category_id === id ? { ...n, category_id: null, category_name: null, category_color: null } : n))
    if (activeCategory === id) setActiveCategory('all')
    try { await fetch(`/api/note-categories/${id}`, { method: 'DELETE' }) } catch {}
  }

  if (!authChecked) return null

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => {
          const next = !collapsed
          setCollapsed(next)
          localStorage.setItem('sidebar-collapsed', String(next))
        }}
      />

      <main className="flex-1 overflow-y-auto" style={{ fontFamily: FONT }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 40px' }}>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>Notes</h1>
              <p style={{ fontSize: 13, marginTop: 4, color: 'var(--text-muted)' }}>{notes.length} note{notes.length === 1 ? '' : 's'}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={openCategoryModal}
                style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}
              >
                + New category
              </button>
              <button
                onClick={handleNewNote}
                disabled={creating}
                style={{ background: '#6b5ce7', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.6 : 1, fontFamily: FONT }}
              >
                + New note
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 24 }}>
            <button
              onClick={() => setActiveCategory('all')}
              style={{
                background: activeCategory === 'all' ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                color: 'var(--text-primary)', border: '1px solid var(--border)',
                fontSize: 12, padding: '6px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
              }}
            >
              All
            </button>
            {categories.map(cat => (
              <div key={cat.id} style={{ position: 'relative' }} ref={openCategoryMenuId === cat.id ? categoryMenuRef : undefined}>
                <button
                  onClick={() => setActiveCategory(cat.id)}
                  onContextMenu={e => { e.preventDefault(); setOpenCategoryMenuId(cat.id) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: activeCategory === cat.id ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                    color: 'var(--text-primary)', border: '1px solid var(--border)',
                    fontSize: 12, padding: '6px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                  {cat.name}
                  <span
                    onClick={e => { e.stopPropagation(); setOpenCategoryMenuId(openCategoryMenuId === cat.id ? null : cat.id) }}
                    style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 2, lineHeight: 1 }}
                  >
                    ⋯
                  </span>
                </button>
                {openCategoryMenuId === cat.id && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 9, padding: 4, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 6, padding: '7px 9px', fontSize: 12.5, color: '#E24B4A', cursor: 'pointer', fontFamily: FONT }}
                    >
                      Delete category
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={openCategoryModal}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: 12, padding: '6px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT }}
            >
              + Add category
            </button>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</p>
          ) : filtered.length === 0 ? (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 14, padding: '60px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 14 }}>No notes yet</p>
              <button
                onClick={handleNewNote}
                disabled={creating}
                style={{ background: '#6b5ce7', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: creating ? 'default' : 'pointer', fontFamily: FONT }}
              >
                + New note
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: 148, gap: 14, gridAutoFlow: 'dense' }}>
              {filtered.map((note, i) => {
                const span = SPAN_PATTERN[i % SPAN_PATTERN.length]
                const wide = span.col > 1 || span.row > 1
                return (
                  <div
                    key={note.uuid}
                    onClick={() => router.push(`/notes/${note.uuid}`)}
                    style={{
                      gridColumn: 'span ' + span.col, gridRow: 'span ' + span.row,
                      background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14,
                      padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      cursor: 'pointer', minWidth: 0,
                    }}
                  >
                    <div>
                      {note.category_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: note.category_color || '#888890', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: note.category_color || 'var(--text-muted)' }}>{note.category_name}</span>
                        </div>
                      )}
                      <div style={{ fontSize: span.col > 1 ? 16 : 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: wide ? 8 : 0, lineHeight: 1.3 }}>
                        {note.title || 'Untitled'}
                      </div>
                      {wide && (
                        <div style={{
                          fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55,
                          display: '-webkit-box', WebkitLineClamp: (span.row > 1 && span.col > 1) ? 3 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {excerpt(note.content)}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{timeAgo(note.updated_at)}</div>
                  </div>
                )
              })}
              <button
                onClick={handleNewNote}
                disabled={creating}
                style={{
                  background: 'transparent', border: '1px dashed var(--border)', borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: creating ? 'default' : 'pointer',
                  color: 'var(--text-muted)', fontFamily: FONT,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
                  <span style={{ fontSize: 12.5 }}>New note</span>
                </div>
              </button>
            </div>
          )}

        </div>
      </main>

      {showCategoryModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} onClick={() => setShowCategoryModal(false)} />
          <div style={{ position: 'relative', borderRadius: 14, width: 320, padding: '22px 22px 18px', zIndex: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontFamily: FONT }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>New category</h2>
            <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Name</label>
            <input
              ref={categoryNameRef}
              type="text"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') setShowCategoryModal(false) }}
              placeholder="e.g. Research"
              style={{ width: '100%', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: FONT, boxSizing: 'border-box', marginBottom: 16 }}
            />
            <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {SWATCHES.map(color => (
                <button
                  key={color}
                  onClick={() => setNewCategoryColor(color)}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', background: color, cursor: 'pointer',
                    border: newCategoryColor === color ? '2px solid var(--text-primary)' : '2px solid transparent',
                    padding: 0,
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowCategoryModal(false)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
              <button onClick={handleCreateCategory} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#6b5ce7', border: 'none', cursor: 'pointer', fontFamily: FONT }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
