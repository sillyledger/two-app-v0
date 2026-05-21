'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import Editor from '@/components/editor'
import DocTopbar from '@/components/doc-topbar'
import { CalendarDays, SignalLow, SignalMedium, SignalHigh, Minus, PanelRight, X, FileText, User, Clock, Tag, Plus, Check } from 'lucide-react'
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

interface Label {
  id: number
  name: string
  color: string
}

type Priority = 'low' | 'medium' | 'high' | null

const PRIORITIES: { value: Priority; label: string; icon: React.ReactNode; color: string }[] = [
  { value: null,     label: 'No priority', icon: <Minus size={12} />,        color: 'text-[#555]' },
  { value: 'low',    label: 'Low',         icon: <SignalLow size={12} />,    color: 'text-[#888]' },
  { value: 'medium', label: 'Medium',      icon: <SignalMedium size={12} />, color: 'text-[#f5a623]' },
  { value: 'high',   label: 'High',        icon: <SignalHigh size={12} />,   color: 'text-[#e05252]' },
]

const LABEL_COLORS = [
  '#888888', '#e05252', '#f5a623', '#f5e623', '#52e052',
  '#52b8e0', '#5271e0', '#a052e0', '#e052a0', '#52e0b8',
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

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") setCollapsed(true)
  }, [])

  const [wideMode, setWideMode] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
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

  // Labels state
  const [docLabels, setDocLabels] = useState<Label[]>([])
  const [allLabels, setAllLabels] = useState<Label[]>([])
  const [labelPickerOpen, setLabelPickerOpen] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#888888')
  const [creatingLabel, setCreatingLabel] = useState(false)
  const labelPickerRef = useRef<HTMLDivElement>(null)

  // Close label picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target as Node)) {
        setLabelPickerOpen(false)
        setCreatingLabel(false)
        setNewLabelName('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Escape key closes detail panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && detailOpen) setDetailOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [detailOpen])

  useEffect(() => {
    const saved = localStorage.getItem('doc-wide-mode')
    if (saved === 'true') setWideMode(true)
  }, [])

  const toggleWideMode = () => {
    setWideMode((v) => {
      localStorage.setItem('doc-wide-mode', String(!v))
      return !v
    })
  }

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

  // Fetch doc labels and all labels once logged in
  useEffect(() => {
    useEffect(() => {
    if (!isLoggedIn) return
    fetch('/api/labels')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAllLabels(data) })
    fetch(`/api/docs/${id}/labels`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setDocLabels(data) })
  }, [isLoggedIn, id])

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

  const handleToggleLabel = async (label: Label) => {
    const isOn = docLabels.some(l => l.id === label.id)
    if (isOn) {
      await fetch(`/api/docs/${id}/labels`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelId: label.id }),
      })
      setDocLabels(prev => prev.filter(l => l.id !== label.id))
    } else {
      await fetch(`/api/docs/${id}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelId: label.id }),
      })
      setDocLabels(prev => [...prev, label])
    }
  }

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return
    const res = await fetch('/api/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newLabelName.trim(), color: newLabelColor }),
    })
    const created = await res.json()
    setAllLabels(prev => [...prev, created])
    // Auto-assign to this doc
    await fetch(`/api/docs/${id}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labelId: created.id }),
    })
    setDocLabels(prev => [...prev, created])
    setNewLabelName('')
    setNewLabelColor('#888888')
    setCreatingLabel(false)
  }

  const handleNewDoc = async () => {
    const res = await fetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', content: '', color: 'yellow', type: 'doc' }),
    })
    const newDoc = await res.json()
    router.push(`/docs/${newDoc.uuid}`)
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
    <div className="flex min-h-screen bg-background overflow-hidden">
      {isLoggedIn && (
        <Sidebar
          onNewNote={handleNewDoc}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
      )}

      <div
        className="flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out min-w-0"
        style={{ marginRight: detailOpen ? '280px' : '0' }}
      >
        <DocTopbar
          docTitle={title}
          folder={folder}
          saveStatus={saveStatus}
          onDelete={isLoggedIn ? handleDelete : undefined}
          docId={id}
          isPublic={isPublic}
          sidebarWidth={sidebarWidth}
          wideMode={wideMode}
          onToggleWide={toggleWideMode}
        />

        <button
          onClick={() => setDetailOpen((v) => !v)}
          title={detailOpen ? 'Close details' : 'Open details'}
          className={`fixed top-[10px] right-4 z-40 flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
            detailOpen
              ? 'bg-white/10 text-white'
              : 'text-white/30 hover:text-white/60 hover:bg-white/5'
          }`}
        >
          <PanelRight size={15} />
        </button>

        <main className="flex-1 overflow-y-auto pt-[44px]">
          <div
            className={`mx-auto w-full px-16 pt-16 pb-32 transition-all duration-200 ${
              wideMode ? 'max-w-[1200px]' : 'max-w-[800px]'
            }`}
          >
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

              {/* Label pills below title */}
              {docLabels.length > 0 && (
                <>
                  <span className="text-[#444] select-none">·</span>
                  {docLabels.map(label => (
                    <div
                      key={label.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/8 text-xs text-[#888]"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                      <span>{label.name}</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {doc !== null && (
              <Editor
                content={content}
                editable={isLoggedIn}
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

      {/* Detail panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[280px] border-l border-white/6 bg-[#141414] flex flex-col z-30 transition-transform duration-300 ease-in-out ${
          detailOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 h-[44px] border-b border-white/6 shrink-0">
          <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Details</span>
          <button
            onClick={() => setDetailOpen(false)}
            className="flex items-center justify-center w-6 h-6 rounded-md text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-1">

          <p className="text-[10px] font-medium text-white/20 uppercase tracking-wider mb-2">Document</p>

          <DetailRow label="Created" icon={<CalendarDays size={12} />}>
            <span className="text-white/50">{formatDate(doc.created_at)}</span>
          </DetailRow>

          <DetailRow label="Author" icon={<User size={12} />}>
            {currentUser ? (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-[#3a3a3a] border border-white/10 flex items-center justify-center text-[8px] font-medium text-[#ccc]">
                  {getInitials(currentUser.name, currentUser.email)}
                </div>
                <span className="text-white/50 truncate">{currentUser.name || currentUser.email}</span>
              </div>
            ) : (
              <span className="text-white/25">Unknown</span>
            )}
          </DetailRow>

          <DetailRow label="Words" icon={<FileText size={12} />}>
            <span className="text-white/50">{wordCount.toLocaleString()}</span>
          </DetailRow>

          <DetailRow label="Characters" icon={<Clock size={12} />}>
            <span className="text-white/50">{charCount.toLocaleString()}</span>
          </DetailRow>

          <div className="my-3 border-t border-white/5" />

          <p className="text-[10px] font-medium text-white/20 uppercase tracking-wider mb-2">Properties</p>

          {/* Priority */}
          <div className="flex items-center justify-between py-1.5 group">
            <span className="text-xs text-white/30 flex items-center gap-2">
              <span className="text-white/20">{activePriority.icon}</span>
              Priority
            </span>
            {isLoggedIn ? (
              <div className="relative" ref={priorityRef}>
                <button
                  onClick={() => setPriorityOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-white/40 hover:bg-white/5 hover:text-white/60 transition-colors"
                >
                  <span className={activePriority.color}>{activePriority.icon}</span>
                  <span>{activePriority.label}</span>
                </button>
                {priorityOpen && (
                  <div className="absolute bottom-full right-0 mb-1 z-50 w-44 rounded-lg border border-white/10 bg-[#1e1e1e] shadow-xl py-1">
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
            ) : (
              <span className={`text-xs px-2 py-1 ${activePriority.color}`}>{activePriority.label}</span>
            )}
          </div>

          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-white/30">Visibility</span>
            <span className="text-xs text-white/40 px-2 py-1">
              {isPublic ? 'Public' : 'Private'}
            </span>
          </div>

          {/* Labels */}
          {isLoggedIn && (
            <>
              <div className="my-3 border-t border-white/5" />
              <p className="text-[10px] font-medium text-white/20 uppercase tracking-wider mb-2">Labels</p>

              {/* Current doc labels */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {docLabels.map(label => (
                  <button
                    key={label.id}
                    onClick={() => handleToggleLabel(label)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/8 text-xs text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors group"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                    <span>{label.name}</span>
                    <X size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30" />
                  </button>
                ))}
              </div>

              {/* Label picker */}
              <div className="relative" ref={labelPickerRef}>
                <button
                  onClick={() => { setLabelPickerOpen(v => !v); setCreatingLabel(false) }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-white/30 hover:bg-white/5 hover:text-white/50 transition-colors"
                >
                  <Plus size={11} />
                  <span>Add label</span>
                </button>

                {labelPickerOpen && (
                  <div className="absolute bottom-full right-0 mb-1 z-50 w-52 rounded-lg border border-white/10 bg-[#1a1a1a] shadow-xl py-1">
                    {!creatingLabel ? (
                      <>
                        {allLabels.length === 0 && (
                          <p className="px-3 py-2 text-xs text-white/25">No labels yet</p>
                        )}
                        {allLabels.map(label => {
                          const isOn = docLabels.some(l => l.id === label.id)
                          return (
                            <button
                              key={label.id}
                              onClick={() => handleToggleLabel(label)}
                              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-white/5 transition-colors text-white/50"
                            >
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                              <span className="flex-1 text-left">{label.name}</span>
                              {isOn && <Check size={11} className="text-white/40" />}
                            </button>
                          )
                        })}
                        <div className="border-t border-white/5 mt-1 pt-1">
                          <button
                            onClick={() => setCreatingLabel(true)}
                            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-white/30 hover:bg-white/5 hover:text-white/50 transition-colors"
                          >
                            <Plus size={11} />
                            <span>Create new label</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="px-3 py-2 flex flex-col gap-2">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">New label</p>
                        <input
                          autoFocus
                          value={newLabelName}
                          onChange={e => setNewLabelName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleCreateLabel() }}
                          placeholder="Label name..."
                          className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:border-white/20"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {LABEL_COLORS.map(c => (
                            <button
                              key={c}
                              onClick={() => setNewLabelColor(c)}
                              className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${newLabelColor === c ? 'ring-2 ring-white/40 ring-offset-1 ring-offset-[#1a1a1a]' : ''}`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={handleCreateLabel}
                            className="flex-1 px-2 py-1.5 rounded-md bg-white/10 text-xs text-white/60 hover:bg-white/15 hover:text-white/80 transition-colors"
                          >
                            Create
                          </button>
                          <button
                            onClick={() => { setCreatingLabel(false); setNewLabelName('') }}
                            className="px-2 py-1.5 rounded-md text-xs text-white/30 hover:bg-white/5 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

function DetailRow({
  label,
  icon,
  children,
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-white/30 flex items-center gap-2">
        <span className="text-white/20">{icon}</span>
        {label}
      </span>
      <div className="text-xs">{children}</div>
    </div>
  )
}
