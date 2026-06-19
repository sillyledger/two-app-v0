'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from '@/components/sidebar'
import TabBar from '@/components/tab-bar'
import { useTabStore } from '@/hooks/use-tab-store'
import { useRouter } from 'next/navigation'
import { Search, X, FileText, StickyNote } from 'lucide-react'
import SplitPane from '@/components/split-pane'

interface DocItem {
  type: 'doc'
  uuid: string
  title: string
  folder_name?: string | null
}

interface NoteItem {
  type: 'note'
  uuid: string
  title: string
  category_name?: string | null
}

type SplitItem = DocItem | NoteItem
type SplitTarget = { type: 'doc' | 'note'; id: string }

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { openTab } = useTabStore()

  const [collapsed, setCollapsed] = useState(false)
  const [splitActive, setSplitActive] = useState(false)
  const [splitTarget, setSplitTarget] = useState<SplitTarget | null>(null)
  const [splitPickerOpen, setSplitPickerOpen] = useState(false)
  const [splitItems, setSplitItems] = useState<SplitItem[]>([])
  const [splitQuery, setSplitQuery] = useState('')
  const [splitLoading, setSplitLoading] = useState(false)
  const [leftWidth, setLeftWidth] = useState(50)
  const dragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    const savedTarget = localStorage.getItem('split-target')
    if (savedTarget) {
      try {
        const parsed = JSON.parse(savedTarget)
        if (parsed?.type && parsed?.id) {
          setSplitTarget(parsed)
          setSplitActive(true)
        }
      } catch {
        localStorage.removeItem('split-target')
      }
    }
  }, [])

  // Listen for the Split View toggle fired from DocTopbar
  useEffect(() => {
    const handler = () => {
      if (!splitActive) {
        // Opening split — show doc/note picker
        setSplitPickerOpen(true)
        setSplitLoading(true)
        Promise.all([
          fetch('/api/docs').then(r => r.json()),
          fetch('/api/notes').then(r => r.json()),
        ]).then(([docsData, notesData]) => {
          const docs: DocItem[] = (Array.isArray(docsData) ? docsData : []).map((d: any) => ({
            type: 'doc', uuid: d.uuid, title: d.title, folder_name: d.folder_name,
          }))
          const notes: NoteItem[] = (Array.isArray(notesData) ? notesData : []).map((n: any) => ({
            type: 'note', uuid: n.uuid, title: n.title, category_name: n.category_name,
          }))
          setSplitItems([...docs, ...notes])
        }).catch(() => setSplitItems([]))
          .finally(() => setSplitLoading(false))
        setTimeout(() => searchRef.current?.focus(), 80)
      } else {
        // Closing split
        setSplitActive(false)
        setSplitTarget(null)
        setLeftWidth(50)
        localStorage.removeItem('split-target')
      }
    }
    window.addEventListener('toggle-split-view', handler)
    return () => window.removeEventListener('toggle-split-view', handler)
  }, [splitActive])

  // Close picker on outside click
  useEffect(() => {
    if (!splitPickerOpen) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setSplitPickerOpen(false)
        setSplitQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [splitPickerOpen])

  // Close picker on Escape
  useEffect(() => {
    if (!splitPickerOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSplitPickerOpen(false); setSplitQuery('') }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [splitPickerOpen])

  const handlePickSplitItem = (item: SplitItem) => {
    const target: SplitTarget = { type: item.type, id: item.uuid }
    setSplitTarget(target)
    setSplitActive(true)
    setSplitPickerOpen(false)
    setSplitQuery('')
    localStorage.setItem('split-target', JSON.stringify(target))
  }

  // Drag-to-resize the divider
  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setLeftWidth(Math.min(Math.max(pct, 25), 75))
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const handleNewDoc = async () => {
    const res = await fetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', content: '', color: 'yellow', type: 'doc' }),
    })
    const doc = await res.json()
    openTab(doc.uuid, 'Untitled')
    router.push(`/docs/${doc.uuid}`)
  }

  const sidebarWidth = collapsed ? '56px' : '256px'

  const filteredItems = splitItems.filter(d =>
    (d.title || 'Untitled').toLowerCase().includes(splitQuery.toLowerCase())
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar
        onNewNote={handleNewDoc}
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
      />

      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out"
        style={{ ['--sidebar-width' as string]: sidebarWidth }}
      >
        <TabBar />

        {/* Main content area — single or split */}
        {splitActive && splitTarget ? (
          <div ref={containerRef} className="flex flex-1 min-h-0" style={{ paddingTop: '0' }}>

            {/* Left pane — current doc */}
            <div className="min-w-0 overflow-hidden flex flex-col" style={{ width: `${leftWidth}%` }}>
              <div className="flex-1 overflow-y-auto h-full" style={{ paddingTop: 0 }}>
                {children}
              </div>
            </div>

            {/* Drag handle */}
            <div
              onMouseDown={onDividerMouseDown}
              className="flex-shrink-0 flex items-center justify-center group"
              style={{ width: '5px', cursor: 'col-resize', backgroundColor: 'var(--border)', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(107,92,231,0.5)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--border)')}
            />

            {/* Right pane — second doc or note rendered directly */}
            <div className="min-w-0 overflow-hidden flex flex-col" style={{ width: `${100 - leftWidth}%` }}>
              <SplitPane type={splitTarget.type} id={splitTarget.id} />
            </div>

          </div>
        ) : (
          <>{children}</>
        )}
      </div>

      {/* Split doc/note picker */}
      {splitPickerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '120px', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div ref={pickerRef} style={{ width: '520px', maxWidth: 'calc(100vw - 32px)', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Pick a doc or note for split view..."
                value={splitQuery}
                onChange={e => setSplitQuery(e.target.value)}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)' }}
              />
              {splitQuery && (
                <button onClick={() => setSplitQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Item list */}
            <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '6px 0' }}>
              {splitLoading && <p style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Loading...</p>}
              {!splitLoading && filteredItems.length === 0 && (
                <p style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                  {splitQuery ? `No docs or notes matching "${splitQuery}"` : 'No docs or notes found'}
                </p>
              )}
              {!splitLoading && filteredItems.map(item => (
                <button
                  key={item.type + '-' + item.uuid}
                  onClick={() => handlePickSplitItem(item)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {item.type === 'doc'
                    ? <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    : <StickyNote size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  }
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title || 'Untitled'}
                  </span>
                  {item.type === 'doc' && item.folder_name && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{item.folder_name}</span>}
                  {item.type === 'note' && item.category_name && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{item.category_name}</span>}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Press</span>
              <kbd style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>Esc</kbd>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>to cancel</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
