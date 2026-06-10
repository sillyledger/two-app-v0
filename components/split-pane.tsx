'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Editor from '@/components/editor'
import type { Doc } from '@/lib/db'

interface SplitPaneProps {
  docId: string
}

export default function SplitPane({ docId }: SplitPaneProps) {
  const [doc, setDoc] = useState<Doc | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const editorFocusRef = useRef<(() => void) | null>(null)
  const insertImageRef = useRef<((url: string) => void) | null>(null)
  const remoteUpdateRef = useRef<((html: string) => void) | null>(null)
  const isTypingRef = useRef(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resizeTitle = () => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  useEffect(() => {
    if (!docId) return
    setDoc(null)
    setTitle('')
    setContent('')
    fetch(`/api/docs/${docId}`)
      .then(res => res.json())
      .then((data: Doc) => {
        if (data.error) return
        setDoc(data)
        setTitle(data.title || '')
        setContent(data.content || '')
      })
  }, [docId])

  useEffect(() => { resizeTitle() }, [title])

  const handleSave = useCallback(async (latestTitle: string, latestContent: string, latestDoc: Doc | null) => {
    const savedLength = latestDoc?.content ? latestDoc.content.length : 0
    if (savedLength > 100 && latestContent.length < savedLength * 0.5) {
      setSaveStatus('saved')
      return
    }
    setSaveStatus('saving')
    await fetch(`/api/docs/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: latestTitle, content: latestContent }),
    })
    setSaveStatus('saved')
  }, [docId])

  useEffect(() => {
    if (!doc) return
    isTypingRef.current = true
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => { isTypingRef.current = false }, 2000)
    setSaveStatus('unsaved')
    const timer = setTimeout(() => { handleSave(title, content, doc) }, 1000)
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

  if (!doc) return (
    <div className="flex-1 flex items-center justify-center h-full" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Minimal save indicator */}
      <div className="sticky top-3 flex justify-end px-4 z-10 pointer-events-none">
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'unsaved' ? '●' : ''}
        </span>
      </div>

      <div className="mx-auto w-full px-16 pt-12 pb-32 max-w-[800px]">
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
