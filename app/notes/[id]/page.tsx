'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Editor from '@/components/editor'
import PusherJS from 'pusher-js'
import { RoomProvider } from '@/liveblocks.config'

const FONT = "'DM Sans', system-ui, sans-serif"

const SWATCHES = [
  '#7F77DD', '#1D9E75', '#D85A30', '#D4537E',
  '#378ADD', '#639922', '#BA7517', '#E24B4A', '#888890',
]

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
  updated_at: string
}

export default function NoteEditorPage() {
  const params = useParams()
  const noteId = Array.isArray(params.id) ? params.id[0] : (params.id as string)
  const router = useRouter()

  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [categories, setCategories] = useState<NoteCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [panelOpen, setPanelOpen] = useState(true)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [splitViewActive, setSplitViewActive] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#7F77DD')
  const categoryNameRef = useRef<HTMLInputElement>(null)

  const titleRef = useRef<HTMLTextAreaElement>(null)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)
  const isTypingRef = useRef(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remoteUpdateRef = useRef<((html: string) => void) | null>(null)
  const initialContent = useRef('')

  const resizeTitle = () => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  useEffect(() => { resizeTitle() }, [title])

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) router.push('/login')
      else setAuthChecked(true)
    })
  }, [])

  useEffect(() => {
    if (!authChecked || !noteId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/notes/${noteId}`).then(r => r.json()),
      fetch('/api/note-categories').then(r => r.json()),
    ]).then(([noteData, categoriesData]) => {
      if (noteData?.error) { router.push('/notes'); return }
      setNote(noteData)
      setTitle(noteData.title || '')
      setContent(noteData.content || '')
      initialContent.current = noteData.content || ''
      setCategoryId(noteData.category_id ?? null)
      setCategories(Array.isArray(categoriesData) ? categoriesData : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [authChecked, noteId])

  // Pusher: pick up edits saved from another device for this same note
  useEffect(() => {
    if (!noteId || !authChecked) return
    const pusher = new PusherJS(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    })
    const channel = pusher.subscribe(`note-${noteId}`)
    channel.bind('updated', () => {
      if (isTypingRef.current) return
      fetch(`/api/notes/${noteId}`)
        .then(res => res.json())
        .then((data: Note) => {
          if ((data as any).error) return
          if (remoteUpdateRef.current) remoteUpdateRef.current(data.content || '')
          else setContent(data.content || '')
          setTitle(data.title || '')
          setCategoryId(data.category_id ?? null)
        })
        .catch(() => {})
    })
    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`note-${noteId}`)
      pusher.disconnect()
    }
  }, [noteId, authChecked])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) setCategoryDropdownOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleSave = useCallback(async (latestTitle: string, latestContent: string, latestCategoryId: number | null) => {
    setSaveStatus('saving')
    await fetch(`/api/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: latestTitle, content: latestContent, category_id: latestCategoryId }),
    })
    setSaveStatus('saved')
  }, [noteId])

  useEffect(() => {
    if (loading) return
    isTypingRef.current = true
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => { isTypingRef.current = false }, 2000)

    setSaveStatus('unsaved')
    const timer = setTimeout(() => { handleSave(title, content, categoryId) }, 1000)
    return () => clearTimeout(timer)
  }, [title, content, categoryId])

  async function deleteNote() {
    if (!confirm('Delete this note? This cannot be undone.')) return
    await fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
    router.push('/notes')
  }

  function handleToggleSplitView() {
    setSplitViewActive(v => !v)
    window.dispatchEvent(new Event('toggle-split-view'))
  }

  function openCategoryModal() {
    setCategoryDropdownOpen(false)
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
      setCategoryId(category.id)
    } catch {}
  }

  const activeCategory = categories.find(c => c.id === categoryId) || null

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: FONT }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</p>
      </div>
    )
  }

  return (
    <RoomProvider id={`note-${noteId}`} initialPresence={{ name: 'Anonymous', color: '#888888' }}>
    <div style={{ flex: 1, minWidth: 0, fontFamily: FONT, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <style>{`
        .note-side-panel { width: 230px; border-left: 1px solid var(--border); padding: 22px 18px; overflow-y: auto; flex-shrink: 0; display: flex; flex-direction: column; gap: 18px; transition: width 0.2s ease, opacity 0.2s ease, padding 0.2s ease; }
        .note-side-panel.closed { width: 0; padding: 0; opacity: 0; overflow: hidden; pointer-events: none; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 22px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          <span onClick={() => router.push('/')} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>Home</span>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span onClick={() => router.push('/notes')} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>Notes</span>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ color: 'var(--text-secondary)' }}>{title || 'Untitled'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saveStatus === 'saving' && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Saving...</span>}
          {saveStatus === 'saved' && <span style={{ fontSize: 11.5, color: '#1D9E75' }}>Saved</span>}
          {saveStatus === 'unsaved' && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Unsaved</span>}
          <button
            onClick={handleToggleSplitView}
            title={splitViewActive ? 'Close split view' : 'Open split view'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: splitViewActive ? 'var(--bg-tertiary)' : 'transparent', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', fontSize: 12, color: splitViewActive ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: FONT }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1.2"/></svg>
            Split
          </button>
          <button
            onClick={() => setPanelOpen(o => !o)}
            style={{ background: panelOpen ? 'var(--bg-tertiary)' : 'transparent', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="2" stroke="var(--text-muted)" strokeWidth="1.2"/><line x1="10.5" y1="1" x2="10.5" y2="15" stroke="var(--text-muted)" strokeWidth="1.2"/></svg>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 680, padding: '56px 24px 80px' }}>
            <textarea
              ref={titleRef}
              value={title}
              onChange={e => { setTitle(e.target.value); resizeTitle() }}
              placeholder="Untitled"
              rows={1}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 34, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 36, fontFamily: FONT, resize: 'none', overflow: 'hidden', lineHeight: 1.2, display: 'block' }}
            />
            <Editor
              content={initialContent.current}
              onChange={setContent}
              onRemoteUpdate={(fn) => { remoteUpdateRef.current = fn }}
            />
          </div>
        </div>

        <div className={'note-side-panel' + (panelOpen ? '' : ' closed')}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Category</div>
            <div ref={categoryDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setCategoryDropdownOpen(o => !o)}
                style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: activeCategory ? 'var(--text-primary)' : 'var(--text-muted)', outline: 'none', fontFamily: FONT, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {activeCategory && <span style={{ width: 7, height: 7, borderRadius: '50%', background: activeCategory.color, flexShrink: 0 }} />}
                  {activeCategory ? activeCategory.name : 'No category'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▼</span>
              </button>
              {categoryDropdownOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 9, zIndex: 30, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                  <div style={{ padding: 5 }}>
                    <button
                      onClick={() => { setCategoryId(null); setCategoryDropdownOpen(false) }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 9px', background: 'transparent', border: 'none', borderRadius: 6, fontSize: 12.5, color: categoryId === null ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}
                    >
                      No category
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => { setCategoryId(cat.id); setCategoryDropdownOpen(false) }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 7, padding: '8px 9px', background: 'transparent', border: 'none', borderRadius: 6, fontSize: 12.5, color: categoryId === cat.id ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                        {cat.name}
                      </button>
                    ))}
                    <button
                      onClick={openCategoryModal}
                      style={{ width: '100%', textAlign: 'left', padding: '8px 9px', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', marginTop: 3, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: FONT }}
                    >
                      + New category
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <button onClick={deleteNote} style={{ width: '100%', background: 'transparent', color: '#E24B4A', border: '1px solid rgba(226,75,74,0.25)', borderRadius: 9, padding: 10, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>Delete note</button>
        </div>
      </div>

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
    </RoomProvider>
  )
}
