'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { Plus, FileText, StickyNote, Image as ImageIcon, Search, X, Minus, RotateCcw } from 'lucide-react'

interface BoardItem {
  id: number
  type: 'doc' | 'note' | 'image' | 'swatch'
  ref_id: string | null
  content: string | null
  color: string | null
  x: number
  y: number
  rotation: number
}

interface BoardConnector {
  id: number
  from_item_id: number
  to_item_id: number
}

interface DocOrNote {
  uuid: string
  title: string
}

const SWATCHES = ["#EF9F27", "#85B7EB", "#5DCAA5", "#F0997B", "#AFA9EC", "#97C459", "#ED93B1"]
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2.5

function cardSize(type: BoardItem['type']) {
  if (type === 'swatch') return { w: 130, h: 100 }
  if (type === 'image') return { w: 150, h: 110 }
  return { w: 160, h: 70 }
}

export default function CanvasBoardPage() {
  const params = useParams()
  const boardId = params.id as string
  const [collapsed, setCollapsed] = useState(false)
  const [board, setBoard] = useState<{ name: string; type: string } | null>(null)
  const [items, setItems] = useState<BoardItem[]>([])
  const [connectors, setConnectors] = useState<BoardConnector[]>([])
  const [docs, setDocs] = useState<DocOrNote[]>([])
  const [notes, setNotes] = useState<DocOrNote[]>([])

  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [pickerType, setPickerType] = useState<'doc' | 'note' | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [contextMenuId, setContextMenuId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null)
  const [connectDrag, setConnectDrag] = useState<{ fromId: number; x: number; y: number } | null>(null)
  const [hoverTargetId, setHoverTargetId] = useState<number | null>(null)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })
  zoomRef.current = zoom
  panRef.current = pan

  const addMenuRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null)
  const connectState = useRef<{ fromId: number } | null>(null)
  const hoverTargetRef = useRef<number | null>(null)
  const itemsRef = useRef<BoardItem[]>([])
  itemsRef.current = items
  const panState = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    fetch('/api/boards').then(r => r.json()).then((data: any[]) => setBoard(data.find(b => b.uuid === boardId) ?? null))
    fetch(`/api/boards/${boardId}/items`).then(r => r.json()).then(data => setItems(Array.isArray(data) ? data : []))
    fetch(`/api/boards/${boardId}/connectors`).then(r => r.json()).then(data => setConnectors(Array.isArray(data) ? data : []))
    fetch('/api/docs').then(r => r.json()).then(data => setDocs(Array.isArray(data) ? data.map((d: any) => ({ uuid: d.uuid, title: d.title || 'Untitled' })) : []))
    fetch('/api/notes').then(r => r.json()).then(data => setNotes(Array.isArray(data) ? data.map((n: any) => ({ uuid: n.uuid, title: n.title || 'Untitled' })) : []))
  }, [boardId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false)
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerType(null)
      setContextMenuId(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const screenToCanvas = (clientX: number, clientY: number) => {
    const rect = boardRef.current!.getBoundingClientRect()
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current,
    }
  }

  const addItem = async (payload: Partial<BoardItem> & { type: string }) => {
    const rect = boardRef.current!.getBoundingClientRect()
    const center = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2)
    const jitter = items.length % 6
    const x = center.x - 75 + jitter * 20
    const y = center.y - 50 + jitter * 15
    const rotation = Math.random() * 6 - 3
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, x, y, rotation }),
    })
    const item = await res.json()
    setItems(prev => [...prev, item])
  }

  const handleUploadClick = () => {
    setAddMenuOpen(false)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.url) await addItem({ type: 'image', content: data.url })
    e.target.value = ''
  }

  const saveTitle = async () => {
    setEditingTitle(false)
    if (!titleValue.trim() || titleValue === board?.name) return
    setBoard(prev => (prev ? { ...prev, name: titleValue.trim() } : prev))
    await fetch(`/api/boards/${boardId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: titleValue.trim() }),
    })
  }

  const straighten = async (id: number) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, rotation: 0 } : i)))
    setContextMenuId(null)
    await fetch(`/api/boards/${boardId}/items/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rotation: 0 }),
    })
  }

  const deleteItem = async (id: number) => {
    setItems(prev => prev.filter(i => i.id !== id))
    setConnectors(prev => prev.filter(c => c.from_item_id !== id && c.to_item_id !== id))
    setContextMenuId(null)
    await fetch(`/api/boards/${boardId}/items/${id}`, { method: 'DELETE' })
  }

  const deleteConnector = async (id: number) => {
    setConnectors(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/boards/${boardId}/connectors/${id}`, { method: 'DELETE' })
  }

  const onCardMouseDown = (e: React.MouseEvent, item: BoardItem) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const canvasPos = screenToCanvas(e.clientX, e.clientY)
    dragState.current = { id: item.id, offsetX: canvasPos.x - item.x, offsetY: canvasPos.y - item.y }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.current) return
    const canvasPos = screenToCanvas(e.clientX, e.clientY)
    const x = canvasPos.x - dragState.current.offsetX
    const y = canvasPos.y - dragState.current.offsetY
    setItems(prev => prev.map(i => (i.id === dragState.current!.id ? { ...i, x, y } : i)))
  }, [])

  const onMouseUp = useCallback(async () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    const id = dragState.current?.id
    dragState.current = null
    if (!id) return
    setItems(prev => {
      const item = prev.find(i => i.id === id)
      if (item) fetch(`/api/boards/${boardId}/items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: item.x, y: item.y }) })
      return prev
    })
  }, [boardId, onMouseMove])

  const onHandleMouseDown = (e: React.MouseEvent, item: BoardItem) => {
    e.stopPropagation()
    const size = cardSize(item.type)
    connectState.current = { fromId: item.id }
    setConnectDrag({ fromId: item.id, x: item.x + size.w, y: item.y + size.h })
    document.addEventListener('mousemove', onConnectMove)
    document.addEventListener('mouseup', onConnectUp)
  }

  const onConnectMove = useCallback((e: MouseEvent) => {
    if (!connectState.current) return
    const pos = screenToCanvas(e.clientX, e.clientY)
    setConnectDrag(prev => (prev ? { ...prev, x: pos.x, y: pos.y } : prev))
    const target = itemsRef.current.find(i => {
      if (i.id === connectState.current!.fromId) return false
      const size = cardSize(i.type)
      return pos.x >= i.x && pos.x <= i.x + size.w && pos.y >= i.y && pos.y <= i.y + size.h
    })
    hoverTargetRef.current = target ? target.id : null
    setHoverTargetId(target ? target.id : null)
  }, [])

  const onConnectUp = useCallback(async () => {
    document.removeEventListener('mousemove', onConnectMove)
    document.removeEventListener('mouseup', onConnectUp)
    const fromId = connectState.current?.fromId
    connectState.current = null
    setConnectDrag(null)
    const toId = hoverTargetRef.current
    hoverTargetRef.current = null
    setHoverTargetId(null)
    if (!fromId || !toId || fromId === toId) return
    const res = await fetch(`/api/boards/${boardId}/connectors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from_item_id: fromId, to_item_id: toId }),
    })
    const connector = await res.json()
    setConnectors(prev => [...prev, connector])
  }, [boardId, onConnectMove])

  const onBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget || e.button !== 0) return
    panState.current = { startX: e.clientX, startY: e.clientY, startPanX: panRef.current.x, startPanY: panRef.current.y }
    document.addEventListener('mousemove', onPanMove)
    document.addEventListener('mouseup', onPanUp)
  }

  const onPanMove = useCallback((e: MouseEvent) => {
    if (!panState.current) return
    setPan({
      x: panState.current.startPanX + (e.clientX - panState.current.startX),
      y: panState.current.startPanY + (e.clientY - panState.current.startY),
    })
  }, [])

  const onPanUp = useCallback(() => {
    panState.current = null
    document.removeEventListener('mousemove', onPanMove)
    document.removeEventListener('mouseup', onPanUp)
  }, [onPanMove])

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const rect = boardRef.current!.getBoundingClientRect()
    if (e.ctrlKey) {
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const canvasX = (mouseX - panRef.current.x) / zoomRef.current
      const canvasY = (mouseY - panRef.current.y) / zoomRef.current
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * factor))
      setZoom(newZoom)
      setPan({ x: mouseX - canvasX * newZoom, y: mouseY - canvasY * newZoom })
    } else {
      setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }))
    }
  }

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }
  const zoomBy = (factor: number) => {
    const rect = boardRef.current!.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const canvasX = (centerX - panRef.current.x) / zoomRef.current
    const canvasY = (centerY - panRef.current.y) / zoomRef.current
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * factor))
    setZoom(newZoom)
    setPan({ x: centerX - canvasX * newZoom, y: centerY - canvasY * newZoom })
  }

  const filteredPickerItems = (pickerType === 'doc' ? docs : notes).filter(d => d.title.toLowerCase().includes(pickerQuery.toLowerCase()))

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />

      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-0.5 min-w-0 flex-1">
            <a href="/studio" className="text-[12px] font-medium truncate transition-colors hover:underline" style={{ color: 'var(--text-muted)' }}>Studio</a>
            <span className="mx-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>/</span>
            {editingTitle ? (
              <input
                autoFocus
                value={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                className="text-[13px] font-medium bg-transparent outline-none"
                style={{ color: 'var(--text-secondary)', border: 'none' }}
              />
            ) : (
              <span
                className="text-[13px] font-medium truncate max-w-[220px] cursor-text"
                style={{ color: 'var(--text-secondary)' }}
                onDoubleClick={() => { setTitleValue(board?.name ?? ''); setEditingTitle(true) }}
              >
                {board?.name ?? 'Board'}
              </span>
            )}
          </div>
          <div style={{ position: 'relative' }} ref={addMenuRef}>
            <button
              onClick={() => setAddMenuOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium"
              style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg)' }}
            >
              <Plus size={13} /> Add card
            </button>
            {addMenuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 180, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', overflow: 'hidden', zIndex: 50, padding: 6 }}>
                <button onClick={() => { setPickerType('doc'); setAddMenuOpen(false) }} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px]" style={{ color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}><FileText size={13} /> Doc</button>
                <button onClick={() => { setPickerType('note'); setAddMenuOpen(false) }} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px]" style={{ color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}><StickyNote size={13} /> Note</button>
                <button onClick={handleUploadClick} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px]" style={{ color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}><ImageIcon size={13} /> Image</button>
                <div style={{ padding: '6px 10px 2px' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Color swatch</p>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {SWATCHES.map(c => (
                      <div key={c} onClick={() => { addItem({ type: 'swatch', color: c }); setAddMenuOpen(false) }} style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: c, cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {pickerType && (
              <div ref={pickerRef} style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 280, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', overflow: 'hidden', zIndex: 50 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  <Search size={13} style={{ color: 'var(--text-muted)' }} />
                  <input autoFocus value={pickerQuery} onChange={e => setPickerQuery(e.target.value)} placeholder={`Search ${pickerType}s...`} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)' }} />
                  <X size={12} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setPickerType(null)} />
                </div>
                <div style={{ maxHeight: 240, overflowY: 'auto', padding: '4px 0' }}>
                  {filteredPickerItems.length === 0 && <p style={{ padding: 14, fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>No {pickerType}s found</p>}
                  {filteredPickerItems.map(d => (
                    <button key={d.uuid} onClick={() => { addItem({ type: pickerType, ref_id: d.uuid }); setPickerType(null); setPickerQuery('') }} className="w-full text-left px-3 py-2 text-[12.5px]" style={{ color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>{d.title}</button>
                  ))}
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>
        </div>

        <div
          ref={boardRef}
          onMouseDown={onBackgroundMouseDown}
          onWheel={onWheel}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: 'var(--bg)', cursor: 'grab' }}
        >
          <div style={{ position: 'absolute', inset: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>

            <svg style={{ position: 'absolute', inset: 0, width: '200vw', height: '200vh', overflow: 'visible', pointerEvents: 'none' }}>
              {connectors.map(c => {
                const from = items.find(i => i.id === c.from_item_id)
                const to = items.find(i => i.id === c.to_item_id)
                if (!from || !to) return null
                const fromSize = cardSize(from.type)
                const toSize = cardSize(to.type)
                const x1 = from.x + fromSize.w
                const y1 = from.y + fromSize.h
                const x2 = to.x + toSize.w / 2
                const y2 = to.y + toSize.h / 2
                return (
                  <g key={c.id} style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={() => deleteConnector(c.id)}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={10} />
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8f89e6" strokeWidth={1.3} strokeDasharray="3,4" />
                    <circle cx={x1} cy={y1} r={3} fill="var(--bg)" stroke="#8f89e6" strokeWidth={1.3} />
                  </g>
                )
              })}
              {connectDrag && (() => {
                const from = items.find(i => i.id === connectDrag.fromId)
                if (!from) return null
                const size = cardSize(from.type)
                return (
                  <>
                    <line x1={from.x + size.w} y1={from.y + size.h} x2={connectDrag.x} y2={connectDrag.y} stroke="#8f89e6" strokeWidth={1.3} strokeDasharray="3,4" />
                    <circle cx={from.x + size.w} cy={from.y + size.h} r={3} fill="var(--bg)" stroke="#8f89e6" strokeWidth={1.3} />
                  </>
                )
              })()}
            </svg>

            {items.map(item => {
              const title = item.type === 'doc' ? docs.find(d => d.uuid === item.ref_id)?.title : item.type === 'note' ? notes.find(d => d.uuid === item.ref_id)?.title : null
              const size = cardSize(item.type)
              const isHovered = hoveredCardId === item.id
              const isConnectTarget = hoverTargetId === item.id
              return (
                <div
                  key={item.id}
                  onMouseDown={e => onCardMouseDown(e, item)}
                  onMouseEnter={() => setHoveredCardId(item.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  onContextMenu={e => { e.preventDefault(); setContextMenuId(item.id) }}
                  style={{ position: 'absolute', left: item.x, top: item.y, transform: `rotate(${item.rotation}deg)`, cursor: 'grab', userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  {item.type === 'swatch' ? (
                    <div style={{ width: size.w, height: size.h, borderRadius: 8, backgroundColor: item.color ?? '#888', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: isConnectTarget ? '1.5px solid #8f89e6' : 'none' }} />
                  ) : item.type === 'image' ? (
                    <div style={{ width: size.w, borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: isConnectTarget ? '1.5px solid #8f89e6' : '1.5px solid transparent' }}>
                      <img src={item.content ?? ''} style={{ width: '100%', display: 'block' }} />
                    </div>
                  ) : (
                    <div style={{ width: size.w, backgroundColor: 'var(--bg-secondary)', borderRadius: 8, padding: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: isConnectTarget ? '1.5px solid #8f89e6' : '1.5px solid transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        {item.type === 'doc' ? <FileText size={13} style={{ color: '#8f89e6' }} /> : <StickyNote size={13} style={{ color: '#c98a5e' }} />}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.type === 'doc' ? 'Doc' : 'Note'}</span>
                      </div>
                      <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{title ?? 'Untitled'}</p>
                    </div>
                  )}
                  {isHovered && !connectDrag && (
                    <div
                      onMouseDown={e => onHandleMouseDown(e, item)}
                      style={{ position: 'absolute', bottom: -6, right: -6, width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--bg)', border: '1.5px solid #8f89e6', cursor: 'crosshair' }}
                    />
                  )}
                  {contextMenuId === item.id && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.4)', overflow: 'hidden', zIndex: 10, width: 130 }}>
                      <button onClick={() => straighten(item.id)} className="w-full text-left px-3 py-2 text-[12px]" style={{ color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>Straighten</button>
                      <button onClick={() => deleteItem(item.id)} className="w-full text-left px-3 py-2 text-[12px] text-red-400" onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>Delete</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', alignItems: 'center', gap: 2, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }}>
            <button onClick={() => zoomBy(1 / 1.2)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, color: 'var(--text-muted)' }}><Minus size={13} /></button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => zoomBy(1.2)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, color: 'var(--text-muted)' }}><Plus size={13} /></button>
            <div style={{ width: 1, height: 16, backgroundColor: 'var(--border)', margin: '0 4px' }} />
            <button onClick={resetView} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, color: 'var(--text-muted)' }}><RotateCcw size={13} /></button>
          </div>
        </div>
      </main>
    </div>
  )
}
