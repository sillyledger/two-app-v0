'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import Editor from '@/components/editor'
import DocTopbar from '@/components/doc-topbar'
import { CalendarDays, SignalLow, SignalMedium, SignalHigh, Minus, PanelRight, X, FileText, User, Clock, Plus, Check, Send, Trash2, Circle, CheckCircle2, Pencil, PanelLeftOpen } from 'lucide-react'
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

interface ActivityEntry {
  type: 'created' | 'edited'
  timestamp: string
  label: string
}

interface Comment {
  id: number
  user_id: string
  user_name: string
  body: string
  created_at: string
}

interface Task {
  id: number
  title: string
  due_date: string | null
  doc_id: string
  doc_title: string
  completed: boolean
  created_at: string
}

type Priority = 'low' | 'medium' | 'high' | null

const PRIORITIES: { value: Priority; label: string; icon: React.ReactNode; color: string }[] = [
  { value: null,     label: 'No priority', icon: <Minus size={12} />,        color: 'text-[var(--text-secondary)]' },
  { value: 'low',    label: 'Low',         icon: <SignalLow size={12} />,    color: 'text-[var(--text-secondary)]' },
  { value: 'medium', label: 'Medium',      icon: <SignalMedium size={12} />, color: 'text-[#d97706]' },
  { value: 'high',   label: 'High',        icon: <SignalHigh size={12} />,   color: 'text-[#dc2626]' },
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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return formatDate(dateStr)
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
  const params = useParams()
  const docId = Array.isArray(params.id) ? params.id[0] : (params.id as string)
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
  const [headerPriorityOpen, setHeaderPriorityOpen] = useState(false)
  const headerPriorityRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const editorFocusRef = useRef<(() => void) | null>(null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [docLabels, setDocLabels] = useState<Label[]>([])
  const [allLabels, setAllLabels] = useState<Label[]>([])
  const [labelPickerOpen, setLabelPickerOpen] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#888888')
  const [creatingLabel, setCreatingLabel] = useState(false)
  const labelPickerRef = useRef<HTMLDivElement>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const insertImageRef = useRef<((url: string) => void) | null>(null)

  // Label editing state
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null)
  const [editingLabelName, setEditingLabelName] = useState('')
  const [editingLabelColor, setEditingLabelColor] = useState('')

  const [tasks, setTasks] = useState<Task[]>([])
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const newTaskInputRef = useRef<HTMLInputElement>(null)
  const [hoveredTaskId, setHoveredTaskId] = useState<number | null>(null)

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
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setPriorityOpen(false)
      if (headerPriorityRef.current && !headerPriorityRef.current.contains(e.target as Node)) setHeaderPriorityOpen(false)
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
    if (!isLoggedIn || !docId) return
    fetch('/api/labels').then(r => r.json()).then(data => { if (Array.isArray(data)) setAllLabels(data) })
    fetch(`/api/docs/${docId}/labels`).then(r => r.json()).then(data => { if (Array.isArray(data)) setDocLabels(data) })
    fetch(`/api/comments?docId=${docId}`).then(r => r.json()).then(data => { if (Array.isArray(data)) setComments(data) })
    fetch('/api/tasks')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTasks(data.filter((t: Task) => String(t.doc_id) === String(docId)))
        }
      })
      .catch(() => {})
  }, [isLoggedIn, docId])

  useEffect(() => {
    if (!authChecked) return
    if (isLoggedIn) {
      fetch(`/api/docs/${docId}`).then((res) => res.json()).then((data: Doc) => {
        if (data.error) { router.push('/'); return }
        setDoc(data)
        setTitle(data.title)
        setContent(data.content || '')
        setIsPublic(data.is_public ?? false)
        setPriority((data.priority as Priority) ?? null)
        setLastSaved(data.updated_at ?? null)
        setIsFavorite(data.is_starred ?? false)
        if (data.folder_id && data.folder_name) {
          setFolder({ id: data.folder_id, name: data.folder_name })
        }
      })
    } else {
      fetch(`/api/docs/public/${docId}`).then((res) => res.json()).then((data: Doc) => {
        if (data.error) { router.push('/login'); return }
        setDoc(data)
        setTitle(data.title)
        setContent(data.content || '')
        setIsPublic(data.is_public ?? false)
        setPriority((data.priority as Priority) ?? null)
        setLastSaved(data.updated_at ?? null)
      })
    }
  }, [docId, authChecked])

  useEffect(() => { resizeTitle() }, [title])

  const handleSave = useCallback(async (latestTitle: string, latestContent: string, latestDoc: Doc | null) => {
    if (!isLoggedIn) return
    setSaveStatus('saving')
    await fetch(`/api/docs/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: latestTitle, content: latestContent, color: latestDoc?.color ?? 'yellow' }),
    })
    setSaveStatus('saved')
    setLastSaved(new Date().toISOString())
  }, [docId, isLoggedIn])

  useEffect(() => {
    if (!doc || !isLoggedIn) return
    setSaveStatus('unsaved')
    const timer = setTimeout(() => { handleSave(title, content, doc) }, 1000)
    return () => clearTimeout(timer)
  }, [title, content])

  const handlePriorityChange = async (value: Priority) => {
    setPriority(value)
    setPriorityOpen(false)
    setHeaderPriorityOpen(false)
    await fetch(`/api/docs/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: value }),
    })
  }

  const handleToggleLabel = async (label: Label) => {
    const isOn = docLabels.some(l => l.id === label.id)
    if (isOn) {
      await fetch(`/api/docs/${docId}/labels`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ labelId: label.id }) })
      setDocLabels(prev => prev.filter(l => l.id !== label.id))
    } else {
      await fetch(`/api/docs/${docId}/labels`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ labelId: label.id }) })
      setDocLabels(prev => [...prev, label])
    }
  }

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return
    const res = await fetch('/api/labels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newLabelName.trim(), color: newLabelColor }) })
    const created = await res.json()
    setAllLabels(prev => [...prev, created])
    await fetch(`/api/docs/${docId}/labels`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ labelId: created.id }) })
    setDocLabels(prev => [...prev, created])
    setNewLabelName('')
    setNewLabelColor('#888888')
    setCreatingLabel(false)
  }

  const handleEditLabel = async (label: Label) => {
    if (!editingLabelName.trim()) return
    const res = await fetch(`/api/labels/${label.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingLabelName.trim(), color: editingLabelColor }),
    })
    const updated = await res.json()
    setAllLabels(prev => prev.map(l => l.id === label.id ? updated : l))
    setDocLabels(prev => prev.map(l => l.id === label.id ? updated : l))
    setEditingLabelId(null)
  }

  const handleDeleteLabel = async (labelId: number) => {
    await fetch(`/api/labels/${labelId}`, { method: 'DELETE' })
    setAllLabels(prev => prev.filter(l => l.id !== labelId))
    setDocLabels(prev => prev.filter(l => l.id !== labelId))
    setEditingLabelId(null)
  }

  const handlePostComment = async () => {
    if (!commentBody.trim() || postingComment) return
    setPostingComment(true)
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId, body: commentBody.trim(), userName: currentUser?.name || currentUser?.email || 'Anonymous' }),
    })
    const created = await res.json()
    setComments(prev => [...prev, created])
    setCommentBody('')
    setPostingComment(false)
  }

  const handleDeleteComment = async (commentId: number) => {
    await fetch('/api/comments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commentId }) })
    setComments(prev => prev.filter(c => c.id !== commentId))
  }

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTaskTitle.trim(),
        due_date: newTaskDueDate || null,
        doc_id: docId,
        doc_title: title || 'Untitled',
      }),
    })
    const created = await res.json()
    setTasks(prev => [created, ...prev])
    setNewTaskTitle('')
    setNewTaskDueDate('')
    setAddingTask(false)
  }

  const handleToggleTask = async (task: Task) => {
    const updated = { ...task, completed: !task.completed }
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, completed: updated.completed }),
    })
  }

  const handleDeleteTask = async (taskId: number) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    await fetch('/api/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId }),
    })
  }

  const handleNewDoc = async () => {
    const res = await fetch('/api/docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Untitled', content: '', color: 'yellow', type: 'doc' }) })
    const newDoc = await res.json()
    router.push(`/docs/${newDoc.uuid}`)
  }

  const handleToggleFavorite = async () => {
    const newValue = !isFavorite
    setIsFavorite(newValue)
    await fetch(`/api/docs/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_starred: newValue }),
    })
  }

  const handleDelete = async () => {
    await fetch(`/api/docs/${docId}`, { method: 'DELETE' })
    router.push('/')
  }

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

  const sidebarWidth = collapsed ? '56px' : '256px'
  const wordCount = getWordCount(content)
  const charCount = getCharCount(content)
  const activePriority = PRIORITIES.find(p => p.value === priority) ?? PRIORITIES[0]

  const activityEntries: ActivityEntry[] = []
  if (doc) {
    const createdAt = doc.created_at
    const editedAt = lastSaved ?? doc.updated_at
    const isEdited = editedAt && createdAt && Math.abs(new Date(editedAt).getTime() - new Date(createdAt).getTime()) > 5000
    if (isEdited) activityEntries.push({ type: 'edited', timestamp: editedAt!, label: 'Last edited' })
    if (createdAt) activityEntries.push({ type: 'created', timestamp: createdAt, label: 'Created' })
  }

  if (!authChecked || !doc) return null

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (file) {
            const url = await handleImageUpload(file)
            if (url && insertImageRef.current) {
              insertImageRef.current(url)
            }
          }
          e.target.value = ""
        }}
      />

      {/* ── Floating sidebar open button — only shows when sidebar is collapsed ── */}
      {/* This fixes the PWA bug where the toggle button gets hidden under the breadcrumbs */}
      {isLoggedIn && collapsed && (
        <button
          onClick={() => { localStorage.setItem("sidebar-collapsed", "false"); setCollapsed(false) }}
          style={{
            position: 'fixed',
            top: 10,
            left: 10,
            zIndex: 100,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#6a6a74',
            padding: 6,
            display: 'flex',
            borderRadius: 6,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ccc')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6a6a74')}
        >
          <PanelLeftOpen size={16} />
        </button>
      )}

      {isLoggedIn && (
        <Sidebar onNewNote={handleNewDoc} collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      )}

      <div
        className="flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out min-w-0 overflow-hidden"
        style={{ marginRight: detailOpen ? '280px' : '0' }}
      >
        <DocTopbar
          docTitle={title}
          folder={folder}
          saveStatus={saveStatus}
          onDelete={isLoggedIn ? handleDelete : undefined}
          docId={docId}
          isPublic={isPublic}
          sidebarWidth={sidebarWidth}
          wideMode={wideMode}
          onToggleWide={toggleWideMode}
          isFavorite={isFavorite}
          onToggleFavorite={isLoggedIn ? handleToggleFavorite : undefined}
        />

        <button
          onClick={() => setDetailOpen((v) => !v)}
          title={detailOpen ? 'Close details' : 'Open details'}
          className="fixed top-[10px] right-4 z-40 flex items-center justify-center w-7 h-7 rounded-md transition-colors"
          style={{
            color: detailOpen ? 'var(--text-primary)' : 'var(--text-muted)',
            backgroundColor: detailOpen ? 'var(--bg-tertiary)' : 'transparent',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = detailOpen ? 'var(--bg-tertiary)' : 'transparent'; e.currentTarget.style.color = detailOpen ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          <PanelRight size={15} />
        </button>

        <main className="flex-1 overflow-y-auto pt-[44px]">
          <div className={`mx-auto w-full px-16 pt-16 pb-32 transition-all duration-200 ${wideMode ? 'max-w-[1200px]' : 'max-w-[800px]'}`}>
            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => { if (!isLoggedIn) return; setTitle(e.target.value); resizeTitle() }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editorFocusRef.current?.() } }}
              placeholder="Untitled"
              rows={1}
              readOnly={!isLoggedIn}
              className="mb-5 block w-full resize-none overflow-hidden bg-transparent text-[2.375rem] font-bold leading-[1.2] tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />

            <div className="mb-8 flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-[var(--border)] text-xs text-[#888]">
                <CalendarDays size={12} className="text-[#666]" />
                <span>{formatDate(doc.created_at)}</span>
              </div>
              <span className="text-[#444] select-none">·</span>
              {currentUser ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-[var(--border)] text-xs text-[#888]">
                  <span>{currentUser.name || currentUser.email}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-[var(--border)] text-xs text-[#555]">
                  <span>Unknown</span>
                </div>
              )}
              <span className="text-[#444] select-none">·</span>
              {isLoggedIn && (
                <div className="relative" ref={headerPriorityRef}>
                  <button
                    onClick={() => setHeaderPriorityOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-[var(--border)] text-xs text-[#888] hover:bg-white/10 hover:text-[#aaa] transition-colors"
                  >
                    <span className={activePriority.color}>{activePriority.icon}</span>
                    <span>{activePriority.label}</span>
                  </button>
                  {headerPriorityOpen && (
                    <div className="absolute top-full mt-1.5 left-0 z-50 w-44 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] shadow-xl py-1">
                      {PRIORITIES.map((p) => (
                        <button key={String(p.value)} onClick={() => handlePriorityChange(p.value)}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors`}
                        style={{ color: priority === p.value ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          <span className={p.color}>{p.icon}</span>
                          <span>{p.label}</span>
                          {priority === p.value && <span className="ml-auto text-[#555]">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {docLabels.length > 0 && (
                <>
                  <span className="text-[#444] select-none">·</span>
                  {docLabels.map(label => (
                    <div key={label.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-[var(--border)] text-xs text-[#888]">
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
                onChange={(newContent) => { if (!isLoggedIn) return; setContent(newContent) }}
                onReady={(focusFn) => { editorFocusRef.current = focusFn }}
                onImageUpload={handleImageUpload}
                onInsertImageReady={(fn) => { insertImageRef.current = fn }}
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

      <div
        className={`fixed top-0 right-0 h-full w-[280px] flex flex-col z-30 transition-transform duration-300 ease-in-out ${detailOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ backgroundColor: 'var(--bg)', borderLeft: '1px solid var(--border)' }}
      >
        <div
          className="flex-1 overflow-y-auto flex flex-col gap-1"
          style={{ padding: '56px 16px 20px', color: 'var(--text-primary)' }}
        >
          {isLoggedIn && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Tasks {tasks.length > 0 && `· ${tasks.length}`}
                </p>
                <button
                  onClick={() => { setAddingTask(true); setTimeout(() => newTaskInputRef.current?.focus(), 50) }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                >
                  <Plus size={11} />
                  Add
                </button>
              </div>

              {addingTask && (
                <div
                  className="rounded-lg p-2.5 mb-3 flex flex-col gap-2"
                  style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                >
                  <input
                    ref={newTaskInputRef}
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddTask()
                      if (e.key === 'Escape') { setAddingTask(false); setNewTaskTitle(''); setNewTaskDueDate('') }
                    }}
                    placeholder="Task title..."
                    className="w-full bg-transparent text-[12px] focus:outline-none"
                    style={{ color: 'var(--text-primary)' }}
                  />
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={e => setNewTaskDueDate(e.target.value)}
                    className="w-full rounded-md px-2 py-1 text-[11px] focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', colorScheme: 'dark' }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setAddingTask(false); setNewTaskTitle(''); setNewTaskDueDate('') }}
                      className="px-2 py-1 rounded-md text-[11px] transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddTask}
                      disabled={!newTaskTitle.trim()}
                      className="px-2 py-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-30"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                    >
                      Add task
                    </button>
                  </div>
                </div>
              )}

              {tasks.length === 0 && !addingTask && (
                <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>No tasks yet.</p>
              )}

              <div className="flex flex-col gap-0.5 mb-3">
                {tasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-start gap-2 py-1.5 px-1 rounded-md"
                    style={{ backgroundColor: hoveredTaskId === task.id ? 'var(--bg-tertiary)' : 'transparent' }}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                  >
                    <button
                      onClick={() => handleToggleTask(task)}
                      className="mt-[1px] shrink-0"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {task.completed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span
                        style={{
                          display: 'block',
                          fontSize: '12px',
                          lineHeight: '1.4',
                          color: 'var(--text-primary)',
                          textDecoration: task.completed ? 'line-through' : 'none',
                          opacity: task.completed ? 0.5 : 1,
                        }}
                      >
                        {task.title}
                      </span>
                      {task.due_date && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <CalendarDays size={9} />
                          {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="shrink-0 mt-[1px]"
                      style={{ color: hoveredTaskId === task.id ? 'var(--text-muted)' : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#e05252')}
                      onMouseLeave={e => (e.currentTarget.style.color = hoveredTaskId === task.id ? 'var(--text-muted)' : 'transparent')}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-t mb-1" style={{ borderColor: 'var(--border)' }} />
            </>
          )}

          <p className="text-[10px] font-medium uppercase tracking-wider mb-2 mt-3" style={{ color: 'var(--text-muted)' }}>Document</p>

          <DetailRow label="Created" icon={<CalendarDays size={12} />}>
            <span style={{ color: 'var(--text-primary)' }}>{formatDate(doc.created_at)}</span>
          </DetailRow>
          <DetailRow label="Author" icon={<User size={12} />}>
            {currentUser ? (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-medium" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  {getInitials(currentUser.name, currentUser.email)}
                </div>
                <span className="truncate" style={{ color: 'var(--text-primary)' }}>{currentUser.name || currentUser.email}</span>
              </div>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Unknown</span>
            )}
          </DetailRow>
          <DetailRow label="Words" icon={<FileText size={12} />}>
            <span style={{ color: 'var(--text-primary)' }}>{wordCount.toLocaleString()}</span>
          </DetailRow>
          <DetailRow label="Characters" icon={<Clock size={12} />}>
            <span style={{ color: 'var(--text-primary)' }}>{charCount.toLocaleString()}</span>
          </DetailRow>

          <div className="my-3 border-t" style={{ borderColor: 'var(--border)' }} />
          <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Properties</p>

          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>Priority</span>
            {isLoggedIn ? (
              <div className="relative" ref={priorityRef}>
                <button
                  onClick={() => setPriorityOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span className={activePriority.color}>{activePriority.icon}</span>
                  <span>{activePriority.label}</span>
                </button>
                {priorityOpen && (
                  <div className="absolute bottom-full right-0 mb-1 z-50 w-44 rounded-lg shadow-xl py-1" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                    {PRIORITIES.map((p) => (
                      <button key={String(p.value)} onClick={() => handlePriorityChange(p.value)}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors"
                        style={{ color: priority === p.value ? 'var(--text-primary)' : 'var(--text-muted)' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <span className={p.color}>{p.icon}</span>
                        <span>{p.label}</span>
                        {priority === p.value && <span className="ml-auto">✓</span>}
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
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Visibility</span>
            <span className="text-xs px-2 py-1" style={{ color: 'var(--text-secondary)' }}>{isPublic ? 'Public' : 'Private'}</span>
          </div>

          {isLoggedIn && (
            <>
              <div className="my-3 border-t" style={{ borderColor: 'var(--border)' }} />
              <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Labels</p>

              <div className="flex flex-col gap-0.5 mb-2">
                {allLabels.map(label => {
                  const isOn = docLabels.some(l => l.id === label.id)
                  const isEditing = editingLabelId === label.id
                  return (
                    <div key={label.id}>
                      {isEditing ? (
                        <div
                          className="rounded-lg p-2 flex flex-col gap-2 mb-1"
                          style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                        >
                          <input
                            autoFocus
                            value={editingLabelName}
                            onChange={e => setEditingLabelName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleEditLabel(label)
                              if (e.key === 'Escape') setEditingLabelId(null)
                            }}
                            className="w-full bg-transparent text-[12px] focus:outline-none"
                            style={{ color: 'var(--text-primary)' }}
                          />
                          <div className="flex flex-wrap gap-1">
                            {LABEL_COLORS.map(c => (
                              <button
                                key={c}
                                onClick={() => setEditingLabelColor(c)}
                                className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${editingLabelColor === c ? 'ring-2 ring-offset-1' : ''}`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => handleDeleteLabel(label.id)}
                              className="text-[11px] transition-colors"
                              style={{ color: '#e05252' }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#e05252')}
                            >
                              Delete label
                            </button>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingLabelId(null)}
                                className="px-2 py-1 rounded-md text-[11px] transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleEditLabel(label)}
                                className="px-2 py-1 rounded-md text-[11px] font-medium transition-colors"
                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="group flex items-center gap-2 py-1 px-1 rounded-md"
                          style={{ backgroundColor: 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <button
                            onClick={() => handleToggleLabel(label)}
                            className="flex items-center gap-1.5 flex-1 min-w-0"
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                            <span className="text-[12px] truncate" style={{ color: isOn ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label.name}</span>
                            {isOn && <Check size={10} className="shrink-0 ml-auto" style={{ color: 'var(--text-secondary)' }} />}
                          </button>
                          <button
                            onClick={() => {
                              setEditingLabelId(label.id)
                              setEditingLabelName(label.name)
                              setEditingLabelColor(label.color)
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                          >
                            <Pencil size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {allLabels.length === 0 && (
                <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>No labels yet.</p>
              )}

              <div className="relative" ref={labelPickerRef}>
                <button
                  onClick={() => { setLabelPickerOpen(v => !v); setCreatingLabel(false) }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                >
                  <Plus size={11} />
                  <span>Create label</span>
                </button>
                {labelPickerOpen && (
                  <div className="absolute bottom-full right-0 mb-1 z-50 w-52 rounded-lg shadow-xl py-1" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div className="px-3 py-2 flex flex-col gap-2">
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>New label</p>
                      <input
                        autoFocus
                        value={newLabelName}
                        onChange={e => setNewLabelName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreateLabel() }}
                        placeholder="Label name..."
                        className="w-full rounded-md px-2 py-1.5 text-xs focus:outline-none"
                        style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {LABEL_COLORS.map(c => (
                          <button key={c} onClick={() => setNewLabelColor(c)}
                            className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${newLabelColor === c ? 'ring-2 ring-offset-1' : ''}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button onClick={handleCreateLabel}
                          className="flex-1 px-2 py-1.5 rounded-md text-xs transition-colors"
                          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                        >Create</button>
                        <button onClick={() => { setLabelPickerOpen(false); setNewLabelName('') }}
                          className="px-2 py-1.5 rounded-md text-xs transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {isLoggedIn && activityEntries.length > 0 && (
            <>
              <div className="my-3 border-t" style={{ borderColor: 'var(--border)' }} />
              <p className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Activity</p>
              <div className="flex flex-col gap-3">
                {activityEntries.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="flex flex-col items-center mt-0.5 shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: entry.type === 'created' ? 'rgba(16,185,129,0.6)' : 'var(--bg-tertiary)' }} />
                      {i < activityEntries.length - 1 && <div className="w-px h-5 mt-1" style={{ backgroundColor: 'var(--border)' }} />}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {currentUser && (
                          <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-medium shrink-0" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                            {getInitials(currentUser.name, currentUser.email)}
                          </div>
                        )}
                        <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{currentUser?.name || currentUser?.email || 'You'}</span>
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{entry.label.toLowerCase()}</span>
                      </div>
                      <span className="text-[10px] ml-5" style={{ color: 'var(--text-muted)' }} title={formatDateTime(entry.timestamp)}>{timeAgo(entry.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {isLoggedIn && (
            <>
              <div className="my-3 border-t" style={{ borderColor: 'var(--border)' }} />
              <p className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Comments {comments.length > 0 && `· ${comments.length}`}
              </p>
              <div className="flex flex-col gap-3 mb-3">
                {comments.length === 0 && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No comments yet.</p>}
                {comments.map(comment => (
                  <div key={comment.id} className="flex items-start gap-2 group">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-medium shrink-0 mt-0.5" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                      {comment.user_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{comment.user_name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{timeAgo(comment.created_at)}</span>
                          {comment.user_id === String(currentUser?.id) && (
                            <button onClick={() => handleDeleteComment(comment.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 ml-1"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[12px] mt-0.5 leading-relaxed break-words" style={{ color: 'var(--text-secondary)' }}>{comment.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <textarea
                  ref={commentInputRef}
                  value={commentBody}
                  onChange={e => setCommentBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment() } }}
                  placeholder="Add a comment..."
                  rows={2}
                  className="w-full rounded-lg px-3 py-2 text-[12px] focus:outline-none resize-none"
                  style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
                <button onClick={handlePostComment} disabled={!commentBody.trim() || postingComment}
                  className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-30"
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                  <Send size={11} />
                  {postingComment ? 'Posting...' : 'Post'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
        {label}
      </span>
      <div className="text-xs">{children}</div>
    </div>
  )
}
