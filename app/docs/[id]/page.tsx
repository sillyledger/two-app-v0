'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import Editor from '@/components/editor'
import DocTopbar from '@/components/doc-topbar'
import { CalendarDays, SignalLow, SignalMedium, SignalHigh, Minus } from 'lucide-react'
import type { Doc } from '@/lib/db'

interface Folder {
  id: string
  name: string
}

interface User {
  id: number
  email: string
  name: string
}

type Priority = 'low' | 'medium' | 'high' | null

const PRIORITIES: { value: Priority; label: string; icon: React.ReactNode; color: string }[] = [
  { value: null,     label: 'No priority', icon: <Minus size={12} />,        color: 'text-[#555]' },
  { value: 'low',    label: 'Low',         icon: <SignalLow size={12} />,    color: 'text-[#888]' },
  { value: 'medium', label: 'Medium',      icon: <SignalMedium size={12} />, color: 'text-[#f5a623]' },
  { value: 'high',   label: 'High',        icon: <SignalHigh size={12} />,   color: 'text-[#e05252]' },
]

function getWordCount(content: string): number {
  const text = content.replace(/<[^>]*>/g, ' ').trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

function getCharCount(content: string): number {
  return content.replace(/<[^>]*>/g, '').length
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getInitials(name: string, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return parts[0][0].toUpperCase()
  }
  return email?.[0]?.toUpperCase() ?? '?'
}

export default function DocPage() {
  const { id } = useParams()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [doc, setDoc] = useState<Doc | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [folder, setFolder] = useState<Folder | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [priority, setPriority] = useState<Priority>(null)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const priorityRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const editorFocusRef = useRef<(() => void) | null>(null)

  const resizeTitle = () => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) {
        setPriorityOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me').then(async (res) => {
      if (res.ok) {
        const data = await res.json()
        setIsLoggedIn(true)
        setCurrentUser(data.user)
      } else {
        setIsLoggedIn(false)
      }
      setAuthChecked(true)
    })
  }, [])

  useEffect(() => {
    if (!authChecked) return

    if (isLoggedIn) {
      fetch(`/api/docs/${id}`)
        .then((res) => res.json())
        .then((data: Doc) => {
          if (data.error) {
            router.push('/')
            return
          }
          setDoc(data)
          setTitle(data.title)
          setContent(data.content || '')
          setIsPublic(data.is_public ?? false)
          setPriority((data.priority as Priority) ?? null)

          if (data.folder_id) {
            fetch(`/api/folders/${data.folder_id}`)
              .then((r) => r.json())
              .then((f: Folder) => setFolder(f))
              .catch(() => {})
          }
        })
    } else {
      fetch(`/api/docs/public/${id}`)
        .then((res) => res.json())
        .then((data: Doc) => {
          if (data.error) {
            router.push('/login')
            return
          }
          setDoc(data)
          setTitle(data.title)
          setContent(data.content || '')
          setIsPublic(data.is_public ?? false)
          setPriority((data.priority as Priority) ?? null)
        })
    }
  }, [id, authChecked])

  useEffect(() => {
    resizeTitle()
  }, [title])

  const handleSave = useCallback(async (latestTitle: string, latestContent: string, latestDoc: Doc | null) => {
    if (!isLoggedIn) return
    setSaveStatus('saving')
    await fetch(`/api/docs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: latestTitle, content: latestContent, color: latestDoc?.color ?? 'yellow' }),
    })
    setSaveStatus('saved')
  }, [id, isLoggedIn])

  useEffect(() => {
    if (!doc) return
    if (!isLoggedIn) return
    setSaveStatus('unsaved')
    const timer = setTimeout(() => {
      handleSave(title, content, doc)
    }, 1000)
    return () => clearTimeout(timer)
  }, [title, content])

  const handlePriorityChange = async (value: Priority) => {
    setPriority(value)
    setPriorityOpen(false)
    await fetch(`/api/docs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: value }),
    })
  }

  const handleNewDoc = async () => {
    const res = await fetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', content: '', color: 'yellow', type: 'doc' }),
    })
    const newDoc = await res.json()
    router.push(`/docs/${newDoc.id}`)
  }

  const handleDelete = async () => {
    await fetch(`/api/docs/${id}`, { method: 'DELETE' })
    router.push('/')
  }

  const sidebarWidth = collapsed ? '52px' : '210px'
  const wordCount = getWordCount(content)
  const charCount = getCharCount(content)
  const activePriority = PRIORITIES.find(p => p.value === priority) ?? PRIORITIES[0]

  if (!authChecked || !doc) return null

  return (
    <div className="flex min-h-screen bg-background">
      {isLoggedIn && (
        <Sidebar
          onNewNote={handleNewDoc}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
      )}

      <div className="flex-1 flex flex-col min-h-screen">
        <DocTopbar
          docTitle={title}
          folder={folder}
          saveStatus={saveStatus}
          onDelete={isLoggedIn ? handleDelete : undefined}
          docId={id}
          isPublic={isPublic}
          sidebarWidth={sidebarWidth}
        />

        <main className="flex-1 overflow-y-auto pt-[44px]">
          <div className="mx-auto w-full max-w-[800px] px-16 pt-16 pb-32">

            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => {
                if (!isLoggedIn) return
                setTitle(e.target.value)
                resizeTitle()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  editorFocusRef.current?.()
                }
              }}
              placeholder="Untitled"
              rows={1}
              readOnly={!isLoggedIn}
              className="mb-5 block w-full resize-none overflow-hidden bg-transparent text-[2.375rem] font-bold leading-[1.2] tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />

            <div className="mb-8 flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/8 text-xs text-[#888]">
                <CalendarDays size={12} className="text-[#666]" />
                <span>{formatDate(doc.created_at)}</span>
              </div>

              <span className="text-[#444] select-none">·</span>

              {currentUser ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/8 text-xs text-[#888]">
                  <div className="w-4 h-4 rounded-full bg-[#3a3a3a] border border-white/10 flex items-center justify-center text-[9px] font-medium text-[#ccc] select-none">
                    {getInitials(currentUser.name, currentUser.email)}
                  </div>
                  <span>{currentUser.name || currentUser.email}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/8 text-xs text-[#555]">
                  <div className="w-4 h-4 rounded-full bg-[#2a2a2a] border border-white/10" />
                  <span>Unknown</span>
                </div>
              )}

              <span className="text-[#444] select-none">·</span>

              {isLoggedIn && (
                <div className="relative" ref={priorityRef}>
                  <button
                    onClick={() => setPriorityOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/8 text-xs text-[#888] hover:bg-white/10 hover:text-[#aaa] transition-colors"
                  >
                    <span className={activePriority.color}>{activePriority.icon}</span>
                    <span>{activePriority.label}</span>
                  </button>

                  {priorityOpen && (
                    <div className="absolute top-full mt-1.5 left-0 z-50 w-44 rounded-lg border border-white/10 bg-[#1e1e1e] shadow-xl py-1">
                      {PRIORITIES.map((p) => (
                        <button
                          key={String(p.value)}
                          onClick={() => handlePriorityChange(p.value)}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-white/5 transition-colors ${
                            priority === p.value ? 'text-white' : 'text-[#888]'
                          }`}
                        >
                          <span className={p.color}>{p.icon}</span>
                          <span>{p.label}</span>
                          {priority === p.value && <span className="ml-auto text-[#555]">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {doc !== null && (
              <Editor
                content={content}
                onChange={(newContent) => {
                  if (!isLoggedIn) return
                  setContent(newContent)
                }}
                onReady={(focusFn) => { editorFocusRef.current = focusFn }}
              />
            )}

            {wordCount > 0 && (
              <div className="mt-16 flex items-center gap-2 text-[11px] text-[#383838] select-none">
                <span>{wordCount.toLocaleString()} words</span>
                <span>·</span>
                <span>{charCount.toLocaleString()} characters</span>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
