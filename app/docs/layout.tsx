'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from '@/components/sidebar'
import TabBar from '@/components/tab-bar'
import { useTabStore } from '@/hooks/use-tab-store'
import { useRouter } from 'next/navigation'
import { Search, X, FileText, FilePlus } from 'lucide-react'

interface DocItem {
  uuid: string
  title: string
  folder_name?: string | null
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { openTab } = useTabStore()

  const [collapsed, setCollapsed] = useState(false)
  const [splitActive, setSplitActive] = useState(false)
  const [splitDocId, setSplitDocId] = useState<string | null>(null)
  const [splitPickerOpen, setSplitPickerOpen] = useState(false)
  const [splitDocs, setSplitDocs] = useState<DocItem[]>([])
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

  // Listen for the Split View toggle fired from DocTopbar
  useEffect(() => {
    const handler = () => {
      if (!splitActive) {
        // Opening split — show doc picker
        setSplitPickerOpen(true)
        setSplitLoading(true)
        fetch('/api/docs')
          .then(r => r.json())
          .then(data => setSplitDocs(Array.isArray(data) ? data : []))
          .catch(() => setSplitDocs([]))
          .finally(() => setSplitLoading(false))
        setTimeout(() => searchRef.current?.focus(), 80)
      } else {
        // Closing split
        setSplitActive(false)
        setSplitDocId(null)
        setLeftWidth(50)
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

  const handlePickSplitDoc = (doc: DocItem) => {
    setSplitDocId(doc.uuid)
    setSplitActive(true)
    setSplitPickerOpen(false)
    setSplitQuery('')
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

  const filteredDocs = splitDocs.filter(d =>
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
        {splitActive && splitDocId ? (
          <div ref={containerRef} className="flex flex-1 min-h-0" style={{ paddingTop: '80px' }}>

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

            {/* Right pane — second doc in iframe */}
            <div className="min-w-0 overflow-hidden flex flex-col" style={{ width: `${100 - leftWidth}%` }}>
              <iframe
                key={splitDocId}
                src={`/docs/${splitDocId}`}
                className="flex-1 w-full h-full border-none"
                style={{ minHeight: 'calc(100vh - 80px)' }}
                title="Split view doc"
              />
            </div>

          </div>
        ) : (
          <>{children}</>
        )}
      </div>

      {/* Split doc picker */}
      {splitPickerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '120px', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div ref={pickerRef} style={{ width: '520px', maxWidth: 'calc(100vw - 32px)', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Pick a doc for split view..."
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

            {/* Doc list */}
            <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '6px 0' }}>
              {splitLoading && <p style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Loading...</p>}
              {!splitLoading && filteredDocs.length === 0 && (
                <p style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                  {splitQuery ? `No docs matching "${splitQuery}"` : 'No docs found'}
                </p>
              )}
              {!splitLoading && filteredDocs.map(doc => (
                <button
                  key={doc.uuid}
                  onClick={() => handlePickSplitDoc(doc)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.title || 'Untitled'}
                  </span>
                  {doc.folder_name && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{doc.folder_name}</span>}
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
