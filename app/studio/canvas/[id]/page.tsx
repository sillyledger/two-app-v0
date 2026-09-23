'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { Plus, FileText, StickyNote, Image as ImageIcon, Search, X, Minus, RotateCcw, Type, Loader2, Pencil, Copy, Shapes, Square, RectangleHorizontal, Circle, Diamond, Trash2 } from 'lucide-react'

interface BoardItem {
  id: number
  type: 'doc' | 'note' | 'image' | 'swatch' | 'text' | 'shape'
  ref_id: string | null
  content: string | null
  color: string | null
  x: number
  y: number
  rotation: number
  width?: number | null
  height?: number | null
  shape?: string | null
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
  if (type === 'swatch') return { w: 150, h: 100 }
  if (type === 'image') return { w: 260, h: 190 }
  if (type === 'text') return { w: 200, h: 80 }
  return { w: 160, h: 70 }
}

function itemSize(item: BoardItem) {
  if (typeof item.width === 'number' && typeof item.height === 'number') return { w: item.width, h: item.height }
  return cardSize(item.type)
}

const SHAPE_DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  rect: { w: 200, h: 110 },
  rounded: { w: 200, h: 110 },
  circle: { w: 140, h: 140 },
  diamond: { w: 160, h: 150 },
}

async function resizeImageFile(file: File, maxDimension = 1200): Promise<File> {
  if (file.type === 'image/gif') return file // preserve animation, don't resize
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const targetW = Math.round(bitmap.width * scale)
    const targetH = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)
    let blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82))
    if (!blob || blob.type !== 'image/webp') {
      const fallbackType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      blob = await new Promise(resolve => canvas.toBlob(resolve, fallbackType, fallbackType === 'image/jpeg' ? 0.85 : undefined))
    }
    if (!blob || blob.size >= file.size) return file
    const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: blob.type })
  } catch {
    return file
  }
}

