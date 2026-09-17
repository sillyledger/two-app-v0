'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { Plus, LayoutGrid, Atom, Search } from 'lucide-react'

interface Board {
  id: number
  uuid: string
  name: string
  type: 'wall' | 'canvas'
  created_at: string
}

export default function StudioPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    fetch('/api/boards')
      .then(r => r.json())
      .then(data => { setBoards(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    if (pickerOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerOpen])

  const createBoard = async (type: 'wall' | 'canvas') => {
    setPickerOpen(false)
    const workspaceRes = await fetch('/api/workspace')
    const workspace = await workspaceRes.json()
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Untitled board', type, workspace_id: workspace.id }),
    })
    const board = await res.json()
    router.push(`/studio/${board.type}/${board.uuid}`)
  }

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const filteredBoards = trimmedQuery ? boards.filter(b => b.name.toLowerCase().includes(trimmedQuery)) : boards

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1180px] mx-auto px-10 py-10">
          <div className="flex items-center justify-between mb-6 gap-4">
            <div className="relative flex-1" style={{ maxWidth: 420 }}>
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search boards..."
                className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none placeholder-[var(--text-muted)]"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div style={{ position: 'relative', flexShrink: 0 }} ref={pickerRef}>
              <button
                onClick={() => setPickerOpen(v => !v)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13.5px] font-medium"
                style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg)' }}
              >
                <Plus size={14} /> New board
              </button>
              {pickerOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 260, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', overflow: 'hidden', zIndex: 50 }}>
                  <div style={{ padding: '10px 10px 6px' }}>
                    <div onClick={() => createBoard('wall')} className="flex gap-2.5 p-2 rounded-lg cursor-pointer transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(143,137,230,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <LayoutGrid size={16} style={{ color: '#8f89e6' }} />
                      </div>
                      <div>
                        <p className="text-[13.5px] font-medium" style={{ color: 'var(--text-primary)' }}>Wall</p>
                        <p className="text-[11.5px] leading-snug" style={{ color: 'var(--text-muted)' }}>Bounded corkboard for pinning and arranging</p>
                      </div>
                    </div>
                    <div onClick={() => createBoard('canvas')} className="flex gap-2.5 p-2 rounded-lg cursor-pointer transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(201,138,94,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Atom size={16} style={{ color: '#c98a5e' }} />
                      </div>
                      <div>
                        <p className="text-[13.5px] font-medium" style={{ color: 'var(--text-primary)' }}>Canvas</p>
                        <p className="text-[11.5px] leading-snug" style={{ color: 'var(--text-muted)' }}>Infinite space, pan and zoom freely</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {trimmedQuery ? `${filteredBoards.length} matching boards` : `${boards.length} boards`}
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</span>
            </div>
          ) : filteredBoards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{trimmedQuery ? 'No boards match your search' : 'No boards yet'}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{trimmedQuery ? 'Try a different search term' : 'Click New board to create your first one'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3.5">
              {filteredBoards.map(board => (
                <div
                  key={board.id}
                  onClick={() => router.push(`/studio/${board.type}/${board.uuid}`)}
                  className="rounded-xl p-4 flex flex-col justify-between cursor-pointer transition-colors"
                  style={{ backgroundColor: 'var(--bg-secondary)', height: 110 }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                >
                  {board.type === 'wall'
                    ? <LayoutGrid size={18} style={{ color: '#8f89e6' }} />
                    : <Atom size={18} style={{ color: '#c98a5e' }} />
                  }
                  <div>
                    <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{board.name}</p>
                    <p className="text-[11.5px] capitalize" style={{ color: 'var(--text-muted)' }}>{board.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
