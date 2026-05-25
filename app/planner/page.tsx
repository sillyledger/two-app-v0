'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import Link from 'next/link'
import { CheckCircle2, Circle, Trash2, CalendarDays, FileText, Plus } from 'lucide-react'

interface Task {
  id: number
  title: string
  due_date: string | null
  doc_id: string
  doc_title: string
  completed: boolean
  created_at: string
  priority: string | null
}

interface Doc {
  uuid: string
  title: string
}

type FilterTab = 'all' | 'today' | 'upcoming' | 'overdue' | 'completed'

const PRIORITY_COLORS: Record<string, string> = {
  high: '#e05252',
  medium: '#e09a52',
  low: '#52a0e0',
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getUTCFullYear() === now.getFullYear() &&
    d.getUTCMonth() === now.getMonth() &&
    d.getUTCDate() === now.getDate()
  )
}

function isUpcoming(dateStr: string): boolean {
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const d = new Date(dateStr)
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  return target > today
}

function isPast(dateStr: string): boolean {
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const d = new Date(dateStr)
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  return target < today
}

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const FONT = "'DM Sans', system-ui, sans-serif"
const MUTED = '#6a6a74'

export default function PlannerPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskPriority, setTaskPriority] = useState('medium')
  const [docQuery, setDocQuery] = useState('')
  const [docResults, setDocResults] = useState<Doc[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null)
  const [docDropdownOpen, setDocDropdownOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const taskTitleRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) router.push('/login')
      else setAuthChecked(true)
    })
  }, [])

  useEffect(() => {
    if (!authChecked) return
    fetch('/api/tasks')
      .then(r => r.json())
      .then(data => { setTasks(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [authChecked])

  // Fetch docs for autocomplete
  useEffect(() => {
    if (!docQuery.trim()) { setDocResults([]); return }
    const timeout = setTimeout(() => {
      fetch('/api/docs')
        .then(r => r.json())
        .then(data => {
          const all: Doc[] = Array.isArray(data) ? data : []
          const filtered = all.filter(d =>
            (d.title || 'Untitled').toLowerCase().includes(docQuery.toLowerCase())
          )
          setDocResults(filtered.slice(0, 8))
          setDocDropdownOpen(true)
        })
        .catch(() => {})
    }, 150)
    return () => clearTimeout(timeout)
  }, [docQuery])

  const openModal = () => {
    setTaskTitle('')
    setTaskDueDate('')
    setTaskPriority('medium')
    setDocQuery('')
    setDocResults([])
    setSelectedDoc(null)
    setDocDropdownOpen(false)
    setShowModal(true)
    setTimeout(() => taskTitleRef.current?.focus(), 50)
  }

  const handleAddTask = async () => {
    if (!taskTitle.trim() || !selectedDoc) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle.trim(),
          doc_id: selectedDoc.uuid,
          doc_title: selectedDoc.title || 'Untitled',
          due_date: taskDueDate || null,
          priority: taskPriority,
        }),
      })
      const newTask = await res.json()
      setTasks(prev => [newTask, ...prev])
      setShowModal(false)
    } finally {
      setSubmitting(false)
    }
  }

  const toggle = async (task: Task) => {
    const updated = { ...task, completed: !task.completed }
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, completed: updated.completed }),
    })
  }

  const remove = async (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch('/api/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  const active = tasks.filter(t => !t.completed)
  const todayTasks = active.filter(t => t.due_date && isToday(t.due_date))
  const overdueTasks = active.filter(t => t.due_date && isPast(t.due_date))
  const upcomingTasks = active.filter(t => t.due_date && isUpcoming(t.due_date))
  const nodateTasks = active.filter(t => !t.due_date)
  const completedTasks = tasks.filter(t => t.completed)

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: tasks.length },
    { key: 'today', label: 'Today', count: todayTasks.length },
    { key: 'upcoming', label: 'Upcoming', count: upcomingTasks.length },
    { key: 'overdue', label: 'Overdue', count: overdueTasks.length },
    { key: 'completed', label: 'Completed', count: completedTasks.length },
  ]

  if (!authChecked) return null

  const showOverdue = activeTab === 'all' || activeTab === 'overdue'
  const showToday = activeTab === 'all' || activeTab === 'today'
  const showUpcoming = activeTab === 'all' || activeTab === 'upcoming'
  const showNoDate = activeTab === 'all'
  const showCompleted = activeTab === 'all' || activeTab === 'completed'

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => {
          const next = !collapsed
          setCollapsed(next)
          localStorage.setItem('sidebar-collapsed', String(next))
        }}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-10 py-12">

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-[32px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Planner
              </h1>
              <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
                Tasks linked to your docs
              </p>
            </div>
            <button
              onClick={openModal}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                color: '#fff', background: '#6b5ce7', border: 'none', cursor: 'pointer',
                fontFamily: FONT, marginTop: 6,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#7c6ef0')}
              onMouseLeave={e => (e.currentTarget.style.background = '#6b5ce7')}
            >
              <Plus size={14} />
              Add Task
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-2 flex-wrap mb-8">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 px-3.5 py-[5px] rounded-full text-[13px] font-medium transition-colors"
                style={{
                  backgroundColor: activeTab === tab.key ? 'var(--text-primary)' : 'var(--bg-secondary)',
                  color: activeTab === tab.key ? 'var(--bg)' : 'var(--text-secondary)',
                  border: activeTab === tab.key ? '1px solid transparent' : '1px solid var(--border)',
                }}
              >
                {tab.label}
                {tab.count > 0 && <span className="text-[11px]" style={{ opacity: 0.6 }}>{tab.count}</span>}
              </button>
            ))}
          </div>

          {loading && <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading...</p>}

          {!loading && tasks.length === 0 && (
            <div className="rounded-xl p-8 text-center" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No tasks yet</p>
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Click + Add Task to get started.</p>
            </div>
          )}

          {showOverdue && overdueTasks.length > 0 && <TaskGroup label="Overdue" labelColor="#e05252" tasks={overdueTasks} onToggle={toggle} onDelete={remove} showDate />}
          {showToday && todayTasks.length > 0 && <TaskGroup label="Today" tasks={todayTasks} onToggle={toggle} onDelete={remove} />}
          {showUpcoming && upcomingTasks.length > 0 && <TaskGroup label="Upcoming" tasks={upcomingTasks} onToggle={toggle} onDelete={remove} showDate />}
          {showNoDate && nodateTasks.length > 0 && <TaskGroup label="No date" tasks={nodateTasks} onToggle={toggle} onDelete={remove} />}
          {showCompleted && completedTasks.length > 0 && <TaskGroup label="Completed" tasks={completedTasks} onToggle={toggle} onDelete={remove} muted />}

          {!loading && tasks.length > 0 && activeTab === 'today' && todayTasks.length === 0 && <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No tasks due today.</p>}
          {!loading && tasks.length > 0 && activeTab === 'upcoming' && upcomingTasks.length === 0 && <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No upcoming tasks.</p>}
          {!loading && tasks.length > 0 && activeTab === 'overdue' && overdueTasks.length === 0 && <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No overdue tasks.</p>}
          {!loading && tasks.length > 0 && activeTab === 'completed' && completedTasks.length === 0 && <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Nothing completed yet.</p>}

        </div>
      </main>

      {/* Add Task Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }} onClick={() => setShowModal(false)} />
          <div style={{ position: 'relative', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', width: 400, padding: '24px 24px 20px', zIndex: 10, background: '#1c1c1f', border: '1px solid rgba(255,255,255,0.09)', fontFamily: FONT }}>

            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20, color: '#eeede7', letterSpacing: '-0.01em' }}>New Task</h2>

            {/* Task name */}
            <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: MUTED, display: 'block', marginBottom: 6 }}>Task</label>
            <input
              ref={taskTitleRef}
              type="text"
              placeholder="What needs to be done?"
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); if (e.key === 'Escape') setShowModal(false) }}
              style={{ width: '100%', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e0dfd9', fontFamily: FONT, boxSizing: 'border-box', marginBottom: 16 }}
            />

            {/* Doc autocomplete */}
            <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: MUTED, display: 'block', marginBottom: 6 }}>Doc</label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input
                ref={docInputRef}
                type="text"
                placeholder="Search docs..."
                value={selectedDoc ? (selectedDoc.title || 'Untitled') : docQuery}
                onChange={e => { setSelectedDoc(null); setDocQuery(e.target.value) }}
                onFocus={() => { if (docResults.length > 0) setDocDropdownOpen(true) }}
                style={{ width: '100%', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: 'rgba(255,255,255,0.06)', border: selectedDoc ? '1px solid #6b5ce7' : '1px solid rgba(255,255,255,0.1)', color: '#e0dfd9', fontFamily: FONT, boxSizing: 'border-box' }}
              />
              {docDropdownOpen && docResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, borderRadius: 10, background: '#242428', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 60, overflow: 'hidden' }}>
                  {docResults.map(doc => (
                    <button
                      key={doc.uuid}
                      onClick={() => { setSelectedDoc(doc); setDocQuery(''); setDocDropdownOpen(false) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', fontSize: 13, color: '#b0afb8', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#e8e7e1' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#b0afb8' }}
                    >
                      <FileText size={12} style={{ flexShrink: 0, opacity: 0.5 }} />
                      {doc.title || 'Untitled'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Due date + Priority row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: MUTED, display: 'block', marginBottom: 6 }}>Due Date</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={e => setTaskDueDate(e.target.value)}
                  style={{ width: '100%', borderRadius: 9, padding: '9px 12px', fontSize: 13, outline: 'none', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: taskDueDate ? '#e0dfd9' : MUTED, fontFamily: FONT, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: MUTED, display: 'block', marginBottom: 6 }}>Priority</label>
                <select
                  value={taskPriority}
                  onChange={e => setTaskPriority(e.target.value)}
                  style={{ width: '100%', borderRadius: 9, padding: '9px 12px', fontSize: 13, outline: 'none', background: '#242428', border: '1px solid rgba(255,255,255,0.1)', color: '#e0dfd9', fontFamily: FONT, boxSizing: 'border-box', cursor: 'pointer' }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#5a5a62', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>Cancel</button>
              <button
                onClick={handleAddTask}
                disabled={!taskTitle.trim() || !selectedDoc || submitting}
                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: !taskTitle.trim() || !selectedDoc ? '#3a3a44' : '#6b5ce7', border: 'none', cursor: !taskTitle.trim() || !selectedDoc ? 'not-allowed' : 'pointer', fontFamily: FONT }}
                onMouseEnter={e => { if (taskTitle.trim() && selectedDoc) e.currentTarget.style.background = '#7c6ef0' }}
                onMouseLeave={e => { if (taskTitle.trim() && selectedDoc) e.currentTarget.style.background = '#6b5ce7' }}
              >
                {submitting ? 'Adding...' : 'Add Task'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

function TaskGroup({
  label, labelColor, tasks, onToggle, onDelete, showDate = false, muted = false,
}: {
  label: string; labelColor?: string; tasks: Task[]; onToggle: (t: Task) => void; onDelete: (id: number) => void; showDate?: boolean; muted?: boolean
}) {
  const PRIORITY_COLORS: Record<string, string> = { high: '#e05252', medium: '#e09a52', low: '#52a0e0' }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: labelColor ?? 'var(--text-muted)' }}>{label}</span>
        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{tasks.length}</span>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
        {tasks.map((task, i) => (
          <div
            key={task.id}
            className="flex items-start gap-3 px-4 py-3"
            style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none', opacity: muted ? 0.5 : 1, backgroundColor: 'var(--bg-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
          >
            <button onClick={() => onToggle(task)} className="mt-[2px] shrink-0" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
              {task.completed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            </button>
            <div className="flex-1 min-w-0">
              <span style={{ display: 'block', fontSize: '13px', lineHeight: '1.4', color: 'var(--text-primary)', textDecoration: task.completed ? 'line-through' : 'none', opacity: task.completed ? 0.5 : 1 }}>
                {task.title}
              </span>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Link href={`/docs/${task.doc_id}`} className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  <FileText size={10} /><span>{task.doc_title || 'Untitled doc'}</span>
                </Link>
                {showDate && task.due_date && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <CalendarDays size={10} />{formatDueDate(task.due_date)}
                  </span>
                )}
                {task.priority && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: PRIORITY_COLORS[task.priority] ?? 'var(--text-muted)', textTransform: 'capitalize', fontWeight: 500 }}>
                    {task.priority}
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => onDelete(task.id)} className="shrink-0 mt-[2px]" style={{ color: 'transparent' }} onMouseEnter={e => (e.currentTarget.style.color = '#e05252')} onMouseLeave={e => (e.currentTarget.style.color = 'transparent')}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
