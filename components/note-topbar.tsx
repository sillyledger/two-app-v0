"use client"

import Link from "next/link"
import { MoreVertical, Download, Trash2, FolderInput, FileText, Columns2 } from "lucide-react"
import { useState, useRef, useEffect } from "react"

export interface NoteCategory {
  id: number
  name: string
  color: string
  parent_id: number | null
}

interface NoteTopbarProps {
  noteTitle: string
  category?: { id: number; name: string; color: string } | null
  saveStatus: "saved" | "saving"
  noteId: string
  onDelete?: () => void
  content?: string
  splitViewActive?: boolean
  onToggleSplitView?: () => void
  allCategories?: NoteCategory[]
  onMove?: (categoryId: number | null) => void
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim()
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>/gi, '\n').replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n').replace(/<\/ol>/gi, '\n')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>|<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>|<img[^>]*src="([^"]*)"[^>]*>/gi, (_,src1,alt1,alt2,src2,src3) => `![${alt1||alt2||''}](${src1||src2||src3||''})\n\n`)
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function loadImageAsBase64(src: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        resolve({ dataUrl, width: canvas.width, height: canvas.height })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = `/api/proxy-image?url=${encodeURIComponent(src)}`
  })
}

async function exportAsPDF(noteTitle: string, html: string) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const maxWidth = pageWidth - margin * 2
  let y = margin

  const checkY = (needed: number) => {
    if (y + needed > pageHeight - margin) { doc.addPage(); y = margin }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(0, 0, 0)
  const titleLines = doc.splitTextToSize(noteTitle || 'Untitled', maxWidth)
  doc.text(titleLines, margin, y)
  y += titleLines.length * 10 + 4
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  const parser = new DOMParser()
  const domDoc = parser.parseFromString(html, 'text/html')
  const body = domDoc.body

  async function processNode(node: Element) {
    const tag = node.tagName?.toLowerCase()

    if (tag === 'img') {
      const src = node.getAttribute('src') || ''
      if (src) {
        const imgData = await loadImageAsBase64(src)
        if (imgData) {
          const aspectRatio = imgData.height / imgData.width
          const imgW = Math.min(maxWidth, 120)
          const imgH = imgW * aspectRatio
          checkY(imgH + 4)
          try {
            doc.addImage(imgData.dataUrl, 'JPEG', margin, y, imgW, imgH)
            y += imgH + 4
          } catch { }
        }
      }
      return
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = node.querySelectorAll(':scope > li')
      for (const li of Array.from(items)) {
        const liText = stripTags(li.innerHTML).replace(/\n+/g, ' ').trim()
        if (liText) {
          checkY(6)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(10)
          doc.setTextColor(30, 30, 30)
          const prefix = tag === 'ol' ? '  ' : '• '
          const w = doc.splitTextToSize(prefix + liText, maxWidth - 6)
          doc.text(w, margin + 4, y)
          y += w.length * 5.5 + 1
        }
        const imgs = li.querySelectorAll('img')
        for (const img of Array.from(imgs)) { await processNode(img) }
      }
      return
    }

    if (tag === 'blockquote') {
      const text = stripTags(node.innerHTML).replace(/\n+/g, ' ').trim()
      if (text) {
        checkY(6)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        doc.setTextColor(100, 100, 100)
        const w = doc.splitTextToSize(text, maxWidth - 8)
        doc.text(w, margin + 6, y)
        y += w.length * 5.5 + 2
        doc.setTextColor(30, 30, 30)
      }
      return
    }

    if (tag === 'hr') {
      checkY(6)
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, y, pageWidth - margin, y)
      y += 6
      return
    }

    if (tag === 'h1') {
      const text = stripTags(node.innerHTML).replace(/\n+/g, ' ').trim()
      if (text) {
        checkY(12)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(16)
        doc.setTextColor(0, 0, 0)
        const w = doc.splitTextToSize(text, maxWidth)
        doc.text(w, margin, y)
        y += w.length * 8 + 4
      }
      return
    }

    if (tag === 'h2') {
      const text = stripTags(node.innerHTML).replace(/\n+/g, ' ').trim()
      if (text) {
        checkY(10)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.setTextColor(0, 0, 0)
        const w = doc.splitTextToSize(text, maxWidth)
        doc.text(w, margin, y)
        y += w.length * 7 + 3
      }
      return
    }

    if (tag === 'h3') {
      const text = stripTags(node.innerHTML).replace(/\n+/g, ' ').trim()
      if (text) {
        checkY(8)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(0, 0, 0)
        const w = doc.splitTextToSize(text, maxWidth)
        doc.text(w, margin, y)
        y += w.length * 6 + 2
      }
      return
    }

    if (tag === 'p') {
      const imgs = node.querySelectorAll('img')
      if (imgs.length > 0) {
        for (const img of Array.from(imgs)) { await processNode(img) }
        return
      }
      const text = stripTags(node.innerHTML).replace(/\n+/g, ' ').trim()
      if (text) {
        checkY(6)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(30, 30, 30)
        const w = doc.splitTextToSize(text, maxWidth)
        doc.text(w, margin, y)
        y += w.length * 5.5 + 2
      }
      return
    }

    for (const child of Array.from(node.children)) {
      await processNode(child as Element)
    }
  }

  for (const child of Array.from(body.children)) {
    await processNode(child as Element)
  }

  doc.save(`${noteTitle.trim() || 'untitled'}.pdf`)
}

