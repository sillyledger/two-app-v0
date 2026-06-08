'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Editor from '@/components/editor'
import type { Doc } from '@/lib/db'

export default function MacDocPage() {
  const params = useParams()
  const docId = Array.isArray(params.id) ? params.id[0] : (params.id as string)

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
    <div className="flex-1 flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Minimal save indicator */}
      <div className="fixed top-3 right-4 z-10">
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'unsaved' ? '●' : ''}
        </span>
      </div>

      <main className="flex-1 overflow-y-auto flex flex-col items-center" style={{ paddingTop: '48px' }}>
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
      </main>
    </div>
  )
}
