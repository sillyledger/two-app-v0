'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Editor from '@/components/editor'
import { ArrowLeft } from 'lucide-react'
import PusherJS from 'pusher-js'

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

export default function NotePage() {
  const params = useParams()
  const noteId = Array.isArray(params.id) ? params.id[0] : (params.id as string)
  const router = useRouter()

  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

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
        setTitle(data.title || '')
        setContent(data.content || '')
        lastSavedTitleRef.current = data.title || ''
        lastSavedContentRef.current = data.content || ''
        setLastSaved(data.updated_at ?? null)
      })
      .catch(() => {})
  }, [noteId])

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
          lastSavedTitleRef.current = data.title || ''
          lastSavedContentRef.current = data.content || ''
          setLastSaved(data.updated_at ?? null)
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

    const res = await fetch(`/api/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error(`[handleSave] Save FAILED for note ${noteId}: HTTP ${res.status}`)
      return
    }
    lastSavedTitleRef.current = latestTitle
    lastSavedContentRef.current = latestContent
    setLastSaved(new Date().toISOString())
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

  if (notFound) return null

  if (!note) return (
    <main className="flex-1 overflow-y-auto" style={{ fontFamily: FONT, backgroundColor: 'var(--bg)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 40px 120px' }}>
        <div className="h-4 w-20 rounded-md animate-pulse mb-8" style={{ backgroundColor: 'var(--bg-tertiary)' }} />
        <div className="h-10 w-2/3 rounded-lg mb-8 animate-pulse" style={{ backgroundColor: 'var(--bg-tertiary)' }} />
        <div className="flex flex-col gap-3">
          <div className="h-4 w-full rounded animate-pulse" style={{ backgroundColor: 'var(--bg-tertiary)' }} />
          <div className="h-4 w-5/6 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-tertiary)' }} />
          <div className="h-4 w-full rounded animate-pulse" style={{ backgroundColor: 'var(--bg-tertiary)' }} />
        </div>
      </div>
    </main>
  )

  return (
    <main className="flex-1 overflow-y-auto" style={{ fontFamily: FONT, backgroundColor: 'var(--bg)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 40px 120px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <button
            onClick={() => router.push('/notes')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 13, fontFamily: FONT, padding: '4px 0',
            }}
          >
            <ArrowLeft size={14} />
            Notes
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {note.category_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: note.category_color || '#888890', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{note.category_name}</span>
              </div>
            )}
            {lastSaved && (
              <>
                {note.category_name && <span style={{ color: 'var(--border)' }}>·</span>}
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Edited {timeAgo(lastSaved)}</span>
              </>
            )}
          </div>
        </div>

        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editorFocusRef.current?.() } }}
          placeholder="Untitled"
          style={{
            display: 'block', width: '100%', marginBottom: 24,
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em',
            color: 'var(--text-primary)', fontFamily: FONT,
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
  )
}
