'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { Plus, Atom, Search, MoreVertical, Pencil, Trash2, ChevronRight } from 'lucide-react'

interface Board {
  id: number
  uuid: string
  name: string
  type: 'canvas'
  created_at: string
}

export default function CanvasBoardsPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

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
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null) }
    if (menuOpenId !== null) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpenId])

  useEffect(() => {
    if (renamingId !== null && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const createBoard = async () => {
    const workspaceRes = await fetch('/api/workspace')
    const workspace = await workspaceRes.json()
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Untitled board', type: 'canvas', workspace_id: workspace.id }),
    })
    const board = await res.json()
    router.push(`/studio/canvas/${board.uuid}`)
  }

  const startRenaming = (board: Board) => {
    setMenuOpenId(null)
    setRenameValue(board.name)
    setRenamingId(board.id)
  }

  const commitRename = async (board: Board) => {
    const trimmed = renameValue.trim()
    setRenamingId(null)
    if (!trimmed || trimmed === board.name) return
    setBoards(prev => prev.map(b => b.id === board.id ? { ...b, name: trimmed } : b))
    try {
      await fetch(`/api/boards/${board.uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
    } catch {}
  }

  const handleDeleteBoard = async (board: Board) => {
    setMenuOpenId(null)
    const confirmed = window.confirm(`Delete "${board.name}"? Everything on this board will be permanently deleted.`)
    if (!confirmed) return
    setBoards(prev => prev.filter(b => b.id !== board.id))
    try { await fetch(`/api/boards/${board.uuid}`, { method: 'DELETE' }) } catch {}
  }

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const filteredBoards = trimmedQuery ? boards.filter(b => b.name.toLowerCase().includes(trimmedQuery)) : boards

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1180px] mx-auto px-10 py-10">
          <div className="flex items-center flex-wrap gap-1 mb-3 text-[12px]" style={{ color: 'var(--text-muted)' }}>
            <button
              onClick={() => router.push('/studio')}
              className="transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              Studio
            </button>
            <span className="flex items-center gap-1">
              <ChevronRight size={12} />
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Canvas</span>
            </span>
          </div>

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
            <button
              onClick={() => createBoard()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13.5px] font-medium"
              style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg)', flexShrink: 0 }}
            >
              <Plus size={14} /> New board
            </button>
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
                  onClick={() => { if (renamingId !== board.id) router.push(`/studio/canvas/${board.uuid}`) }}
                  className="relative rounded-xl p-4 flex flex-col justify-between cursor-pointer transition-colors"
                  style={{ backgroundColor: 'var(--bg-secondary)', height: 110 }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                >
                  <div className="flex items-start justify-between">
                    <Atom size={18} style={{ color: '#c98a5e' }} />
                    <div style={{ position: 'relative' }} ref={menuOpenId === board.id ? menuRef : undefined}>
                      <button
                        onClick={e => { e.stopPropagation(); setMenuOpenId(prev => prev === board.id ? null : board.id) }}
                        title="More options"
                        className="transition-opacity"
                        style={{ color: 'var(--text-muted)', opacity: menuOpenId === board.id ? 1 : 0.4 }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = menuOpenId === board.id ? '1' : '0.4')}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {menuOpenId === board.id && (
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute', right: 0, top: 20, zIndex: 50,
                            borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            width: 130, padding: '4px 0', overflow: 'hidden',
                            background: '#242428', border: '1px solid rgba(255,255,255,0.09)',
                          }}
                        >
                          <button
                            onClick={() => startRenaming(board)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                              fontSize: 13, color: 'var(--text-muted)', background: 'transparent', border: 'none',
                              cursor: 'pointer', textAlign: 'left',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <Pencil size={12} /> Rename
                          </button>
                          <button
                            onClick={() => handleDeleteBoard(board)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                              fontSize: 13, color: '#f87171', background: 'transparent', border: 'none',
                              cursor: 'pointer', textAlign: 'left',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    {renamingId === board.id ? (
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onBlur={() => commitRename(board)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRename(board)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        className="font-medium text-[14px] w-full rounded outline-none"
                        style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '1px 4px' }}
                      />
                    ) : (
                      <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{board.name}</p>
                    )}
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
