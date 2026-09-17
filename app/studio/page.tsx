'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { Plus, Atom, Search } from 'lucide-react'

interface Board {
  id: number
  uuid: string
  name: string
  type: 'canvas'
  created_at: string
}

export default function StudioPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

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
                  onClick={() => router.push(`/studio/${board.type}/${board.uuid}`)}
                  className="rounded-xl p-4 flex flex-col justify-between cursor-pointer transition-colors"
                  style={{ backgroundColor: 'var(--bg-secondary)', height: 110 }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                >
                  <Atom size={18} style={{ color: '#c98a5e' }} />
                  <div>
                    <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{board.name}</p>
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
