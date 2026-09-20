'use client'

import { useEffect, useState, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { Plus, Atom, Search, MoreVertical, Pencil, Trash2, ChevronRight, ChevronDown, Tag } from 'lucide-react'

interface Board {
  id: number
  uuid: string
  name: string
  type: 'canvas'
  created_at: string
  category_id: number | null
  category_name: string | null
  category_color: string | null
}

interface BoardCategory {
  id: number
  name: string
  color: string
  parent_id: number | null
  created_at: string
}

const FONT = "'DM Sans', system-ui, sans-serif"

const SWATCHES = [
  '#7F77DD', '#1D9E75', '#D85A30', '#D4537E',
  '#378ADD', '#639922', '#BA7517', '#E24B4A', '#888890',
]

function collectDescendantIds(id: number, cats: BoardCategory[]): number[] {
  const children = cats.filter(c => c.parent_id === id)
  return children.flatMap(child => [child.id, ...collectDescendantIds(child.id, cats)])
}

function sortCategoriesForMove(cats: BoardCategory[]): (BoardCategory & { depth: number })[] {
  const result: (BoardCategory & { depth: number })[] = []
  function walk(parentId: number | null, depth: number) {
    cats.filter(c => c.parent_id === parentId).forEach(c => {
      result.push({ ...c, depth })
      walk(c.id, depth + 1)
    })
  }
  walk(null, 0)
  return result
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
  const [movingId, setMovingId] = useState<number | null>(null)

  const [boardCategories, setBoardCategories] = useState<BoardCategory[]>([])
  const [activeCategory, setActiveCategory] = useState<number | 'all'>('all')

  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(SWATCHES[0])
  const [newCategoryParentId, setNewCategoryParentId] = useState<number | null>(null)
  const categoryNameRef = useRef<HTMLInputElement>(null)

  const [openCategoryMenuId, setOpenCategoryMenuId] = useState<number | null>(null)
  const [categoryMenuMode, setCategoryMenuMode] = useState<'actions' | 'picker'>('actions')
  const categoryMenuRef = useRef<HTMLDivElement>(null)
  const [expandedCategoryId, setExpandedCategoryId] = useState<number | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/boards').then(r => r.json()),
      fetch('/api/board-categories').then(r => r.json()),
    ]).then(([boardsData, categoriesData]) => {
      setBoards(Array.isArray(boardsData) ? boardsData : [])
      setBoardCategories(Array.isArray(categoriesData) ? categoriesData : [])
      setLoading(false)
    }).catch(() => setLoading(false))
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

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setOpenCategoryMenuId(null)
        setCategoryMenuMode('actions')
      }
    }
    if (openCategoryMenuId !== null) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [openCategoryMenuId])

  const createBoard = async () => {
    const workspaceRes = await fetch('/api/workspace')
    const workspace = await workspaceRes.json()
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Untitled canvas', type: 'canvas', workspace_id: workspace.id, category_id: activeCategory === 'all' ? null : activeCategory }),
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
    const confirmed = window.confirm(`Delete "${board.name}"? Everything on this canvas will be permanently deleted.`)
    if (!confirmed) return
    setBoards(prev => prev.filter(b => b.id !== board.id))
    try { await fetch(`/api/boards/${board.uuid}`, { method: 'DELETE' }) } catch {}
  }

  async function handleMoveBoard(board: Board, categoryId: number | null) {
    setMenuOpenId(null)
    setMovingId(null)
    const category = boardCategories.find(c => c.id === categoryId)
    setBoards(prev => prev.map(b => b.id === board.id ? { ...b, category_id: categoryId, category_name: category?.name ?? null, category_color: category?.color ?? null } : b))
    try {
      await fetch(`/api/boards/${board.uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId }),
      })
    } catch {}
  }

  function openCategoryModal(parentId: number | null = null) {
    setNewCategoryName('')
    setNewCategoryColor(SWATCHES[0])
    setNewCategoryParentId(parentId)
    setShowCategoryModal(true)
    setTimeout(() => categoryNameRef.current?.focus(), 50)
  }

  async function handleCreateCategory() {
    const name = newCategoryName.trim()
    if (!name) { setShowCategoryModal(false); return }
    setShowCategoryModal(false)
    try {
      const res = await fetch('/api/board-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: newCategoryColor, parent_id: newCategoryParentId }),
      })
      const category = await res.json()
      setBoardCategories(prev => [...prev, category])
    } catch {}
  }

  async function handleDeleteCategory(id: number) {
    setOpenCategoryMenuId(null)
    setCategoryMenuMode('actions')
    const descendantIds = collectDescendantIds(id, boardCategories)
    const hasChildren = descendantIds.length > 0
    const confirmMessage = hasChildren
      ? 'Delete this category and its subcategories? Boards inside them will not be deleted — they\'ll just lose their category.'
      : 'Delete this category? Boards inside it will not be deleted — they\'ll just lose their category.'
    if (!confirm(confirmMessage)) return
    const idsToRemove = [id, ...descendantIds]
    setBoardCategories(prev => prev.filter(c => !idsToRemove.includes(c.id)))
    setBoards(prev => prev.map(b => b.category_id !== null && idsToRemove.includes(b.category_id) ? { ...b, category_id: null, category_name: null, category_color: null } : b))
    if (activeCategory !== 'all' && idsToRemove.includes(activeCategory)) setActiveCategory('all')
    if (expandedCategoryId !== null && idsToRemove.includes(expandedCategoryId)) setExpandedCategoryId(null)
    try { await fetch(`/api/board-categories/${id}`, { method: 'DELETE' }) } catch {}
  }

  async function handleMoveCategory(cat: BoardCategory, parentId: number | null) {
    setOpenCategoryMenuId(null)
    setCategoryMenuMode('actions')
    setBoardCategories(prev => prev.map(c => c.id === cat.id ? { ...c, parent_id: parentId } : c))
    try {
      await fetch(`/api/board-categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: parentId }),
      })
    } catch {}
  }

  function CategoryChip({ cat, small }: { cat: BoardCategory; small?: boolean }) {
    const hasChildren = boardCategories.some(c => c.parent_id === cat.id)
    const isMenuOpen = openCategoryMenuId === cat.id
    const descendantIds = collectDescendantIds(cat.id, boardCategories)
    const eligible = boardCategories.filter(c => c.id !== cat.id && !descendantIds.includes(c.id))
    const eligibleTopLevel = eligible.filter(c => c.parent_id === null)

    const menuItemStyle: React.CSSProperties = { width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 6, padding: '7px 9px', fontSize: 12.5, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: FONT }

    return (
      <div style={{ position: 'relative' }} ref={isMenuOpen ? categoryMenuRef : undefined}>
        <button
          onClick={() => { setActiveCategory(cat.id); if (hasChildren) setExpandedCategoryId(cat.id) }}
          onContextMenu={e => { e.preventDefault(); setOpenCategoryMenuId(cat.id); setCategoryMenuMode('actions') }}
          style={{
            display: 'flex', alignItems: 'center', gap: small ? 5 : 6,
            background: activeCategory === cat.id ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
            color: 'var(--text-primary)', border: '1px solid var(--border)',
            fontSize: small ? 11 : 12, padding: small ? '5px 11px' : '6px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
          }}
        >
          <span style={{ width: small ? 6 : 7, height: small ? 6 : 7, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
          {cat.name}
          {hasChildren && !small && (
            <span
              onClick={e => { e.stopPropagation(); setExpandedCategoryId(expandedCategoryId === cat.id ? null : cat.id) }}
              style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', marginLeft: 1 }}
            >
              {expandedCategoryId === cat.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          )}
          <span
            onClick={e => { e.stopPropagation(); setOpenCategoryMenuId(isMenuOpen ? null : cat.id); setCategoryMenuMode('actions') }}
            style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 2, lineHeight: 1 }}
          >
            ⋯
          </span>
        </button>
        {isMenuOpen && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 9, padding: 4, minWidth: categoryMenuMode === 'picker' ? 180 : 150, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
            {categoryMenuMode === 'actions' ? (
              <>
                <button
                  onClick={() => setCategoryMenuMode('picker')}
                  style={menuItemStyle}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Move to category
                </button>
                {cat.parent_id !== null && (
                  <button
                    onClick={() => handleMoveCategory(cat, null)}
                    style={menuItemStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    Move to top level
                  </button>
                )}
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  style={{ ...menuItemStyle, color: '#E24B4A' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Delete category
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleMoveCategory(cat, null)}
                  style={menuItemStyle}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Top level
                </button>
                {eligibleTopLevel.map(top => (
                  <Fragment key={top.id}>
                    <button
                      onClick={() => handleMoveCategory(cat, top.id)}
                      style={menuItemStyle}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {top.name}
                    </button>
                    {eligible.filter(c => c.parent_id === top.id).map(child => (
                      <button
                        key={child.id}
                        onClick={() => handleMoveCategory(cat, child.id)}
                        style={{ ...menuItemStyle, paddingLeft: 22 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {child.name}
                      </button>
                    ))}
                  </Fragment>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const activeCategoryIds = activeCategory === 'all' ? null : [activeCategory, ...collectDescendantIds(activeCategory, boardCategories)]
  const filteredBoards = boards
    .filter(b => activeCategory === 'all' || (activeCategoryIds !== null && b.category_id !== null && activeCategoryIds.includes(b.category_id)))
    .filter(b => !trimmedQuery || b.name.toLowerCase().includes(trimmedQuery))

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
                placeholder="Search canvases..."
                className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none placeholder-[var(--text-muted)]"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="flex items-center gap-2.5" style={{ flexShrink: 0 }}>
              <button
                onClick={() => openCategoryModal()}
                style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}
              >
                + New category
              </button>
              <button
                onClick={() => createBoard()}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13.5px] font-medium"
                style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg)', flexShrink: 0 }}
              >
                <Plus size={14} /> New canvas
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveCategory('all')}
                style={{
                  background: activeCategory === 'all' ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  color: 'var(--text-primary)', border: '1px solid var(--border)',
                  fontSize: 12, padding: '6px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
                }}
              >
                All
              </button>
              {boardCategories.filter(c => c.parent_id === null).map(cat => (
                <CategoryChip key={cat.id} cat={cat} />
              ))}
              <button
                onClick={() => openCategoryModal()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: 12, padding: '6px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT }}
              >
                + Add category
              </button>
            </div>

            {expandedCategoryId !== null && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 24, borderLeft: '2px solid var(--border)', marginLeft: 10 }}>
                {boardCategories.filter(c => c.parent_id === expandedCategoryId).map(subcat => (
                  <CategoryChip key={subcat.id} cat={subcat} small />
                ))}
                <button
                  onClick={() => openCategoryModal(expandedCategoryId)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: 11, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT }}
                >
                  + New subcategory
                </button>
              </div>
            )}
          </div>

          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {trimmedQuery ? `${filteredBoards.length} matching canvases` : `${boards.length} canvases`}
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</span>
            </div>
          ) : filteredBoards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{trimmedQuery ? 'No canvases match your search' : 'No canvases yet'}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{trimmedQuery ? 'Try a different search term' : 'Click New canvas to create your first one'}</p>
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
                        onClick={e => { e.stopPropagation(); setMovingId(null); setMenuOpenId(prev => prev === board.id ? null : board.id) }}
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
                          {movingId === board.id ? (
                            <>
                              <button onClick={() => handleMoveBoard(board, null)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', fontSize: 12.5, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                No category
                              </button>
                              {sortCategoriesForMove(boardCategories).map(cat => (
                                <button key={cat.id} onClick={() => handleMoveBoard(board, cat.id)} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: cat.depth > 0 ? '8px 12px 8px 28px' : '8px 12px', fontSize: 12.5, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                  {cat.depth > 0 && (
                                    <span style={{ position: 'absolute', left: 16, top: 0, bottom: '50%', width: 10, borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)', borderRadius: '0 0 0 4px' }} />
                                  )}
                                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                                  {cat.name}
                                </button>
                              ))}
                            </>
                          ) : (
                            <>
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
                                onClick={() => setMovingId(board.id)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                                  fontSize: 13, color: 'var(--text-muted)', background: 'transparent', border: 'none',
                                  cursor: 'pointer', textAlign: 'left',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <Tag size={12} /> Move to category
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
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    {board.category_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: board.category_color || '#888890', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: board.category_color || 'var(--text-muted)' }}>{board.category_name}</span>
                      </div>
                    )}
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

      {showCategoryModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} onClick={() => setShowCategoryModal(false)} />
          <div style={{ position: 'relative', borderRadius: 14, width: 320, padding: '22px 22px 18px', zIndex: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontFamily: FONT }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>{newCategoryParentId !== null ? 'New subcategory' : 'New category'}</h2>
            <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Name</label>
            <input
              ref={categoryNameRef}
              type="text"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') setShowCategoryModal(false) }}
              placeholder="e.g. Research"
              style={{ width: '100%', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: FONT, boxSizing: 'border-box', marginBottom: 16 }}
            />
            <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {SWATCHES.map(color => (
                <button
                  key={color}
                  onClick={() => setNewCategoryColor(color)}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', background: color, cursor: 'pointer',
                    border: newCategoryColor === color ? '2px solid var(--text-primary)' : '2px solid transparent',
                    padding: 0,
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowCategoryModal(false)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
              <button onClick={handleCreateCategory} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#6b5ce7', border: 'none', cursor: 'pointer', fontFamily: FONT }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
