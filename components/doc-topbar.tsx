"use client"

import Link from "next/link"
import { Share2, MoreHorizontal, Copy, Download, Trash2, Globe, Lock, FolderInput, AlignCenter, AlignJustify, ChevronRight } from "lucide-react"
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

  useEffect(() => {
    setPublicEnabled(isPublic)
  }, [isPublic])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false)
      }
    }
    if (menuOpen || shareOpen) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen, shareOpen])

  const handleExportMarkdown = () => {
    setMenuOpen(false)
    const md = `# ${docTitle}\n\n${htmlToMarkdown(content)}`
    const filename = `${docTitle.trim() || 'untitled'}.md`
    downloadFile(filename, md, 'text/markdown')
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
        className="fixed top-0 right-0 z-40 h-[44px] flex items-center px-4 transition-all duration-200"
        style={{
          left: sidebarWidth,
          backgroundColor: "var(--bg)",
        }}
      >
        {/* Left — Breadcrumbs */}
        <div className="flex items-center gap-0.5 min-w-0 flex-1">
          <Link
            href="/"
            className="text-[12px] font-medium truncate transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            Home
          </Link>
          {folder ? (
            <>
              <span className="mx-1 text-[12px]" style={{ color: "var(--text-muted)" }}>/</span>
              <Link
                href={`/folders/${folder.id}`}
                className="text-[12px] font-medium truncate transition-colors hover:underline"
                style={{ color: "var(--text-muted)" }}
              >
                {folder.name}
              </Link>
              <span className="mx-1 text-[12px]" style={{ color: "var(--text-muted)" }}>/</span>
            </>
          ) : (
            <span className="mx-1 text-[12px]" style={{ color: "var(--text-muted)" }}>/</span>
          )}
          <span
            className="text-[12px] font-medium truncate max-w-[220px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {docTitle || "Untitled"}
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0 ml-4">

          {/* Autosave indicator */}
          <div className="flex items-center gap-1.5 h-5">
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
              style={{
                color: wideMode ? "var(--text-primary)" : "var(--text-muted)",
                backgroundColor: wideMode ? "var(--bg-tertiary)" : "transparent",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"
                e.currentTarget.style.color = "var(--text-primary)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = wideMode ? "var(--bg-tertiary)" : "transparent"
                e.currentTarget.style.color = wideMode ? "var(--text-primary)" : "var(--text-muted)"
              }}
            >
              {wideMode ? <AlignCenter size={14} /> : <AlignJustify size={14} />}
            </button>
          )}

          {/* Share button + popup */}
          <div className="relative" ref={shareRef}>
            <button
              onClick={() => setShareOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"
                e.currentTarget.style.color = "var(--text-primary)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = "transparent"
                e.currentTarget.style.color = "var(--text-muted)"
              }}
            >
              <Share2 size={12} />
              Share
            </button>

            {shareOpen && (
              <div
                className="absolute right-0 top-[42px] z-50 rounded-xl shadow-2xl w-[300px] p-4"
                style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              >
                <p className="text-[13px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Share this doc
                </p>
                <p className="text-[11px] mb-4" style={{ color: "var(--text-muted)" }}>
                  Anyone with the link can view this doc when enabled.
                </p>

                <div
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 mb-3"
                  style={{ backgroundColor: "var(--bg-tertiary)" }}
                >
                  <div className="flex items-center gap-2">
                    {publicEnabled
                      ? <Globe size={13} className="text-emerald-400 shrink-0" />
                      : <Lock size={13} style={{ color: "var(--text-muted)" }} className="shrink-0" />
                    }
                    <div>
                      <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                        {publicEnabled ? "Anyone with the link" : "Private"}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {publicEnabled ? "Link sharing is on" : "Only you can access"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleTogglePublic}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${
                      publicEnabled ? 'bg-emerald-500' : 'bg-[#333]'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                      publicEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                <button
                  onClick={handleCopyLink}
                  disabled={!publicEnabled}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-[12px] font-medium transition-colors"
                  style={{
                    backgroundColor: publicEnabled ? "var(--bg-tertiary)" : "var(--bg-secondary)",
                    color: publicEnabled ? "var(--text-secondary)" : "var(--text-muted)",
                    cursor: publicEnabled ? "pointer" : "not-allowed",
                  }}
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
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"
                e.currentTarget.style.color = "var(--text-primary)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = "transparent"
                e.currentTarget.style.color = "var(--text-muted)"
              }}
            >
              <MoreHorizontal size={15} />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-9 z-50 rounded-lg shadow-xl w-[180px] py-1 overflow-hidden"
                style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              >
                <button
                  onClick={handleCopyDoc}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Copy size={12} style={{ color: "var(--text-muted)" }} />
                  Copy doc
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Download size={12} style={{ color: "var(--text-muted)" }} />
                  Export as Markdown
                </button>
                <button
                  onClick={openMoveModal}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <FolderInput size={12} style={{ color: "var(--text-muted)" }} />
                  Move doc
                </button>
                <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
                <button
                  onClick={() => { setMenuOpen(false); setShowDeleteModal(true) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-red-400 hover:text-red-300 transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Trash2 size={12} />
                  Delete doc
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {copyToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2 text-[12px] shadow-xl"
          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        >
          Copied to clipboard
        </div>
      )}

      {moveToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2 text-[12px] shadow-xl"
          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        >
          Doc moved
        </div>
      )}

      {showMoveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div
            className="rounded-2xl p-6 w-80 shadow-2xl"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          >
            <h2 className="font-semibold text-base mb-4" style={{ color: "var(--text-primary)" }}>
              Move to folder
            </h2>
            {folders.length === 0 ? (
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                No folders yet. Create a folder in the sidebar first.
              </p>
            ) : (
              <div className="flex flex-col gap-1 mb-4 max-h-48 overflow-y-auto">
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleMove(f.id)}
                    className="text-left px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{ color: "var(--text-secondary)" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    📁 {f.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setShowMoveModal(false)}
                className="px-4 py-2 text-sm transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setShowDeleteModal(false)} />
          <div
            className="relative rounded-xl shadow-2xl w-[320px] p-5 z-10"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          >
            <h2 className="text-[14px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Delete doc
            </h2>
            <p className="text-[12px] mb-5" style={{ color: "var(--text-muted)" }}>
              This doc will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowDeleteModal(false); onDelete?.() }}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-red-500/90 text-white hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
