'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Editor from '@/components/editor'
import type { Doc } from '@/lib/db'

interface SplitPaneProps {
  type: 'doc' | 'note'
  id: string
}

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
  category_name?: string | null
  category_color?: string | null
  error?: string
}

export default function SplitPane({ type, id }: SplitPaneProps) {
  const itemId = id
  const [doc, setDoc] = useState<Doc | null>(null)
  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'blocked'>('saved')
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const editorFocusRef = useRef<(() => void) | null>(null)
  const insertImageRef = useRef<((url: string) => void) | null>(null)
  const remoteUpdateRef = useRef<((html: string) => void) | null>(null)
  const isTypingRef = useRef(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loaded = type === 'doc' ? !!doc : !!note

  const resizeTitle = () => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  useEffect(() => {
    if (!itemId) return
    setDoc(null)
    setNote(null)
    setTitle('')
    setContent('')
    const endpoint = type === 'doc' ? `/api/docs/${itemId}` : `/api/notes/${itemId}`
    fetch(endpoint)
      .then(res => res.json())
      .then((data: Doc | Note) => {
        if ((data as any).error) return
        if (type === 'doc') setDoc(data as Doc)
        else setNote(data as Note)
        setTitle(data.title || '')
        setContent(data.content || '')
      })
  }, [itemId, type])

  useEffect(() => { resizeTitle() }, [title])

  const handleSave = useCallback(async (latestTitle: string, latestContent: string) => {
    if (type === 'doc') {
      const savedLength = doc?.content ? doc.content.length : 0
      if (savedLength > 100 && latestContent.length < savedLength * 0.5) {
        console.error(
          `[handleSave] Refused to save doc ${itemId} (client-side guard): new content is ` +
          `${latestContent.length} chars, down from ${savedLength} previously saved. Local content is unaffected.`
        )
        setSaveStatus('blocked')
        return
      }
      setSaveStatus('saving')
      const res = await fetch(`/api/docs/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: latestTitle, content: latestContent, source: 'autosave' }),
      })
      if (!res.ok) {
        let blockedByGuard = false
        if (res.status === 409) {
          const data = await res.json().catch(() => null)
          blockedByGuard = !!data?.blocked
        }
        console.error(`[handleSave] Save FAILED for doc ${itemId}: HTTP ${res.status}${blockedByGuard ? ' (content-loss guard blocked it)' : ''}`)
        setSaveStatus('blocked')
        return
      }
      setSaveStatus('saved')
    } else {
      setSaveStatus('saving')
      await fetch(`/api/notes/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: latestTitle, content: latestContent }),
      })
      setSaveStatus('saved')
    }
  }, [itemId, type, doc])

  // This surface has no Yjs/Pusher connection — if the doc is shared,
  // content can't safely persist from here (no way to know if a peer
  // elsewhere is mid-edit), but title still saves independently. Open
  // /docs/[id] for live collaborative editing.
  const handleSaveDocTitleOnly = useCallback(async (latestTitle: string) => {
    const res = await fetch(`/api/docs/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: latestTitle, source: 'autosave-title' }),
    })
    if (!res.ok) {
      console.error(`[handleSaveDocTitleOnly] Title save failed for doc ${itemId}: HTTP ${res.status}`)
      setSaveStatus('blocked')
      return
    }
    setSaveStatus('saved')
  }, [itemId])

  useEffect(() => {
    if (!loaded) return
    isTypingRef.current = true
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => { isTypingRef.current = false }, 2000)
    setSaveStatus('unsaved')

    const isSharedDoc = type === 'doc' && !!(doc as any)?.workspace_id
    if (isSharedDoc) return

    const timer = setTimeout(() => { handleSave(title, content) }, 1000)
    return () => clearTimeout(timer)
  }, [title, content])

  useEffect(() => {
    if (!loaded) return
    const isSharedDoc = type === 'doc' && !!(doc as any)?.workspace_id
    if (!isSharedDoc) return
    const timer = setTimeout(() => { handleSaveDocTitleOnly(title) }, 1000)
    return () => clearTimeout(timer)
  }, [title])

  const handleImageUpload = useCallback(async (file: File): Promise<string | null> => {
    if (file.size > 5 * 1024 * 1024) return null
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    return data.url ?? null
  }, [])

  if (!loaded) return (
    <div className="flex-1 flex items-center justify-center h-full" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ backgroundColor: 'var(--bg)', paddingTop: '80px' }}>
      {/* Minimal save indicator */}
      <div className="sticky top-3 flex justify-end px-4 z-10 pointer-events-none">
        <span
          style={{ fontSize: '11px', color: saveStatus === 'blocked' ? '#ef4444' : 'var(--text-muted)' }}
          className={saveStatus === 'blocked' ? 'font-medium' : undefined}
        >
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'unsaved' ? '●' : saveStatus === 'blocked' ? 'Not saved' : ''}
        </span>
      </div>

      <div className="mx-auto w-full px-16 pt-16 pb-32 max-w-[800px]">
        <textarea
          ref={titleRef}
          value={title}
          onChange={(e) => { setTitle(e.target.value); resizeTitle() }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editorFocusRef.current?.() } }}
          placeholder="Untitled"
          rows={1}
          className="mb-8 block w-full resize-none overflow-hidden bg-transparent text-[2.375rem] font-bold leading-[1.2] tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
        />

        <Editor
          content={content}
          editable={true}
          isShared={false}
          onChange={(newContent) => { setContent(newContent) }}
          onReady={(focusFn) => { editorFocusRef.current = focusFn }}
          onImageUpload={handleImageUpload}
          onInsertImageReady={(fn) => { insertImageRef.current = fn }}
          onRemoteUpdate={(fn) => { remoteUpdateRef.current = fn }}
        />
      </div>
    </div>
  )
}
