"use client"

import Link from "next/link"
import { MoreHorizontal, Copy, Download, Trash2, Globe, Lock, FolderInput, Star, FileText, PanelRight, Share2, Columns2, ArrowLeftRight } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useOthers, useSelf } from "@/liveblocks.config"

interface Folder {
  id: string
  name: string
}

interface DocTopbarProps {
  docTitle: string
  folder?: Folder | null
  saveStatus: "saved" | "saving" | "unsaved"
  content?: string
  onDelete?: () => void
  docId?: string | string[]
  isPublic?: boolean
  sidebarWidth?: string
  wideMode?: boolean
  onToggleWide?: () => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
  detailOpen?: boolean
  onToggleDetail?: () => void
  currentUserName?: string
  splitViewActive?: boolean
  onToggleSplitView?: () => void
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

async function exportAsPDF(docTitle: string, html: string) {
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
  const titleLines = doc.splitTextToSize(docTitle || 'Untitled', maxWidth)
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

  doc.save(`${docTitle.trim() || 'untitled'}.pdf`)
}

const PRESENCE_COLORS = [
  '#52e0b8', '#e05252', '#f5a623',
  '#a052e0', '#52b8e0', '#52e052', '#e052a0',
]

function PresenceAvatars({ currentUserName }: { currentUserName?: string }) {
  const others = useOthers()
  const self = useSelf()

  const selfName = currentUserName || (self?.presence?.name as string) || 'You'
  const selfInitial = selfName[0]?.toUpperCase() ?? 'Y'

  const visible = others.slice(0, 3)
  const overflow = others.length - 3

  return (
    <div className="flex items-center mr-1">
      <div
        title={`${selfName} (you)`}
        style={{
          width: 24, height: 24, borderRadius: '50%',
          backgroundColor: '#5271e0',
          border: '2px solid var(--bg)',
          outline: '2px solid #5271e0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 600, color: '#fff',
          position: 'relative', flexShrink: 0, zIndex: 10,
        }}
      >
        {selfInitial}
      </div>

      {visible.map((other, i) => {
        const name: string = (other.presence?.name as string) || '?'
        const initial = name[0]?.toUpperCase() ?? '?'
        const color = PRESENCE_COLORS[i % PRESENCE_COLORS.length]
        return (
          <div
            key={other.connectionId}
            title={name}
            style={{
              width: 24, height: 24, borderRadius: '50%',
              backgroundColor: color,
              border: '2px solid var(--bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 600, color: '#fff',
              marginLeft: -6, zIndex: 9 - i, position: 'relative', flexShrink: 0,
            }}
          >
            {initial}
          </div>
        )
      })}

      {overflow > 0 && (
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          backgroundColor: 'var(--bg-tertiary)',
          border: '2px solid var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)',
          marginLeft: -6, position: 'relative', flexShrink: 0,
        }}>
          +{overflow}
        </div>
      )}
    </div>
  )
}

