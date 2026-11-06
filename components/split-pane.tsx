'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { X, CalendarDays, Minus, SignalLow, SignalMedium, SignalHigh } from 'lucide-react'
import Editor from '@/components/editor'
import type { Doc } from '@/lib/db'
import { formatDate as formatDateI18n, getUserDatePrefs } from '@/lib/format-date'

interface SplitPaneProps {
  type: 'doc' | 'note'
  id: string
  onClose?: () => void
}

type Priority = 'low' | 'medium' | 'high' | null

const PRIORITIES: { value: Priority; label: string; icon: ReactNode; color: string }[] = [
  { value: null,     label: 'No priority', icon: <Minus size={12} />,        color: 'text-[var(--text-2)]' },
  { value: 'low',    label: 'Low',         icon: <SignalLow size={12} />,    color: 'text-[var(--text-2)]' },
  { value: 'medium', label: 'Medium',      icon: <SignalMedium size={12} />, color: 'text-[#d97706]' },
  { value: 'high',   label: 'High',        icon: <SignalHigh size={12} />,   color: 'text-[#dc2626]' },
]

interface Label {
  id: number
  name: string
  color: string
}

// SplitPane is client-only (ssr: false), so user date prefs can be read directly
function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const { timezone, dateFormat } = getUserDatePrefs()
  return formatDateI18n(date, dateFormat, timezone)
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

export default function SplitPane({ type, id, onClose }: SplitPaneProps) {
  const itemId = id
  const [doc, setDoc] = useState<Doc | null>(null)
  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved')
  const [priority, setPriority] = useState<Priority>(null)
  const [headerPriorityOpen, setHeaderPriorityOpen] = useState(false)
  const headerPriorityRef = useRef<HTMLDivElement>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [docLabels, setDocLabels] = useState<Label[]>([])
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
    setPriority(null)
    setHeaderPriorityOpen(false)
    setUserName(null)
    setDocLabels([])
    const endpoint = type === 'doc' ? `/api/docs/${itemId}` : `/api/notes/${itemId}`
    fetch(endpoint)
      .then(res => res.json())
      .then((data: Doc | Note) => {
        if ((data as any).error) return
        if (type === 'doc') setDoc(data as Doc)
        else setNote(data as Note)
        setTitle(data.title || '')
        setContent(data.content || '')
        if (type === 'doc') setPriority((data as any).priority ?? null)
      })
    if (type === 'doc') {
      fetch('/api/auth/me')
        .then(res => res.ok ? res.json() : null)
        .then(data => setUserName(data?.user ? (data.user.name || data.user.email) : null))
        .catch(() => setUserName(null))
      fetch(`/api/docs/${itemId}/labels`)
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setDocLabels(d) })
        .catch(() => {})
    }
  }, [itemId, type])

  // Close the priority dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (headerPriorityRef.current && !headerPriorityRef.current.contains(e.target as Node)) setHeaderPriorityOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePriorityChange = async (value: Priority) => {
    setPriority(value)
    setHeaderPriorityOpen(false)
    await fetch(`/api/docs/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: value }),
    })
  }

  useEffect(() => { resizeTitle() }, [title])

  const handleSave = useCallback(async (latestTitle: string, latestContent: string) => {
    if (type === 'doc') {
      setSaveStatus('saving')
      const res = await fetch(`/api/docs/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: latestTitle, content: latestContent }),
      })
      if (!res.ok) {
        console.error(`[handleSave] Save FAILED for doc ${itemId}: HTTP ${res.status}`)
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
  }, [itemId, type])

  useEffect(() => {
    if (!loaded) return
    isTypingRef.current = true
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => { isTypingRef.current = false }, 2000)
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

  const activePriority = PRIORITIES.find(p => p.value === priority) ?? PRIORITIES[0]

  if (!loaded) return (
    <div className="flex-1 flex items-center justify-center h-full" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ backgroundColor: 'var(--bg)', paddingTop: '84px' }}>
      {/* Floating save status + close (takes no layout space) */}
      <div className="sticky z-10" style={{ top: 0, height: 0, overflow: 'visible' }}>
        <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close split view"
              style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: '4px', display: 'flex' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full px-16 pt-16 pb-32 max-w-[800px]" style={{ paddingTop: '60px' }}>
        <textarea
          ref={titleRef}
          value={title}
          onChange={(e) => { setTitle(e.target.value); resizeTitle() }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editorFocusRef.current?.() } }}
          placeholder="Untitled"
          rows={1}
          className={`${type === 'doc' ? 'mb-5' : 'mb-8'} block w-full resize-none overflow-hidden bg-transparent text-[2.375rem] font-bold leading-[1.2] tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none`}
        />

        {type === 'doc' && doc && (
          <div className="mb-8 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--hover)] border border-[var(--border-subtle)] text-xs text-[var(--doc-chip-text)]">
              <CalendarDays size={12} className="text-[var(--doc-chip-icon)]" />
              <span>{formatDate(doc.created_at)}</span>
            </div>
            <span className="text-[var(--doc-sep)] select-none">·</span>
            {userName ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--hover)] border border-[var(--border-subtle)] text-xs text-[var(--doc-chip-text)]">
                <span>{userName}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--hover)] border border-[var(--border-subtle)] text-xs text-[var(--doc-chip-dim)]">
                <span>Unknown</span>
              </div>
            )}
            <span className="text-[var(--doc-sep)] select-none">·</span>
            <div className="relative" ref={headerPriorityRef}>
              <button
                onClick={() => setHeaderPriorityOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--hover)] border border-[var(--border-subtle)] text-xs text-[var(--doc-chip-text)] hover:bg-[var(--surface-2)] hover:text-[var(--doc-chip-text-hover)] transition-colors"
              >
                <span className={activePriority.color}>{activePriority.icon}</span>
                <span>{activePriority.label}</span>
              </button>
              {headerPriorityOpen && (
                <div className="absolute top-full mt-1.5 left-0 z-50 w-44 rounded-lg border border-[var(--border-subtle)] bg-[var(--menu-bg-2)] shadow-xl py-1">
                  {PRIORITIES.map((p) => (
                    <button key={String(p.value)} onClick={() => handlePriorityChange(p.value)}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors`}
                      style={{ color: priority === p.value ? 'var(--text-1)' : 'var(--text-2)' }}>
                      <span className={p.color}>{p.icon}</span>
                      <span>{p.label}</span>
                      {priority === p.value && <span className="ml-auto text-[var(--doc-chip-dim)]">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {docLabels.length > 0 && (
              <>
                <span className="text-[var(--doc-sep)] select-none">·</span>
                {docLabels.map(label => (
                  <div key={label.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--hover)] border border-[var(--border-subtle)] text-xs text-[var(--doc-chip-text)]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                    <span>{label.name}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

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
