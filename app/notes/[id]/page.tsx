'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Editor from '@/components/editor'
import PusherJS from 'pusher-js'
import { useTabStore } from '@/hooks/use-tab-store'
import NoteTopbar, { type NoteCategory } from '@/components/note-topbar'

interface Note {
  id: number
  uuid: string
  title: string
  content: string | null
  category_id: number | null
  category_name: string | null
  category_color: string | null
  updated_at: string
  error?: string
}

const FONT = "'DM Sans', system-ui, sans-serif"

export default function NotePage() {
  const params = useParams()
  const noteId = Array.isArray(params.id) ? params.id[0] : (params.id as string)
  const router = useRouter()
  const { openTab, updateTabTitle } = useTabStore()

  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved')
  const [categories, setCategories] = useState<NoteCategory[]>([])
  const [splitViewActive, setSplitViewActive] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  const editorFocusRef = useRef<(() => void) | null>(null)
  const remoteUpdateRef = useRef<((html: string) => void) | null>(null)
  const lastSavedTitleRef = useRef('')
  const lastSavedContentRef = useRef('')
  const isTypingRef = useRef(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Initial fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!noteId) return
    setNote(null)
    setTitle('')
    setContent('')

    fetch(`/api/notes/${noteId}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true)
          router.push('/notes')
          return
        }
        const data: Note = await res.json()
        if (data.error) {
          router.push('/notes')
          return
        }
        setNote(data)
        openTab(noteId, data.title || 'Untitled', 'note')
        setTitle(data.title || '')
        setContent(data.content || '')
        lastSavedTitleRef.current = data.title || ''
        lastSavedContentRef.current = data.content || ''
      })
      .catch(() => {})
  }, [noteId])

  useEffect(() => {
    fetch('/api/note-categories')
      .then(r => r.json())
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  // ─── Pusher: live sync from other sessions ───────────────────────────────
  useEffect(() => {
    if (!noteId) return

    const pusher = new PusherJS(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    })
    const channel = pusher.subscribe(`note-${noteId}`)

    channel.bind('updated', () => {
      if (isTypingRef.current) return
      fetch(`/api/notes/${noteId}`)
        .then(res => res.json())
        .then((data: Note) => {
          if (data.error) return
          setNote(data)
          if (remoteUpdateRef.current) {
            remoteUpdateRef.current(data.content || '')
          } else {
            setContent(data.content || '')
          }
          setTitle(data.title || '')
          updateTabTitle(noteId, data.title || 'Untitled')
          lastSavedTitleRef.current = data.title || ''
          lastSavedContentRef.current = data.content || ''
        })
        .catch(() => {})
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`note-${noteId}`)
      pusher.disconnect()
    }
  }, [noteId])

  // ─── Autosave: debounce, then PUT only the fields that changed ───────────
  const handleSave = useCallback(async (latestTitle: string, latestContent: string) => {
    const body: { title?: string; content?: string } = {}
    if (latestTitle !== lastSavedTitleRef.current) body.title = latestTitle
    if (latestContent !== lastSavedContentRef.current) body.content = latestContent
    if (Object.keys(body).length === 0) return

    setSaveStatus('saving')
    const res = await fetch(`/api/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error(`[handleSave] Save FAILED for note ${noteId}: HTTP ${res.status}`)
      setSaveStatus('saved')
      return
    }
    lastSavedTitleRef.current = latestTitle
    lastSavedContentRef.current = latestContent
    setSaveStatus('saved')
  }, [noteId])

  useEffect(() => {
    if (!note) return

    isTypingRef.current = true
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => { isTypingRef.current = false }, 2000)

    const timer = setTimeout(() => { handleSave(title, content) }, 1000)
    return () => clearTimeout(timer)
  }, [title, content])

  const handleImageUpload = useCallback(async (file: File): Promise<string | null> => {
    if (file.size > 5 * 1024 * 1024) { alert('Image too large. Maximum 5MB.'); return null }
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowed.includes(file.type)) { alert('Only JPEG, PNG, GIF and WebP allowed.'); return null }
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.url) return data.url
    alert(data.error || 'Upload failed')
    return null
  }, [])

  const handleDeleteNote = useCallback(async () => {
    try {
      await fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
    } catch {}
    router.push('/notes')
  }, [noteId, router])

  const handleMoveNote = useCallback(async (categoryId: number | null) => {
    const cat = categories.find(c => c.id === categoryId) ?? null
    setNote(prev => prev ? { ...prev, category_id: categoryId, category_name: cat?.name ?? null, category_color: cat?.color ?? null } : prev)
    try {
      await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId }),
      })
    } catch {}
  }, [noteId, categories])

  const handleToggleSplitView = () => {
    setSplitViewActive(v => !v)
    window.dispatchEvent(new Event('toggle-split-view'))
  }

  if (notFound) return null

  if (!note) return (
    <main className="flex-1 overflow-y-auto" style={{ fontFamily: FONT, backgroundColor: 'var(--panel)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 40px 120px' }}>
        <div className="h-4 w-20 rounded-md animate-pulse mb-8" style={{ backgroundColor: 'var(--surface-2)' }} />
        <div className="h-10 w-2/3 rounded-lg mb-8 animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
        <div className="flex flex-col gap-3">
          <div className="h-4 w-full rounded animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
          <div className="h-4 w-5/6 rounded animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
          <div className="h-4 w-full rounded animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
        </div>
      </div>
    </main>
  )

  return (
    <>
      <NoteTopbar
        noteTitle={title}
        category={note.category_id && note.category_name ? { id: note.category_id, name: note.category_name, color: note.category_color || '#888890' } : null}
        saveStatus={saveStatus}
        noteId={noteId}
        onDelete={handleDeleteNote}
        content={content}
        splitViewActive={splitViewActive}
        onToggleSplitView={handleToggleSplitView}
        allCategories={categories}
        onMove={handleMoveNote}
      />
      <main className="flex-1 overflow-y-auto" style={{ fontFamily: FONT, backgroundColor: 'var(--panel)', paddingTop: '80px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '64px 40px 120px' }}>

          <input
            ref={titleRef}
            value={title}
            onChange={(e) => { setTitle(e.target.value); updateTabTitle(noteId, e.target.value || 'Untitled') }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editorFocusRef.current?.() } }}
            placeholder="Untitled"
            style={{
              display: 'block', width: '100%', marginBottom: 24,
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: '2.375rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.025em',
              color: 'var(--text-1)', fontFamily: FONT,
            }}
          />

          <Editor
            content={content}
            editable={true}
            onChange={(newContent) => setContent(newContent)}
            onReady={(focusFn) => { editorFocusRef.current = focusFn }}
            onImageUpload={handleImageUpload}
            onRemoteUpdate={(fn) => { remoteUpdateRef.current = fn }}
          />
        </div>
      </main>
    </>
  )
}