function edgePoint(rect: { x: number; y: number; w: number; h: number }, towardX: number, towardY: number) {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const dx = towardX - cx
  const dy = towardY - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const hw = rect.w / 2
  const hh = rect.h / 2
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity
  const scale = Math.min(scaleX, scaleY)
  return { x: cx + dx * scale, y: cy + dy * scale }
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

  const [swatchMenuOpen, setSwatchMenuOpen] = useState(false)
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false)
  const [selectedShapeId, setSelectedShapeId] = useState<number | null>(null)
  const [measuredSizes, setMeasuredSizes] = useState<Record<number, { w: number; h: number }>>({})
  const [uploadingImage, setUploadingImage] = useState(false)
  const [pendingImages, setPendingImages] = useState<{ tempId: string; x: number; y: number; rotation: number; previewUrl: string }[]>([])
  const [hoveredTool, setHoveredTool] = useState<string | null>(null)
  const [tooltipRect, setTooltipRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [pickerType, setPickerType] = useState<'doc' | 'note' | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [contextMenuId, setContextMenuId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null)
  const [connectDrag, setConnectDrag] = useState<{ fromId: number; x: number; y: number } | null>(null)
  const [hoverTargetId, setHoverTargetId] = useState<number | null>(null)
  const [copiedItemId, setCopiedItemId] = useState<number | null>(null)
  const [colorPopoverId, setColorPopoverId] = useState<number | null>(null)
  const [hexInput, setHexInput] = useState('')

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })
  zoomRef.current = zoom
  panRef.current = pan

  const addMenuRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const colorPopoverRef = useRef<HTMLDivElement>(null)
  const hexInputRef = useRef<HTMLInputElement>(null)
  const shapeTextareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null)
  const cardClickStart = useRef<{ id: number; x: number; y: number } | null>(null)
  const resizeState = useRef<{ id: number; handle: 'nw' | 'ne' | 'sw' | 'se'; startClientX: number; startClientY: number; startX: number; startY: number; startW: number; startH: number } | null>(null)
  const connectState = useRef<{ fromId: number } | null>(null)
  const hoverTargetRef = useRef<number | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const colorPopoverIdRef = useRef<number | null>(null)
  const colorPopoverBaselineRef = useRef<string | null>(null)
  const itemsRef = useRef<BoardItem[]>([])
  itemsRef.current = items
  colorPopoverIdRef.current = colorPopoverId
  const measuredSizesRef = useRef<Record<number, { w: number; h: number }>>({})
  measuredSizesRef.current = measuredSizes
  const cardResizeObserverRef = useRef<ResizeObserver | null>(null)
  const cardElements = useRef<Map<number, HTMLElement>>(new Map())
  const cardRefCallbacks = useRef<Map<number, (el: HTMLElement | null) => void>>(new Map())
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
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) { setSwatchMenuOpen(false); setShapeMenuOpen(false) }
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerType(null)
      if (!contextMenuRef.current || !contextMenuRef.current.contains(e.target as Node)) setContextMenuId(null)
      if (colorPopoverRef.current && !colorPopoverRef.current.contains(e.target as Node)) closeColorPopover()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (colorPopoverId !== null) {
      hexInputRef.current?.focus()
      hexInputRef.current?.select()
    }
  }, [colorPopoverId])

  useEffect(() => {
    const el = shapeTextareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
    el.style.overflowY = el.scrollHeight > el.clientHeight ? 'auto' : 'hidden'
  }, [editingText, editingItemId])

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      setMeasuredSizes(prev => {
        let changed = false
        const next = { ...prev }
        for (const entry of entries) {
          const idAttr = (entry.target as HTMLElement).dataset.itemId
          if (!idAttr) continue
          const id = Number(idAttr)
          const w = Math.round((entry.target as HTMLElement).offsetWidth)
          const h = Math.round((entry.target as HTMLElement).offsetHeight)
          const existing = next[id]
          if (!existing || existing.w !== w || existing.h !== h) {
            next[id] = { w, h }
            changed = true
          }
        }
        return changed ? next : prev
      })
    })
    cardResizeObserverRef.current = ro
    return () => {
      ro.disconnect()
      cardResizeObserverRef.current = null
    }
  }, [])

  const getCardRef = (id: number) => {
    let cb = cardRefCallbacks.current.get(id)
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        const ro = cardResizeObserverRef.current
        const prevEl = cardElements.current.get(id)
        if (prevEl && ro) ro.unobserve(prevEl)
        if (el) {
          cardElements.current.set(id, el)
          if (ro) ro.observe(el)
        } else {
          cardElements.current.delete(id)
          cardRefCallbacks.current.delete(id)
        }
      }
      cardRefCallbacks.current.set(id, cb)
    }
    return cb
  }

  const connectorSize = (item: BoardItem) => {
    if (typeof item.width === 'number' && typeof item.height === 'number') return { w: item.width, h: item.height }
    const measured = measuredSizesRef.current[item.id]
    if (measured) return measured
    return cardSize(item.type)
  }

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
    const x = Math.round(payload.x ?? center.x - 75 + jitter * 20)
    const y = Math.round(payload.y ?? center.y - 50 + jitter * 15)
    const rotation = payload.rotation ?? Math.random() * 6 - 3
    const width = typeof payload.width === 'number' ? Math.round(payload.width) : payload.width
    const height = typeof payload.height === 'number' ? Math.round(payload.height) : payload.height
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, x, y, rotation, width, height }),
    })
    const item = await res.json()
    setItems(prev => [...prev, item])
    return item
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingImage(true)
    const resized = await resizeImageFile(file)
    const previewUrl = URL.createObjectURL(resized)
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const rect = boardRef.current!.getBoundingClientRect()
    const center = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2)
    const jitter = (items.length + pendingImages.length) % 6
    const x = center.x - 75 + jitter * 20
    const y = center.y - 50 + jitter * 15
    const rotation = Math.random() * 6 - 3
    setPendingImages(prev => [...prev, { tempId, x, y, rotation, previewUrl }])
    setUploadingImage(false)
    try {
      const formData = new FormData()
      formData.append('file', resized)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.url) {
        setPendingImages(prev => prev.filter(p => p.tempId !== tempId))
        URL.revokeObjectURL(previewUrl)
        alert(data.error || 'Image upload failed. Please try again.')
        return
      }
      const item = await addItem({ type: 'image', content: data.url, x, y, rotation })
      await new Promise<void>(resolve => {
        const img = new Image()
        img.onload = () => resolve()
        img.onerror = () => resolve()
        img.src = item.content
      })
      setPendingImages(prev => prev.filter(p => p.tempId !== tempId))
      URL.revokeObjectURL(previewUrl)
    } catch {
      setPendingImages(prev => prev.filter(p => p.tempId !== tempId))
      URL.revokeObjectURL(previewUrl)
      alert('Image upload failed. Please try again.')
    }
  }

  const saveTitle = async () => {
    setEditingTitle(false)
    if (!titleValue.trim() || titleValue === board?.name) return
    setBoard(prev => (prev ? { ...prev, name: titleValue.trim() } : prev))
    await fetch(`/api/boards/${boardId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: titleValue.trim() }),
    })
  }

  const saveText = async (id: number) => {
    const value = editingText
    setEditingItemId(null)
    setItems(prev => prev.map(i => (i.id === id ? { ...i, content: value } : i)))
    await fetch(`/api/boards/${boardId}/items/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: value }),
    })
  }

  const normalizeHex = (input: string): string | null => {
    let v = input.trim()
    if (v.startsWith('#')) v = v.slice(1)
    if (/^[0-9a-fA-F]{3}$/.test(v)) v = v.split('').map(c => c + c).join('')
    if (!/^[0-9a-fA-F]{6}$/.test(v)) return null
    return `#${v.toUpperCase()}`
  }

  const closeColorPopover = async () => {
    const id = colorPopoverIdRef.current
    if (id == null) return
    setColorPopoverId(null)
    colorPopoverIdRef.current = null
    const current = itemsRef.current.find(i => i.id === id)
    const baseline = colorPopoverBaselineRef.current
    colorPopoverBaselineRef.current = null
    if (!current || current.color === baseline) return
    await fetch(`/api/boards/${boardId}/items/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color: current.color }),
    })
  }

  const openColorPopover = async (item: BoardItem) => {
    if (colorPopoverIdRef.current !== null && colorPopoverIdRef.current !== item.id) {
      await closeColorPopover()
    }
    colorPopoverBaselineRef.current = item.color
    colorPopoverIdRef.current = item.id
    setColorPopoverId(item.id)
    setHexInput(item.color ?? '')
  }

  const setSwatchLiveColor = (id: number, color: string) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, color } : i)))
    setHexInput(color)
  }

  const addShape = async (shape: 'rect' | 'rounded' | 'circle' | 'diamond') => {
    setShapeMenuOpen(false)
    const { w, h } = SHAPE_DEFAULT_SIZE[shape]
    const item = await addItem({ type: 'shape', shape, color: '#AFA9EC', content: '', width: w, height: h, rotation: 0 })
    if (item) setSelectedShapeId(item.id)
  }

  const setShapeColor = async (id: number, color: string) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, color } : i)))
    await fetch(`/api/boards/${boardId}/items/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color }),
    })
  }

  const copyColor = (item: BoardItem) => {
    if (!item.color) return
    navigator.clipboard.writeText(item.color)
    setCopiedItemId(item.id)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopiedItemId(null), 1000)
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
    setMeasuredSizes(prev => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    await fetch(`/api/boards/${boardId}/items/${id}`, { method: 'DELETE' })
  }

  const deleteConnector = async (id: number) => {
    setConnectors(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/boards/${boardId}/connectors/${id}`, { method: 'DELETE' })
  }

  const onCardMouseDown = (e: React.MouseEvent, item: BoardItem) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (selectedShapeId !== null && selectedShapeId !== item.id) setSelectedShapeId(null)
    cardClickStart.current = { id: item.id, x: e.clientX, y: e.clientY }
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

  const onMouseUp = useCallback(async (e: MouseEvent) => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    const id = dragState.current?.id
    dragState.current = null
    const clickStart = cardClickStart.current
    cardClickStart.current = null
    if (!id) return
    setItems(prev => {
      const item = prev.find(i => i.id === id)
      if (item) fetch(`/api/boards/${boardId}/items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: Math.round(item.x), y: Math.round(item.y) }) })
      return prev
    })
    if (clickStart && clickStart.id === id && Math.hypot(e.clientX - clickStart.x, e.clientY - clickStart.y) < 4) {
      const item = itemsRef.current.find(i => i.id === id)
      if (item && item.type === 'swatch') openColorPopover(item)
      else if (item && item.type === 'shape') setSelectedShapeId(item.id)
    }
  }, [boardId, onMouseMove])

  const onHandleMouseDown = (e: React.MouseEvent, item: BoardItem) => {
    e.stopPropagation()
    const size = connectorSize(item)
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
      const size = connectorSize(i)
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

  const onResizeMouseDown = (e: React.MouseEvent, item: BoardItem, handle: 'nw' | 'ne' | 'sw' | 'se') => {
    if (e.button !== 0) return
    e.stopPropagation()
    const size = itemSize(item)
    resizeState.current = { id: item.id, handle, startClientX: e.clientX, startClientY: e.clientY, startX: item.x, startY: item.y, startW: size.w, startH: size.h }
    document.addEventListener('mousemove', onResizeMove)
    document.addEventListener('mouseup', onResizeUp)
  }

  const onResizeMove = useCallback((e: MouseEvent) => {
    const rs = resizeState.current
    if (!rs) return
    const dx = (e.clientX - rs.startClientX) / zoomRef.current
    const dy = (e.clientY - rs.startClientY) / zoomRef.current
    const right = rs.startX + rs.startW
    const bottom = rs.startY + rs.startH
    let x = rs.startX, y = rs.startY, w = rs.startW, h = rs.startH
    if (rs.handle === 'se') {
      w = Math.max(60, rs.startW + dx)
      h = Math.max(40, rs.startH + dy)
    } else if (rs.handle === 'sw') {
      w = Math.max(60, rs.startW - dx)
      x = right - w
      h = Math.max(40, rs.startH + dy)
    } else if (rs.handle === 'ne') {
      w = Math.max(60, rs.startW + dx)
      h = Math.max(40, rs.startH - dy)
      y = bottom - h
    } else {
      w = Math.max(60, rs.startW - dx)
      x = right - w
      h = Math.max(40, rs.startH - dy)
      y = bottom - h
    }
    setItems(prev => prev.map(i => (i.id === rs.id ? { ...i, x, y, width: w, height: h } : i)))
  }, [])

  const onResizeUp = useCallback(async () => {
    document.removeEventListener('mousemove', onResizeMove)
    document.removeEventListener('mouseup', onResizeUp)
    const id = resizeState.current?.id
    resizeState.current = null
    if (!id) return
    setItems(prev => {
      const item = prev.find(i => i.id === id)
      if (item && typeof item.width === 'number' && typeof item.height === 'number') {
        fetch(`/api/boards/${boardId}/items/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: Math.round(item.x), y: Math.round(item.y), width: Math.round(item.width), height: Math.round(item.height) }),
        })
      }
      return prev
    })
  }, [boardId, onResizeMove])

  const onBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget || e.button !== 0) return
    setSelectedShapeId(null)
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

  const frameShapes = items.filter(i => i.type === 'shape' && i.color === 'none')
  const otherItems = items.filter(i => !(i.type === 'shape' && i.color === 'none'))

  const renderItem = (item: BoardItem) => {
    const title = item.type === 'doc' ? docs.find(d => d.uuid === item.ref_id)?.title : item.type === 'note' ? notes.find(d => d.uuid === item.ref_id)?.title : null
    const size = itemSize(item)
    const isHovered = hoveredCardId === item.id
    const isConnectTarget = hoverTargetId === item.id
    const isSelectedShape = item.type === 'shape' && selectedShapeId === item.id
    return (
      <div
        key={item.id}
        onMouseDown={e => { if (editingItemId !== item.id) onCardMouseDown(e, item) }}
        onDoubleClick={() => { if (item.type === 'text' || item.type === 'shape') { setEditingItemId(item.id); setEditingText(item.content ?? '') } }}
        onMouseEnter={() => setHoveredCardId(item.id)}
        onMouseLeave={() => setHoveredCardId(null)}
        onContextMenu={e => { e.preventDefault(); setContextMenuId(item.id) }}
        style={{ position: 'absolute', left: item.x, top: item.y, transform: `rotate(${item.rotation}deg)`, cursor: 'grab', userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        {item.type === 'text' ? (
          editingItemId === item.id ? (
            <textarea
              autoFocus
              value={editingText}
              onChange={e => {
                const value = e.target.value
                setEditingText(value)
                if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
                saveTimerRef.current = setTimeout(() => {
                  setItems(prev => prev.map(i => (i.id === item.id ? { ...i, content: value } : i)))
                  fetch(`/api/boards/${boardId}/items/${item.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: value }),
                  })
                }, 500)
              }}
              onBlur={() => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); saveText(item.id) }}
              onKeyDown={e => { if (e.key === 'Escape') saveText(item.id) }}
              onMouseDown={e => e.stopPropagation()}
              ref={getCardRef(item.id)}
              data-item-id={item.id}
              style={{ width: size.w, minHeight: size.h, background: 'transparent', border: '1px dashed rgba(255,255,255,0.25)', borderRadius: 6, padding: 8, fontSize: 14, color: 'var(--text-primary)', outline: 'none', resize: 'both', fontFamily: 'inherit' }}
            />
          ) : (
            <div ref={getCardRef(item.id)} data-item-id={item.id} style={{ width: size.w, minHeight: 24, padding: 8, fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {item.content || <span style={{ color: 'var(--text-muted)' }}>Empty text</span>}
            </div>
          )
        ) : item.type === 'swatch' ? (
          <div style={{ position: 'relative', width: size.w }}>
            <div ref={getCardRef(item.id)} data-item-id={item.id} style={{ width: size.w, height: size.h, borderRadius: 8, position: 'relative', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: isConnectTarget ? '1.5px solid #8f89e6' : '1.5px solid transparent' }}>
              <div style={{ position: 'absolute', inset: 0, bottom: 32, backgroundColor: item.color ?? '#888' }} />
              <div style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <Pencil size={12} style={{ color: '#fff' }} />
              </div>
              <div
                onMouseDown={e => e.stopPropagation()}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 32, boxSizing: 'border-box', backgroundColor: '#1d1d20', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}
              >
                <span style={{ color: '#fff', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{(item.color ?? '#888888').toUpperCase()}</span>
                <button
                  onClick={() => copyColor(item)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', padding: '2px 4px' }}
                >
                  <Copy size={11} />
                  {copiedItemId === item.id ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            {colorPopoverId === item.id && (
              <div
                ref={colorPopoverRef}
                onMouseDown={e => e.stopPropagation()}
                onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeColorPopover() } }}
                style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 200, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', padding: 12, zIndex: 50 }}
              >
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px 0' }}>Change color</p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  {SWATCHES.map(c => (
                    <div
                      key={c}
                      onClick={() => setSwatchLiveColor(item.id, c)}
                      style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: c, cursor: 'pointer', boxShadow: (item.color ?? '').toUpperCase() === c.toUpperCase() ? '0 0 0 2px #fff' : 'none' }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ position: 'relative', width: 36, height: 36, borderRadius: 8, overflow: 'hidden', backgroundColor: item.color ?? '#888', flexShrink: 0 }}>
                    <input
                      type="color"
                      value={(normalizeHex(item.color ?? '') ?? '#888888').toLowerCase()}
                      onChange={e => setSwatchLiveColor(item.id, e.target.value.toUpperCase())}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }}
                    />
                  </div>
                  <input
                    ref={hexInputRef}
                    value={hexInput}
                    onChange={e => {
                      const value = e.target.value
                      setHexInput(value)
                      const normalized = normalizeHex(value)
                      if (normalized) setItems(prev => prev.map(i => (i.id === item.id ? { ...i, color: normalized } : i)))
                    }}
                    style={{ flex: 1, minWidth: 0, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
                <button
                  onClick={() => closeColorPopover()}
                  style={{ marginTop: 10, width: '100%', padding: '6px 0', borderRadius: 6, backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 12, border: 'none', cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        ) : item.type === 'image' ? (
          <div ref={getCardRef(item.id)} data-item-id={item.id} style={{ width: size.w, borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: isConnectTarget ? '1.5px solid #8f89e6' : '1.5px solid transparent' }}>
            <img
              src={item.content ?? ''}
              draggable={false}
              onDragStart={e => e.preventDefault()}
              style={{ width: '100%', display: 'block', pointerEvents: 'none', userSelect: 'none' }}
            />
          </div>
        ) : item.type === 'shape' ? (() => {
          const isNone = item.color === 'none'
          const fillColor = item.color && item.color !== 'none' ? item.color : '#AFA9EC'
          const textColor = isNone ? '#d4d4d8' : '#17171a'
          const hPad = item.shape === 'circle' ? '14%' : item.shape === 'diamond' ? '22%' : '14px'
          const isEditingShape = editingItemId === item.id
          return (
            <div style={{ width: size.w, height: size.h, position: 'relative' }}>
              {item.shape === 'diamond' ? (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: isNone ? 'none' : 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}>
                  <polygon
                    points="50,1 99,50 50,99 1,50"
                    fill={isNone ? 'transparent' : fillColor}
                    stroke={isConnectTarget ? '#8f89e6' : isNone ? 'rgba(255,255,255,0.35)' : 'none'}
                    strokeWidth={isConnectTarget || isNone ? 1.5 : 0}
                    strokeDasharray={isNone && !isConnectTarget ? '5,4' : undefined}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ) : (
                <div style={{
                  position: 'absolute', inset: 0, boxSizing: 'border-box',
                  borderRadius: item.shape === 'circle' ? '50%' : item.shape === 'rounded' ? 18 : 4,
                  backgroundColor: isNone ? 'transparent' : fillColor,
                  border: isConnectTarget ? '1.5px solid #8f89e6' : isNone ? '1.5px dashed rgba(255,255,255,0.35)' : 'none',
                  boxShadow: isNone ? 'none' : '0 4px 12px rgba(0,0,0,0.3)',
                }} />
              )}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `0 ${hPad}`, boxSizing: 'border-box' }}>
                {isEditingShape ? (
                  <textarea
                    autoFocus
                    ref={shapeTextareaRef}
                    rows={1}
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onBlur={() => saveText(item.id)}
                    onKeyDown={e => { if (e.key === 'Escape') saveText(item.id) }}
                    onMouseDown={e => e.stopPropagation()}
                    style={{ width: '100%', maxHeight: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', textAlign: 'center', color: textColor, fontSize: 14, fontWeight: 500, lineHeight: 1.35, fontFamily: 'inherit', padding: 0, margin: 0, display: 'block', overflow: 'hidden' }}
                  />
                ) : (
                  <div style={{ width: '100%', textAlign: 'center', color: textColor, fontSize: 14, fontWeight: 500, lineHeight: 1.35, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {item.content ? item.content : (isSelectedShape ? <span style={{ opacity: 0.5 }}>Double-click to type</span> : null)}
                  </div>
                )}
              </div>
            </div>
          )
        })() : (
          <div ref={getCardRef(item.id)} data-item-id={item.id} style={{ width: size.w, backgroundColor: 'var(--bg-secondary)', borderRadius: 8, padding: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: isConnectTarget ? '1.5px solid #8f89e6' : '1.5px solid transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              {item.type === 'doc' ? <FileText size={13} style={{ color: '#8f89e6' }} /> : <StickyNote size={13} style={{ color: '#c98a5e' }} />}
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.type === 'doc' ? 'Doc' : 'Note'}</span>
            </div>
            <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{title ?? 'Untitled'}</p>
          </div>
        )}
        {isSelectedShape && (
          <>
            <div style={{ position: 'absolute', inset: -4, border: '1.5px solid #8f89e6', borderRadius: item.shape === 'circle' ? '50%' : item.shape === 'rounded' ? 18 : 4, pointerEvents: 'none' }} />
            <div
              onMouseDown={e => e.stopPropagation()}
              style={{ position: 'absolute', top: -58, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, padding: 6, borderRadius: 10, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)', zIndex: 50, whiteSpace: 'nowrap' }}
            >
              {SWATCHES.map(c => (
                <div key={c} onClick={() => setShapeColor(item.id, c)} style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: c, cursor: 'pointer', boxShadow: item.color === c ? '0 0 0 2px #fff' : 'none' }} />
              ))}
              <button
                aria-label="No fill"
                onClick={() => setShapeColor(item.id, 'none')}
                style={{ width: 18, height: 18, borderRadius: 5, border: '1px dashed var(--border)', backgroundColor: 'transparent', cursor: 'pointer', padding: 0, boxShadow: item.color === 'none' ? '0 0 0 2px #fff' : 'none' }}
              />
              <div style={{ width: 1, height: 18, backgroundColor: 'var(--border)' }} />
              <button
                onClick={() => { setEditingItemId(item.id); setEditingText(item.content ?? '') }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', padding: '2px 6px' }}
              >
                <Type size={13} /> Text
              </button>
              <button
                onClick={() => deleteItem(item.id)}
                style={{ display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px 6px' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </>
        )}
        {isHovered && !connectDrag && (
          <div
            onMouseDown={e => onHandleMouseDown(e, item)}
            style={item.type === 'shape'
              ? { position: 'absolute', top: '50%', right: -14, transform: 'translateY(-50%)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'crosshair' }
              : { position: 'absolute', bottom: -14, right: -14, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'crosshair' }}
          >
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--bg)', border: '1.5px solid #8f89e6' }} />
          </div>
        )}
        {isSelectedShape && (
          <>
            <div onMouseDown={e => onResizeMouseDown(e, item, 'nw')} style={{ position: 'absolute', top: -11, left: -11, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'nwse-resize', zIndex: 20 }}>
              <div style={{ width: 12, height: 12, backgroundColor: '#fff', border: '1.5px solid #8f89e6' }} />
            </div>
            <div onMouseDown={e => onResizeMouseDown(e, item, 'ne')} style={{ position: 'absolute', top: -11, right: -11, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'nesw-resize', zIndex: 20 }}>
              <div style={{ width: 12, height: 12, backgroundColor: '#fff', border: '1.5px solid #8f89e6' }} />
            </div>
            <div onMouseDown={e => onResizeMouseDown(e, item, 'sw')} style={{ position: 'absolute', bottom: -11, left: -11, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'nesw-resize', zIndex: 20 }}>
              <div style={{ width: 12, height: 12, backgroundColor: '#fff', border: '1.5px solid #8f89e6' }} />
            </div>
            <div onMouseDown={e => onResizeMouseDown(e, item, 'se')} style={{ position: 'absolute', bottom: -11, right: -11, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'nwse-resize', zIndex: 20 }}>
              <div style={{ width: 12, height: 12, backgroundColor: '#fff', border: '1.5px solid #8f89e6' }} />
            </div>
          </>
        )}
        {contextMenuId === item.id && (
          <div ref={contextMenuRef} style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.4)', overflow: 'hidden', zIndex: 10, width: 130 }}>
            {item.type !== 'shape' && <button onClick={() => straighten(item.id)} className="w-full text-left px-3 py-2 text-[12px]" style={{ color: 'var(--text-secondary)' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>Straighten</button>}
            <button onClick={() => deleteItem(item.id)} className="w-full text-left px-3 py-2 text-[12px] text-red-400" onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>Delete</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />

      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between py-5" style={{ position: 'relative', zIndex: 20, paddingLeft: collapsed ? 56 : 32, paddingRight: 32 }}>
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
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', gap: 2, padding: 5, borderRadius: 12, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }} ref={addMenuRef}>
            <button
              onClick={() => setPickerType('doc')}
              onMouseEnter={e => { setHoveredTool('doc'); const r = e.currentTarget.getBoundingClientRect(); setTooltipRect({ top: r.top, left: r.left + r.width / 2, width: r.width }) }}
              onMouseLeave={() => setHoveredTool(null)}
              title="Link a doc"
              style={{ position: 'relative', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8f89e6' }}
            >
              <FileText size={16} />
            </button>
            <button
              onClick={() => setPickerType('note')}
              onMouseEnter={e => { setHoveredTool('note'); const r = e.currentTarget.getBoundingClientRect(); setTooltipRect({ top: r.top, left: r.left + r.width / 2, width: r.width }) }}
              onMouseLeave={() => setHoveredTool(null)}
              title="Link a note"
              style={{ position: 'relative', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c98a5e' }}
            >
              <StickyNote size={16} />
            </button>
            <button
              onClick={async () => { const item = await addItem({ type: 'text', content: '' }); if (item) { setEditingItemId(item.id); setEditingText('') } }}
              onMouseEnter={e => { setHoveredTool('text'); const r = e.currentTarget.getBoundingClientRect(); setTooltipRect({ top: r.top, left: r.left + r.width / 2, width: r.width }) }}
              onMouseLeave={() => setHoveredTool(null)}
              title="Text"
              style={{ position: 'relative', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', backgroundColor: 'rgba(255,255,255,0.06)' }}
            >
              <Type size={16} />
            </button>
            <button
              onClick={handleUploadClick}
              onMouseEnter={e => { setHoveredTool('image'); const r = e.currentTarget.getBoundingClientRect(); setTooltipRect({ top: r.top, left: r.left + r.width / 2, width: r.width }) }}
              onMouseLeave={() => setHoveredTool(null)}
              title="Image"
              disabled={uploadingImage}
              style={{ position: 'relative', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5DCAA5', opacity: uploadingImage ? 0.5 : 1, cursor: uploadingImage ? 'not-allowed' : 'pointer' }}
            >
              {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
            </button>
            <button
              onClick={() => setShapeMenuOpen(v => !v)}
              onMouseEnter={e => { setHoveredTool('shape'); const r = e.currentTarget.getBoundingClientRect(); setTooltipRect({ top: r.top, left: r.left + r.width / 2, width: r.width }) }}
              onMouseLeave={() => setHoveredTool(null)}
              title="Add shape"
              style={{ position: 'relative', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#85B7EB' }}
            >
              <Shapes size={16} />
            </button>
            {shapeMenuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', padding: 6, zIndex: 50, width: 160 }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 6px 6px 6px' }}>Add shape</p>
                <button onClick={() => addShape('rect')} className="w-full text-left px-2 py-2 text-[12.5px]" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', borderRadius: 6 }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  <RectangleHorizontal size={14} /> Rectangle
                </button>
                <button onClick={() => addShape('rounded')} className="w-full text-left px-2 py-2 text-[12.5px]" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', borderRadius: 6 }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  <Square size={14} /> Rounded
                </button>
                <button onClick={() => addShape('circle')} className="w-full text-left px-2 py-2 text-[12.5px]" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', borderRadius: 6 }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  <Circle size={14} /> Circle
                </button>
                <button onClick={() => addShape('diamond')} className="w-full text-left px-2 py-2 text-[12.5px]" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', borderRadius: 6 }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  <Diamond size={14} /> Diamond
                </button>
              </div>
            )}
            <div style={{ width: 1, height: 20, backgroundColor: 'var(--border)', margin: '0 4px' }} />
            <button
              onClick={() => setSwatchMenuOpen(v => !v)}
              onMouseEnter={e => { setHoveredTool('swatch'); const r = e.currentTarget.getBoundingClientRect(); setTooltipRect({ top: r.top, left: r.left + r.width / 2, width: r.width }) }}
              onMouseLeave={() => setHoveredTool(null)}
              title="Add color card"
              style={{ position: 'relative', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: '#EF9F27', display: 'block' }} />
            </button>
            {swatchMenuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', padding: 10, zIndex: 50, width: 140 }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px 0' }}>Add color card</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {SWATCHES.map(c => (
                    <div key={c} onClick={() => { addItem({ type: 'swatch', color: c }); setSwatchMenuOpen(false) }} style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: c, cursor: 'pointer' }} />
                  ))}
                  <button
                    aria-label="Pick a custom color"
                    onClick={async () => {
                      setSwatchMenuOpen(false)
                      const item = await addItem({ type: 'swatch', color: '#8F89E6' })
                      if (item) await openColorPopover(item)
                    }}
                    style={{ width: 22, height: 22, borderRadius: 6, border: '1px dashed var(--border)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                  >
                    <Plus size={12} />
                  </button>
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
          {hoveredTool && !(hoveredTool === 'swatch' && swatchMenuOpen) && !(hoveredTool === 'shape' && shapeMenuOpen) && tooltipRect && typeof document !== 'undefined' && createPortal(
            <div style={{ position: 'fixed', top: tooltipRect.top - 34, left: tooltipRect.left, transform: 'translateX(-50%)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 11, padding: '5px 9px', borderRadius: 6, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 9999, pointerEvents: 'none' }}>
              {hoveredTool === 'doc' ? 'Link a doc' : hoveredTool === 'note' ? 'Link a note' : hoveredTool === 'text' ? 'Text' : hoveredTool === 'image' ? 'Image' : hoveredTool === 'shape' ? 'Add shape' : hoveredTool === 'swatch' ? 'Add color card' : ''}
            </div>,
            document.body
          )}
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
                const fromSize = connectorSize(from)
                const toSize = connectorSize(to)
                const fromRect = { x: from.x, y: from.y, w: fromSize.w, h: fromSize.h }
                const toRect = { x: to.x, y: to.y, w: toSize.w, h: toSize.h }
                const p1 = edgePoint(fromRect, to.x + toSize.w / 2, to.y + toSize.h / 2)
                const p2 = edgePoint(toRect, from.x + fromSize.w / 2, from.y + fromSize.h / 2)
                const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y
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
                const size = connectorSize(from)
                const fromRect = { x: from.x, y: from.y, w: size.w, h: size.h }
                const p1 = edgePoint(fromRect, connectDrag.x, connectDrag.y)
                return (
                  <>
                    <line x1={p1.x} y1={p1.y} x2={connectDrag.x} y2={connectDrag.y} stroke="#8f89e6" strokeWidth={1.3} strokeDasharray="3,4" />
                    <circle cx={p1.x} cy={p1.y} r={3} fill="var(--bg)" stroke="#8f89e6" strokeWidth={1.3} />
                  </>
                )
              })()}
            </svg>

            {frameShapes.map(renderItem)}
            {otherItems.map(renderItem)}
            {pendingImages.map(p => {
              const size = cardSize('image')
              return (
                <div
                  key={p.tempId}
                  style={{ position: 'absolute', left: p.x, top: p.y, transform: `rotate(${p.rotation}deg)`, userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  <div style={{ width: size.w, borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1.5px solid transparent', position: 'relative' }}>
                    <img src={p.previewUrl} draggable={false} style={{ width: '100%', display: 'block', pointerEvents: 'none', userSelect: 'none' }} />
                    <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 size={12} className="animate-spin" style={{ color: '#fff' }} />
                    </div>
                  </div>
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
