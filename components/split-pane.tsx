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
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'blocked' | 'conflict'>('saved')
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const editorFocusRef = useRef<(() => void) | null>(null)
  const insertImageRef = useRef<((url: string) => void) | null>(null)
  const remoteUpdateRef = useRef<((html: string) => void) | null>(null)
  const isTypingRef = useRef(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestUpdatedAtRef = useRef<string | null>(null)
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
        latestUpdatedAtRef.current = type === 'doc' ? ((data as Doc).updated_at ?? null) : null
      })
  }, [itemId, type])

  useEffect(() => { resizeTitle() }, [title])

  const handleSave = useCallback(async (latestTitle: string, latestContent: string) => {
    if (type === 'doc') {
      setSaveStatus('saving')
      const res = await fetch(`/api/docs/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: latestTitle, content: latestContent, source: 'autosave', updated_at: latestUpdatedAtRef.current }),
      })
      if (res.status === 409) {
        console.error(`[handleSave] Conflict saving doc ${itemId}: changed by someone else since last load.`)
        setSaveStatus('conflict')
        return
      }
      if (!res.ok) {
        console.error(`[handleSave] Save FAILED for doc ${itemId}: HTTP ${res.status}`)
        setSaveStatus('blocked')
        return
      }
      const result = await res.json()
      latestUpdatedAtRef.current = result.updated_at ?? latestUpdatedAtRef.current
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
  }, [itemId, type])

  useEffect(() => {
    if (!loaded) return
    isTypingRef.current = true
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => { isTypingRef.current = false }, 2000)
    setSaveStatus('unsaved')
    const timer = setTimeout(() => { handleSave(title, content) }, 1000)
    return () => clearTimeout(timer)
  }, [title, content])

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
          style={{ fontSize: '11px', color: saveStatus === 'blocked' ? '#ef4444' : saveStatus === 'conflict' ? '#f59e0b' : 'var(--text-muted)' }}
          className={saveStatus === 'blocked' || saveStatus === 'conflict' ? 'font-medium' : undefined}
          title={saveStatus === 'conflict' ? 'This doc was changed by someone else. Reload to see the latest version.' : undefined}
        >
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'unsaved' ? '●' : saveStatus === 'blocked' ? 'Not saved' : saveStatus === 'conflict' ? 'Outdated — reload' : ''}
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