function sortCategoriesForMove(cats: NoteCategory[]): (NoteCategory & { depth: number })[] {
  const result: (NoteCategory & { depth: number })[] = []
  function walk(parentId: number | null, depth: number) {
    cats.filter(c => c.parent_id === parentId).forEach(c => {
      result.push({ ...c, depth })
      walk(c.id, depth + 1)
    })
  }
  walk(null, 0)
  return result
}

function MoveToCategoryModal({ categories, currentCategoryId, onMove, onClose }: {
  categories: NoteCategory[]
  currentCategoryId: number | null
  onMove: (categoryId: number | null) => void
  onClose: () => void
}) {
  const ordered = sortCategoriesForMove(categories)

  const onRowEnter = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)" }
  const onRowLeave = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.backgroundColor = "transparent" }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="rounded-2xl p-4 w-80 shadow-2xl" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold text-base mb-3 px-1" style={{ color: "var(--text-primary)" }}>Move to category</h2>

        <div className="flex flex-col gap-[1px] mb-2 max-h-64 overflow-y-auto">
          <button
            onClick={currentCategoryId === null ? undefined : () => onMove(null)}
            disabled={currentCategoryId === null}
            className="relative text-left flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors"
            style={{ color: currentCategoryId === null ? "var(--text-muted)" : "var(--text-secondary)", cursor: currentCategoryId === null ? "default" : "pointer" }}
            onMouseEnter={currentCategoryId === null ? undefined : onRowEnter}
            onMouseLeave={currentCategoryId === null ? undefined : onRowLeave}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0 }} />
            No category
            {currentCategoryId === null && <span className="text-[10.5px] shrink-0 ml-1" style={{ color: "var(--text-muted)" }}>Current</span>}
          </button>

          {ordered.length === 0 && (
            <p className="text-sm px-2 py-4 text-center" style={{ color: "var(--text-muted)" }}>No categories yet.</p>
          )}

          {ordered.map(cat => {
            const isCurrent = cat.id === currentCategoryId
            return (
              <button
                key={cat.id}
                onClick={isCurrent ? undefined : () => onMove(cat.id)}
                disabled={isCurrent}
                className="relative text-left flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors"
                style={{ color: isCurrent ? "var(--text-muted)" : "var(--text-secondary)", cursor: isCurrent ? "default" : "pointer", paddingLeft: cat.depth > 0 ? 28 : 8 }}
                onMouseEnter={isCurrent ? undefined : onRowEnter}
                onMouseLeave={isCurrent ? undefined : onRowLeave}
              >
                {cat.depth > 0 && (
                  <span
                    className="absolute"
                    style={{ left: 16, top: 0, bottom: '50%', width: 10, borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)', borderRadius: '0 0 0 4px' }}
                  />
                )}
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                <span className="truncate">{cat.name}</span>
                {isCurrent && <span className="text-[10.5px] shrink-0 ml-1" style={{ color: "var(--text-muted)" }}>Current</span>}
              </button>
            )
          })}
        </div>

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: "var(--text-muted)" }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function NoteTopbar({
  noteTitle,
  category,
  saveStatus,
  noteId,
  onDelete,
  content = '',
  splitViewActive = false,
  onToggleSplitView,
  allCategories = [],
  onMove,
}: NoteTopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveToast, setMoveToast] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen])

  const handleExportMarkdown = () => {
    setMenuOpen(false)
    const md = `# ${noteTitle}\n\n${htmlToMarkdown(content)}`
    downloadFile(`${noteTitle.trim() || 'untitled'}.md`, md, 'text/markdown')
  }

  const handleExportPDF = () => {
    setMenuOpen(false)
    exportAsPDF(noteTitle, content)
  }

  const openMoveModal = () => {
    setMenuOpen(false)
    setShowMoveModal(true)
  }

  const handleMove = (categoryId: number | null) => {
    setShowMoveModal(false)
    onMove?.(categoryId)
    setMoveToast(true)
    setTimeout(() => setMoveToast(false), 2000)
  }

  return (
    <>
      <header
        className="fixed top-0 z-40 h-[44px] flex items-center px-4 transition-all duration-200"
        style={{ left: "var(--sidebar-width, 0px)", right: 0, backgroundColor: "var(--bg)" }}
      >
        {/* LEFT — breadcrumb */}
        <div className="flex items-center gap-0.5 min-w-0 flex-1">
          <Link href="/notes" className="text-[12px] font-medium truncate transition-colors" style={{ color: "var(--text-muted)" }}>
            Notes
          </Link>
          {category && (
            <>
              <span className="mx-1 text-[12px]" style={{ color: "var(--text-muted)" }}>/</span>
              <span className="text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{category.name}</span>
            </>
          )}
          <span className="mx-1 text-[12px]" style={{ color: "var(--text-muted)" }}>/</span>
          <span className="text-[12px] font-medium truncate max-w-[220px]" style={{ color: "var(--text-secondary)" }}>
            {noteTitle || "Untitled"}
          </span>
        </div>

        {/* RIGHT — actions */}
        <div className="flex items-center gap-1 shrink-0 ml-2">

          {/* Save status */}
          <div className="flex items-center gap-1.5 h-5 mr-1">
            {saveStatus === "saving" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/80 animate-pulse" />
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Saving...</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Saved</span>
              </>
            )}
          </div>

          {/* Move to category */}
          {onMove && (
            <button onClick={openMoveModal} title="Move to category"
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}
            ><FolderInput size={14} /></button>
          )}

          {/* Split View button */}
          {onToggleSplitView && (
            <button
              onClick={onToggleSplitView}
              title={splitViewActive ? "Close split view" : "Open split view"}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors"
              style={{
                color: splitViewActive ? "var(--sb-active-color)" : "var(--text-muted)",
                backgroundColor: splitViewActive ? "var(--sb-active-bg)" : "transparent",
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = splitViewActive ? "var(--sb-active-bg)" : "transparent"; e.currentTarget.style.color = splitViewActive ? "var(--sb-active-color)" : "var(--text-muted)" }}
            >
              <Columns2 size={13} /> Split View
            </button>
          )}

          {/* ··· menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(v => !v)}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}
            ><MoreVertical size={15} /></button>

            {menuOpen && (
              <div className="absolute right-0 top-9 z-50 rounded-lg shadow-xl w-[210px] py-1 overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>

                {/* EXPORT */}
                <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Export</p>
                <button onClick={handleExportMarkdown} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors" style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                ><Download size={12} style={{ color: "var(--text-muted)" }} /> Export as Markdown</button>
                <button onClick={handleExportPDF} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors" style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                ><FileText size={12} style={{ color: "var(--text-muted)" }} /> Export as PDF</button>

                <div className="my-1 mx-2" style={{ borderTop: "1px solid var(--border)" }} />

                {/* DELETE */}
                <button onClick={() => { setMenuOpen(false); setShowDeleteModal(true) }} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors" style={{ color: "#f87171" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.08)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                ><Trash2 size={12} /> Delete note</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Move toast */}
      {moveToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2 text-[12px] shadow-xl" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          Note moved
        </div>
      )}

      {/* Move to category modal */}
      {showMoveModal && (
        <MoveToCategoryModal
          categories={allCategories}
          currentCategoryId={category?.id ?? null}
          onMove={handleMove}
          onClose={() => setShowMoveModal(false)}
        />
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setShowDeleteModal(false)} />
          <div className="relative rounded-xl shadow-2xl w-[320px] p-5 z-10" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <h2 className="text-[14px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Delete note</h2>
            <p className="text-[12px] mb-5" style={{ color: "var(--text-muted)" }}>This note will be permanently deleted. This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors" style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >Cancel</button>
              <button onClick={() => { setShowDeleteModal(false); onDelete?.() }} className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-red-500/90 text-white hover:bg-red-500 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