export default function DocTopbar({
  docTitle,
  folder,
  saveStatus,
  content = '',
  onDelete,
  docId,
  isPublic = false,
  sidebarWidth = '0px',
  wideMode = false,
  onToggleWide,
  isFavorite = false,
  onToggleFavorite,
  detailOpen = false,
  onToggleDetail,
  currentUserName,
  splitViewActive = false,
  onToggleSplitView,
}: DocTopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [copyToast, setCopyToast] = useState(false)
  const [publicEnabled, setPublicEnabled] = useState(isPublic)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [moveToast, setMoveToast] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const shareRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setPublicEnabled(isPublic) }, [isPublic])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false)
    }
    if (menuOpen || shareOpen) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen, shareOpen])

  const handleExportMarkdown = () => {
    setMenuOpen(false)
    const md = `# ${docTitle}\n\n${htmlToMarkdown(content)}`
    downloadFile(`${docTitle.trim() || 'untitled'}.md`, md, 'text/markdown')
  }

  const handleExportPDF = () => {
    setMenuOpen(false)
    exportAsPDF(docTitle, content)
  }

  const handleCopyDoc = () => {
    setMenuOpen(false)
    const md = `# ${docTitle}\n\n${htmlToMarkdown(content)}`
    navigator.clipboard.writeText(md).then(() => {
      setCopyToast(true)
      setTimeout(() => setCopyToast(false), 2000)
    })
  }

  const handleTogglePublic = async () => {
    const newValue = !publicEnabled
    setPublicEnabled(newValue)
    await fetch(`/api/docs/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: newValue }),
    })
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/docs/${docId}`
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  const openMoveModal = async () => {
    setMenuOpen(false)
    const res = await fetch("/api/folders")
    const data = await res.json()
    setFolders(Array.isArray(data) ? data : [])
    setShowMoveModal(true)
  }

  const handleMove = async (folderId: string) => {
    await fetch(`/api/docs/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId }),
    })
    setShowMoveModal(false)
    setMoveToast(true)
    setTimeout(() => setMoveToast(false), 2000)
  }

  const handleWideMode = () => {
    setMenuOpen(false)
    onToggleWide?.()
  }

  const handleOpenShare = () => {
    setMenuOpen(false)
    setShareOpen(true)
  }

  return (
    <>
      <header
        className="fixed top-0 z-40 h-[44px] flex items-center px-4 transition-all duration-200"
        style={{ left: "var(--sidebar-width, 0px)", right: 0, backgroundColor: "var(--bg)" }}
      >
        {/* LEFT — breadcrumb */}
        <div className="flex items-center gap-0.5 min-w-0 flex-1">
          <Link href="/" className="text-[12px] font-medium truncate transition-colors" style={{ color: "var(--text-muted)" }}>
            Home
          </Link>
          {folder ? (
            <>
              <span className="mx-1 text-[12px]" style={{ color: "var(--text-muted)" }}>/</span>
              <Link href={`/folders/${folder.id}`} className="text-[12px] font-medium truncate transition-colors hover:underline" style={{ color: "var(--text-muted)" }}>
                {folder.name}
              </Link>
              <span className="mx-1 text-[12px]" style={{ color: "var(--text-muted)" }}>/</span>
            </>
          ) : (
            <span className="mx-1 text-[12px]" style={{ color: "var(--text-muted)" }}>/</span>
          )}
          <span className="text-[12px] font-medium truncate max-w-[220px]" style={{ color: "var(--text-secondary)" }}>
            {docTitle || "Untitled"}
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

          {/* Presence avatars */}
          <PresenceAvatars currentUserName={currentUserName} />

          {/* Favorite */}
          {onToggleFavorite && (
            <button onClick={onToggleFavorite} title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: isFavorite ? "#EF9F27" : "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#EF9F27")}
              onMouseLeave={e => (e.currentTarget.style.color = isFavorite ? "#EF9F27" : "var(--text-muted)")}
            ><Star size={14} fill={isFavorite ? "#EF9F27" : "none"} /></button>
          )}

          {/* Move to folder */}
          {onDelete && (
            <button onClick={openMoveModal} title="Move to folder"
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

          {/* Details panel toggle */}
          {onToggleDetail && (
            <button onClick={onToggleDetail} title={detailOpen ? "Close details" : "Open details"}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: detailOpen ? "var(--text-primary)" : "var(--text-muted)", backgroundColor: detailOpen ? "var(--bg-tertiary)" : "transparent" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = detailOpen ? "var(--bg-tertiary)" : "transparent"; e.currentTarget.style.color = detailOpen ? "var(--text-primary)" : "var(--text-muted)" }}
            ><PanelRight size={14} /></button>
          )}

          {/* ··· menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(v => !v)}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}
            ><MoreHorizontal size={15} /></button>

            {menuOpen && (
              <div className="absolute right-0 top-9 z-50 rounded-lg shadow-xl w-[210px] py-1 overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>

                {/* VIEW */}
                <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>View</p>
                {onToggleWide && (
                  <button onClick={handleWideMode} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors" style={{ color: "var(--text-secondary)" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  ><ArrowLeftRight size={12} style={{ color: "var(--text-muted)" }} /> {wideMode ? "Narrow view" : "Wide view"}</button>
                )}

                <div className="my-1 mx-2" style={{ borderTop: "1px solid var(--border)" }} />

                {/* SHARE */}
                <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Share</p>
                <div className="relative" ref={shareRef}>
                  <button onClick={handleOpenShare} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors" style={{ color: "var(--text-secondary)" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  ><Share2 size={12} style={{ color: "var(--text-muted)" }} /> Share doc…</button>
                </div>

                <div className="my-1 mx-2" style={{ borderTop: "1px solid var(--border)" }} />

                {/* EXPORT */}
                <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Export</p>
                <button onClick={handleCopyDoc} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors" style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                ><Copy size={12} style={{ color: "var(--text-muted)" }} /> Copy as Markdown</button>
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
                ><Trash2 size={12} /> Delete doc</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Share dropdown — now rendered outside the menu so it can be opened from the menu item */}
      {shareOpen && (
        <div ref={shareRef} className="fixed z-50 rounded-xl shadow-2xl w-[300px] p-4" style={{ top: 52, right: 16, backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-[13px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Share this doc</p>
          <p className="text-[11px] mb-4" style={{ color: "var(--text-muted)" }}>Anyone with the link can view this doc when enabled.</p>
          <div className="flex items-center justify-between rounded-lg px-3 py-2.5 mb-3" style={{ backgroundColor: "var(--bg-tertiary)" }}>
            <div className="flex items-center gap-2">
              {publicEnabled ? <Globe size={13} className="text-emerald-400 shrink-0" /> : <Lock size={13} style={{ color: "var(--text-muted)" }} className="shrink-0" />}
              <div>
                <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>{publicEnabled ? "Anyone with the link" : "Private"}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{publicEnabled ? "Link sharing is on" : "Only you can access"}</p>
              </div>
            </div>
            <button onClick={handleTogglePublic} className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${publicEnabled ? 'bg-emerald-500' : 'bg-[#333]'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${publicEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
          <button onClick={handleCopyLink} disabled={!publicEnabled}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-[12px] font-medium transition-colors"
            style={{ backgroundColor: publicEnabled ? "var(--bg-tertiary)" : "var(--bg-secondary)", color: publicEnabled ? "var(--text-secondary)" : "var(--text-muted)", cursor: publicEnabled ? "pointer" : "not-allowed" }}
          ><Copy size={12} />{linkCopied ? "Copied!" : "Copy link"}</button>
          <button onClick={() => setShareOpen(false)} className="flex items-center justify-center w-full mt-2 py-1.5 text-[11px] rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >Close</button>
        </div>
      )}

      {/* Toasts */}
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2 text-[12px] shadow-xl" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          Copied to clipboard
        </div>
      )}
      {moveToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2 text-[12px] shadow-xl" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          Doc moved
        </div>
      )}

      {/* Move to folder modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-80 shadow-2xl" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <h2 className="font-semibold text-base mb-4" style={{ color: "var(--text-primary)" }}>Move to folder</h2>
            {folders.length === 0 ? (
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>No folders yet. Create a folder in the sidebar first.</p>
            ) : (
              <div className="flex flex-col gap-1 mb-4 max-h-48 overflow-y-auto">
                {folders.map(f => (
                  <button key={f.id} onClick={() => handleMove(f.id)} className="text-left px-3 py-2 rounded-lg text-sm transition-colors" style={{ color: "var(--text-secondary)" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >📁 {f.name}</button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setShowMoveModal(false)} className="px-4 py-2 text-sm" style={{ color: "var(--text-muted)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setShowDeleteModal(false)} />
          <div className="relative rounded-xl shadow-2xl w-[320px] p-5 z-10" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <h2 className="text-[14px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Delete doc</h2>
            <p className="text-[12px] mb-5" style={{ color: "var(--text-muted)" }}>This doc will be permanently deleted. This cannot be undone.</p>
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
