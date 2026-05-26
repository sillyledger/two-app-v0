"use client"

import Link from "next/link"
import { Share2, MoreHorizontal, Copy, Download, Trash2, Globe, Lock, FolderInput, Star, FileText, PanelRightClose, PanelRightOpen } from "lucide-react"
import { useState, useRef, useEffect } from "react"

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
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
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

function exportAsPDF(docTitle: string, content: string) {
  const markdownContent = htmlToMarkdown(content)
  const htmlDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${docTitle}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 15px;
      line-height: 1.7;
      color: #111;
      max-width: 720px;
      margin: 60px auto;
      padding: 0 40px;
    }
    h1 { font-size: 2em; font-weight: 700; margin-bottom: 0.4em; }
    h2 { font-size: 1.4em; font-weight: 600; margin-top: 1.6em; }
    h3 { font-size: 1.1em; font-weight: 600; margin-top: 1.4em; }
    p { margin: 0.8em 0; }
    code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
    blockquote { border-left: 3px solid #ccc; margin: 0; padding-left: 16px; color: #555; }
    hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
    a { color: #0070f3; }
    ul, ol { padding-left: 1.5em; }
    li { margin: 0.3em 0; }
  </style>
</head>
<body>
  <h1>${docTitle}</h1>
  ${content}
</body>
</html>`

  const blob = new Blob([htmlDoc], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${docTitle.trim() || 'untitled'}.html`
  a.click()
  URL.revokeObjectURL(url)
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

  return (
    <>
      <header
        className="fixed top-0 z-40 h-[44px] flex items-center px-4 transition-all duration-200"
        style={{ left: sidebarWidth, right: 0, backgroundColor: "var(--bg)" }}
      >
        {/* Left — Breadcrumbs */}
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

        {/* Right */}
        <div className="flex items-center gap-1 shrink-0 ml-4">

          {/* Autosave indicator */}
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

          {/* Wide/Narrow toggle */}
          {onToggleWide && (
            <button
              onClick={onToggleWide}
              title={wideMode ? "Narrow view" : "Wide view"}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: wideMode ? "var(--text-primary)" : "var(--text-muted)", backgroundColor: wideMode ? "var(--bg-tertiary)" : "transparent" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = wideMode ? "var(--bg-tertiary)" : "transparent"; e.currentTarget.style.color = wideMode ? "var(--text-primary)" : "var(--text-muted)" }}
            >
              {wideMode ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            </button>
          )}

          {/* Star / Favorite */}
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: isFavorite ? "#EF9F27" : "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#EF9F27")}
              onMouseLeave={e => (e.currentTarget.style.color = isFavorite ? "#EF9F27" : "var(--text-muted)")}
            >
              <Star size={14} fill={isFavorite ? "#EF9F27" : "none"} />
            </button>
          )}

          {/* Move to folder */}
          {onDelete && (
            <button
              onClick={openMoveModal}
              title="Move to folder"
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}
            >
              <FolderInput size={14} />
            </button>
          )}

          {/* Share button + popup */}
          <div className="relative ml-1" ref={shareRef}>
            <button
              onClick={() => setShareOpen(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}
            >
              <Share2 size={12} />
              Share
            </button>

            {shareOpen && (
              <div className="absolute right-0 top-[42px] z-50 rounded-xl shadow-2xl w-[300px] p-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
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
                  <button
                    onClick={handleTogglePublic}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${publicEnabled ? 'bg-emerald-500' : 'bg-[#333]'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${publicEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <button
                  onClick={handleCopyLink}
                  disabled={!publicEnabled}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-[12px] font-medium transition-colors"
                  style={{ backgroundColor: publicEnabled ? "var(--bg-tertiary)" : "var(--bg-secondary)", color: publicEnabled ? "var(--text-secondary)" : "var(--text-muted)", cursor: publicEnabled ? "pointer" : "not-allowed" }}
                >
                  <Copy size={12} />
                  {linkCopied ? "Copied!" : "Copy link"}
                </button>
              </div>
            )}
          </div>

          {/* ··· menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-50 rounded-lg shadow-xl w-[190px] py-1 overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <button
                  onClick={handleCopyDoc}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Copy size={12} style={{ color: "var(--text-muted)" }} /> Copy doc
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Download size={12} style={{ color: "var(--text-muted)" }} /> Export as Markdown
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <FileText size={12} style={{ color: "var(--text-muted)" }} /> Export as PDF
                </button>

                {/* Divider before danger zone */}
                <div className="my-1 mx-2" style={{ borderTop: "1px solid var(--border)" }} />

                <button
                  onClick={() => { setMenuOpen(false); setShowDeleteModal(true) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors"
                  style={{ color: "#f87171" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Trash2 size={12} /> Delete doc
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

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
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
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

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setShowDeleteModal(false)} />
          <div className="relative rounded-xl shadow-2xl w-[320px] p-5 z-10" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <h2 className="text-[14px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Delete doc</h2>
            <p className="text-[12px] mb-5" style={{ color: "var(--text-muted)" }}>This doc will be permanently deleted. This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors" style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
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
