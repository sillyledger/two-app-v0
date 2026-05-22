"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation"
import { Plus, FileText, MoreHorizontal, Folder, Minus, SignalLow, SignalMedium, SignalHigh, Pencil, FolderInput, Trash2 } from "lucide-react"
import Sidebar from "@/components/sidebar"

interface Doc {
  id: string
  uuid: string
  title: string
  content: string
  created_at: string
  updated_at: string
  priority?: string | null
  author_name?: string
  author_email?: string
}

interface FolderType {
  id: string
  name: string
}

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function stripHtml(html: string) {
  if (!html) return ""
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function PriorityBadge({ priority }: { priority?: string | null }) {
  if (!priority) return <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}><Minus size={11} /> None</span>
  if (priority === "low") return <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-secondary)" }}><SignalLow size={11} /> Low</span>
  if (priority === "medium") return <span className="flex items-center gap-1 text-[11px] text-[#f5a623]"><SignalMedium size={11} /> Medium</span>
  if (priority === "high") return <span className="flex items-center gap-1 text-[11px] text-[#e05252]"><SignalHigh size={11} /> High</span>
  return null
}

export default function FolderPage() {
  const { id } = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const folderNameFromUrl = searchParams.get('name') ?? '...'
  const [folder, setFolder] = useState<FolderType | null>(null)
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") setCollapsed(true)
  }, [])

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [renamingDoc, setRenamingDoc] = useState<Doc | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const [movingDoc, setMovingDoc] = useState<Doc | null>(null)
  const [folders, setFolders] = useState<FolderType[]>([])

  const [deletingDoc, setDeletingDoc] = useState<Doc | null>(null)

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (!res.ok) router.push("/login")
    })
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    if (openMenuId) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [openMenuId])

  useEffect(() => {
    if (!id) return
    setLoading(true)

    fetch(`/api/folders/${id}`)
      .then((r) => r.json())
      .then((data: FolderType) => { if (data?.name) setFolder(data) })
      .catch(() => {})

    fetch(`/api/docs?folder_id=${id}`)
      .then((r) => r.json())
      .then((data: Doc[]) => {
        setDocs(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id, pathname])

  const handleCreateDoc = async () => {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled", content: "", color: "yellow", type: "doc", folder_id: id }),
      })
      const doc = await res.json()
      router.push(`/docs/${doc.uuid}`)
    } catch {
      setCreating(false)
    }
  }

  const handleRename = async () => {
    if (!renamingDoc || !renameValue.trim()) return
    await fetch(`/api/docs/${renamingDoc.uuid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: renameValue.trim() }),
    })
    setDocs((prev) => prev.map((d) => d.uuid === renamingDoc.uuid ? { ...d, title: renameValue.trim() } : d))
    setRenamingDoc(null)
  }

  const openMoveModal = async (doc: Doc) => {
    setMovingDoc(doc)
    setOpenMenuId(null)
    const res = await fetch("/api/folders")
    const data = await res.json()
    setFolders(Array.isArray(data) ? data : [])
  }

  const handleMove = async (folderId: string) => {
    if (!movingDoc) return
    await fetch(`/api/docs/${movingDoc.uuid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId }),
    })
    setDocs((prev) => prev.filter((d) => d.uuid !== movingDoc.uuid))
    setMovingDoc(null)
  }

  const handleDelete = async () => {
    if (!deletingDoc) return
    await fetch(`/api/docs/${deletingDoc.uuid}`, { method: "DELETE" })
    setDocs((prev) => prev.filter((d) => d.uuid !== deletingDoc.uuid))
    setDeletingDoc(null)
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Folder size={18} style={{ color: "var(--text-muted)" }} />
              <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                {folder?.name ?? folderNameFromUrl}
              </h1>
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{docs.length} docs</span>
            </div>
            <button
  onClick={handleCreateDoc}
  disabled={creating}
  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
  style={{
    backgroundColor: "var(--text-primary)",
    border: "1px solid var(--border)",
    color: "var(--bg)",
  }}
  onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
>
  <Plus size={15} />
  {creating ? "Creating..." : "New Doc"}
</button>
          </div>

          {/* Doc list */}
          {loading ? (
            <div className="space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: "var(--bg-tertiary)" }} />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--text-muted)" }}>
              <Folder size={36} className="mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-[15px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>No docs in this folder</p>
              <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Click New Doc to get started</p>
            </div>
          ) : (
            <div>
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_120px_120px_100px_80px_36px] items-center px-3 py-2 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Name</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Created</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Last Edited</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Author</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Priority</span>
                <span />
              </div>

              {/* Rows */}
              {docs.map((doc) => (
                <div
                  key={doc.uuid}
                  onClick={() => router.push(`/docs/${doc.uuid}`)}
                  className="group grid grid-cols-[1fr_120px_120px_100px_80px_36px] items-center px-3 py-2.5 rounded-lg cursor-pointer transition-colors mb-[1px]"
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-secondary)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  {/* Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={13} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium truncate leading-snug" style={{ color: "var(--text-primary)" }}>
                        {doc.title || "Untitled"}
                      </p>
                      <p className="text-[11px] truncate leading-snug mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {stripHtml(doc.content).slice(0, 80) || "No content"}
                      </p>
                    </div>
                  </div>

                  {/* Created */}
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{formatDate(doc.created_at)}</span>

                  {/* Last Edited */}
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{formatDate(doc.updated_at)}</span>

                  {/* Author */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-medium shrink-0"
                      style={{
                        backgroundColor: "var(--bg-tertiary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {(doc.author_name || doc.author_email || "?")[0].toUpperCase()}
                    </div>
                    <span className="text-[12px] truncate" style={{ color: "var(--text-muted)" }}>
                      {doc.author_name || doc.author_email?.split("@")[0] || "—"}
                    </span>
                  </div>

                  {/* Priority */}
                  <PriorityBadge priority={doc.priority} />

                  {/* Three-dot menu */}
                  <div
                    className="relative"
                    ref={openMenuId === doc.uuid ? menuRef : null}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setOpenMenuId(openMenuId === doc.uuid ? null : doc.uuid)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
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
                      <MoreHorizontal size={14} />
                    </button>

                    {openMenuId === doc.uuid && (
                      <div
                        className="absolute right-0 top-7 w-44 rounded-xl shadow-xl z-50 overflow-hidden py-1"
                        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                      >
                        <button
                          onClick={() => { setRenamingDoc(doc); setRenameValue(doc.title || ""); setOpenMenuId(null) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                          style={{ color: "var(--text-secondary)" }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <Pencil size={13} style={{ color: "var(--text-muted)" }} /> Rename
                        </button>
                        <button
                          onClick={() => openMoveModal(doc)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                          style={{ color: "var(--text-secondary)" }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <FolderInput size={13} style={{ color: "var(--text-muted)" }} /> Move
                        </button>
                        <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
                        <button
                          onClick={() => { setDeletingDoc(doc); setOpenMenuId(null) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Rename modal */}
      {renamingDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div
            className="rounded-2xl p-6 w-80 shadow-2xl"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          >
            <h2 className="font-semibold text-base mb-4" style={{ color: "var(--text-primary)" }}>Rename doc</h2>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenamingDoc(null) }}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-4"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRenamingDoc(null)}
                className="px-4 py-2 text-sm transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-4 py-2 text-sm rounded-lg transition-colors"
                style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--border)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move modal */}
      {movingDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div
            className="rounded-2xl p-6 w-80 shadow-2xl"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          >
            <h2 className="font-semibold text-base mb-4" style={{ color: "var(--text-primary)" }}>Move to folder</h2>
            {folders.length === 0 ? (
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>No folders yet.</p>
            ) : (
              <div className="flex flex-col gap-1 mb-4 max-h-48 overflow-y-auto">
                {folders.filter(f => f.id !== String(id)).map((f) => (
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
                onClick={() => setMovingDoc(null)}
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

      {/* Delete modal */}
      {deletingDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div
            className="rounded-2xl p-6 w-80 shadow-2xl"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          >
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text-primary)" }}>Delete doc?</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              &ldquo;{deletingDoc.title || "Untitled"}&rdquo; will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeletingDoc(null)}
                className="px-4 py-2 text-sm transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm rounded-lg transition-colors bg-red-500/20 hover:bg-red-500/30 text-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
