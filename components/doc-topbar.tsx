"use client"

import Link from "next/link"
import { ChevronRight, Share2, MoreHorizontal, Copy, Download, Trash2, Globe, Lock } from "lucide-react"
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

export default function DocTopbar({ docTitle, folder, saveStatus, content = '', onDelete, docId, isPublic = false }: DocTopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [copyToast, setCopyToast] = useState(false)
  const [publicEnabled, setPublicEnabled] = useState(isPublic)
  const [linkCopied, setLinkCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const shareRef = useRef<HTMLDivElement>(null)

  // Keep publicEnabled in sync if parent re-renders with new isPublic value
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

  const crumbBase = "text-[#555] hover:text-[#aaa] transition-colors text-[12px] font-medium truncate"
  const crumbActive = "text-[#aaa] text-[12px] font-medium truncate max-w-[220px]"
  const sep = <ChevronRight size={11} className="text-[#444] shrink-0 mx-0.5" />

  return (
    <>
      <header className="fixed top-0 left-[210px] right-0 z-40 h-[44px] flex items-center px-4 bg-[#181818] border-b border-[#2a2a2a]">

        {/* Left — Breadcrumbs */}
        <div className="flex items-center gap-0.5 min-w-0 flex-1">
          <Link href="/" className={crumbBase}>Home</Link>
          {sep}
          {folder && (
            <>
              <span className={crumbBase}>{folder.name}</span>
              {sep}
            </>
          )}
          <span className={crumbActive}>{docTitle || "Untitled"}</span>
        </div>

        {/* Right — Save status + Share + ··· */}
        <div className="flex items-center gap-2 shrink-0 ml-4">

          {/* Autosave indicator */}
          <div className="flex items-center gap-1.5 h-5">
            {saveStatus === "saving" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/80 animate-pulse" />
                <span className="text-[11px] text-[#555]">Saving...</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                <span className="text-[11px] text-[#555]">Saved</span>
              </>
            )}
          </div>

          {/* Share button + popup */}
          <div className="relative" ref={shareRef}>
            <button
              onClick={() => setShareOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-[#888] hover:bg-[#2a2a2a] hover:text-[#e8e8e8] transition-colors"
            >
              <Share2 size={12} />
              Share
            </button>

            {shareOpen && (
              <div className="absolute right-0 top-[42px] z-50 bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl shadow-2xl w-[300px] p-4">

                {/* Header */}
                <p className="text-[13px] font-semibold text-[#e8e8e8] mb-1">Share this doc</p>
                <p className="text-[11px] text-[#555] mb-4">Anyone with the link can view this doc when enabled.</p>

                {/* Toggle row */}
                <div className="flex items-center justify-between bg-[#242424] rounded-lg px-3 py-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    {publicEnabled
                      ? <Globe size={13} className="text-emerald-400 shrink-0" />
                      : <Lock size={13} className="text-[#555] shrink-0" />
                    }
                    <div>
                      <p className="text-[12px] font-medium text-[#ccc]">
                        {publicEnabled ? "Anyone with the link" : "Private"}
                      </p>
                      <p className="text-[10px] text-[#555]">
                        {publicEnabled ? "Link sharing is on" : "Only you can access"}
                      </p>
                    </div>
                  </div>

                  {/* Toggle switch */}
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

                {/* Copy link button */}
                <button
                  onClick={handleCopyLink}
                  disabled={!publicEnabled}
                  className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg text-[12px] font-medium transition-colors ${
                    publicEnabled
                      ? 'bg-[#2a2a2a] text-[#ccc] hover:bg-[#333] hover:text-[#e8e8e8]'
                      : 'bg-[#222] text-[#444] cursor-not-allowed'
                  }`}
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
              className="flex items-center justify-center w-7 h-7 rounded-md text-[#555] hover:bg-[#2a2a2a] hover:text-[#e8e8e8] transition-colors"
            >
              <MoreHorizontal size={15} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-9 z-50 bg-[#242424] border border-[#333] rounded-lg shadow-xl w-[180px] py-1 overflow-hidden">

                <button
                  onClick={handleCopyDoc}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-[#ccc] hover:bg-[#2a2a2a] hover:text-[#e8e8e8] transition-colors"
                >
                  <Copy size={12} className="text-[#555]" />
                  Copy doc
                </button>

                <button
                  onClick={handleExportMarkdown}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-[#ccc] hover:bg-[#2a2a2a] hover:text-[#e8e8e8] transition-colors"
                >
                  <Download size={12} className="text-[#555]" />
                  Export as Markdown
                </button>

                <button
                  disabled
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-[#444] cursor-not-allowed"
                >
                  <MoreHorizontal size={12} className="text-[#333]" />
                  Move doc
                </button>

                <div className="my-1 border-t border-[#333]" />

                <button
                  onClick={() => {
                    setMenuOpen(false)
                    setShowDeleteModal(true)
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-red-400 hover:bg-[#2a2a2a] transition-colors"
                >
                  <Trash2 size={12} />
                  Delete doc
                </button>

              </div>
            )}
          </div>
        </div>
      </header>

      {/* Copy toast */}
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#2a2a2a] border border-[#333] rounded-lg px-4 py-2 text-[12px] text-[#e8e8e8] shadow-xl">
          Copied to clipboard
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative bg-[#242424] border border-[#333] rounded-xl shadow-2xl w-[320px] p-5 z-10">
            <h2 className="text-[14px] font-semibold text-[#e8e8e8] mb-1">Delete doc</h2>
            <p className="text-[12px] text-[#666] mb-5">
              This doc will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#888] hover:bg-[#2a2a2a] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  onDelete?.()
                }}
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
