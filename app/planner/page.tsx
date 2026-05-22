'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import Link from 'next/link'
import { CheckCircle2, Circle, Trash2, CalendarDays, FileText } from 'lucide-react'

interface Task {
  id: number
  title: string
  due_date: string | null
  doc_id: string
  doc_title: string
  completed: boolean
  created_at: string
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

export default function PlannerPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) {
        router.push('/login')
      } else {
        setAuthChecked(true)
      }
    })
  }, [])

  useEffect(() => {
    if (!authChecked) return
    fetch('/api/tasks')
      .then(r => r.json())
      .then(data => {
        setTasks(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [authChecked])

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

  if (!authChecked) return null

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

      <main className="flex-1 overflow-y-auto px-10 py-12" style={{ maxWidth: '720px' }}>
        <div className="mb-8">
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Planner
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Tasks linked to your docs
          </p>
        </div>

        {loading && (
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading...</p>
        )}

        {!loading && tasks.length === 0 && (
          <div
            className="rounded-xl p-8 text-center"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No tasks yet</p>
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Open a doc and use the detail panel to add tasks.
            </p>
          </div>
        )}

        {overdueTasks.length > 0 && (
          <TaskGroup label="Overdue" labelColor="#e05252" tasks={overdueTasks} onToggle={toggle} onDelete={remove} showDate />
        )}
        {todayTasks.length > 0 && (
          <TaskGroup label="Today" tasks={todayTasks} onToggle={toggle} onDelete={remove} />
        )}
        {upcomingTasks.length > 0 && (
          <TaskGroup label="Upcoming" tasks={upcomingTasks} onToggle={toggle} onDelete={remove} showDate />
        )}
        {nodateTasks.length > 0 && (
          <TaskGroup label="No date" tasks={nodateTasks} onToggle={toggle} onDelete={remove} />
        )}
        {completedTasks.length > 0 && (
          <TaskGroup label="Completed" tasks={completedTasks} onToggle={toggle} onDelete={remove} muted />
        )}
      </main>
    </div>
  )
}

function TaskGroup({
  label,
  labelColor,
  tasks,
  onToggle,
  onDelete,
  showDate = false,
  muted = false,
}: {
  label: string
  labelColor?: string
  tasks: Task[]
  onToggle: (t: Task) => void
  onDelete: (id: number) => void
  showDate?: boolean
  muted?: boolean
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: labelColor ?? 'var(--text-muted)' }}
        >
          {label}
        </span>
        <span
          className="text-[11px] font-medium px-1.5 py-0.5 rounded-md"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        >
          {tasks.length}
        </span>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}
      >
        {tasks.map((task, i) => (
          <div
            key={task.id}
            className="flex items-start gap-3 px-4 py-3"
            style={{
              borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              opacity: muted ? 0.5 : 1,
              backgroundColor: 'var(--bg-secondary)',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
          >
            <button
              onClick={() => onToggle(task)}
              className="mt-[2px] shrink-0"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {task.completed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            </button>

            <div className="flex-1 min-w-0">
              <span
                style={{
                  display: 'block',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  color: 'var(--text-primary)',
                  textDecoration: task.completed ? 'line-through' : 'none',
                  opacity: task.completed ? 0.5 : 1,
                }}
              >
                {task.title}
              </span>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Link
                  href={`/docs/${task.doc_id}`}
                  className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md"
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                  <FileText size={10} />
                  <span>{task.doc_title || 'Untitled doc'}</span>
                </Link>
                {showDate && task.due_date && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <CalendarDays size={10} />
                    {formatDueDate(task.due_date)}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => onDelete(task.id)}
              className="shrink-0 mt-[2px]"
              style={{ color: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#e05252')}
              onMouseLeave={e => (e.currentTarget.style.color = 'transparent')}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
