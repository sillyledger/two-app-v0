'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { Plus, FileText, StickyNote, Image as ImageIcon, Palette, Search, X } from 'lucide-react'

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

interface DocOrNote {
  uuid: string
  title: string
}

const SWATCHES = ["#EF9F27", "#85B7EB", "#5DCAA5", "#F0997B", "#AFA9EC", "#97C459", "#ED93B1"]

export default function BoardPage() {
  const params = useParams()
  const boardId = params.id as string
  const [collapsed, setCollapsed] = useState(false)
  const [board, setBoard] = useState<{ name: string; type: string } | null>(null)
  const [items, setItems] = useState<BoardItem[]>([])
  const [docs, setDocs] = useState<DocOrNote[]>([])
  const [notes, setNotes] = useState<DocOrNote[]>([])

  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [pickerType, setPickerType] = useState<'doc' | 'note' | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [contextMenuId, setContextMenuId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')

  const addMenuRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    fetch('/api/boards').then(r => r.json()).then((data: any[]) => setBoard(data.find(b => String(b.id) === boardId) ?? null))
    fetch(`/api/boards/${boardId}/items`).then(r => r.json()).then(data => setItems(Array.isArray(data) ? data : []))
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

  const addItem = async (payload: Partial<BoardItem> & { type: string }) => {
    const x = 60 + (items.length % 6) * 50
    const y = 60 + (items.length % 6) * 40
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
    setContextMenuId(null)
    await fetch(`/api/boards/${boardId}/items/${id}`, { method: 'DELETE' })
  }

  const onCardMouseDown = (e: React.MouseEvent, item: BoardItem) => {
    if (e.button !== 0) return
    const boardRect = boardRef.current?.getBoundingClientRect()
    if (!boardRect) return
    dragState.current = { id: item.id, offsetX: e.clientX - boardRect.left - item.x, offsetY: e.clientY - boardRect.top - item.y }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.current || !boardRef.current) return
    const boardRect = boardRef.current.getBoundingClientRect()
    const x = Math.max(0, e.clientX - boardRect.left - dragState.current.offsetX)
    const y = Math.max(0, e.clientY - boardRect.top - dragState.current.offsetY)
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

  const filteredPickerItems = (pickerType === 'doc' ? docs : notes).filter(d => d.title.toLowerCase().includes(pickerQuery.toLowerCase()))

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />

      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-8 py-5">
          {editingTitle ? (
            <input
              autoFocus
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
              className="text-[16px] font-medium bg-transparent outline-none"
              style={{ color: 'var(--text-primary)', border: 'none' }}
            />
          ) : (
            <p
              className="text-[16px] font-medium cursor-text"
              style={{ color: 'var(--text-primary)' }}
              onDoubleClick={() => { setTitleValue(board?.name ?? ''); setEditingTitle(true) }}
            >
              {board?.name ?? 'Board'}
            </p>
          )}
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

        <div ref={boardRef} style={{ flex: 1, position: 'relative', overflow: 'auto', backgroundColor: 'var(--bg)' }}>
          {items.map(item => {
            const title = item.type === 'doc' ? docs.find(d => d.uuid === item.ref_id)?.title : item.type === 'note' ? notes.find(d => d.uuid === item.ref_id)?.title : null
            return (
              <div
                key={item.id}
                onMouseDown={e => onCardMouseDown(e, item)}
                onContextMenu={e => { e.preventDefault(); setContextMenuId(item.id) }}
                style={{ position: 'absolute', left: item.x, top: item.y, transform: `rotate(${item.rotation}deg)`, cursor: 'grab', userSelect: 'none' }}
              >
                {item.type === 'swatch' ? (
                  <div style={{ width: 130, height: 100, borderRadius: 8, backgroundColor: item.color ?? '#888', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
                ) : item.type === 'image' ? (
                  <div style={{ width: 150, borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                    <img src={item.content ?? ''} style={{ width: '100%', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ width: 160, backgroundColor: 'var(--bg-secondary)', borderRadius: 8, padding: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      {item.type === 'doc' ? <FileText size={13} style={{ color: '#8f89e6' }} /> : <StickyNote size={13} style={{ color: '#c98a5e' }} />}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.type === 'doc' ? 'Doc' : 'Note'}</span>
                    </div>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{title ?? 'Untitled'}</p>
                  </div>
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
      </main>
    </div>
  )
}
