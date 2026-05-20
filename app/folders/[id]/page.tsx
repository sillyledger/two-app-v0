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
  if (!priority) return <span className="flex items-center gap-1 text-[11px] text-[#444]"><Minus size={11} /> None</span>
  if (priority === "low") return <span className="flex items-center gap-1 text-[11px] text-[#888]"><SignalLow size={11} /> Low</span>
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
    <div className="flex h-screen bg-[#1a1a1a] overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Folder size={18} className="text-[#555]" />
              <h1 className="text-xl font-semibold text-[#e8e8e8]">
                {folder?.name ?? folderNameFromUrl}
              </h1>
              <span className="text-[12px] text-[#444]">{docs.length} docs</span>
            </div>
            <button
              onClick={handleCreateDoc}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/20 text-[#e8e8e8] text-sm font-medium hover:bg-white/10 transition-colors"
            >
              <Plus size={15} />
              {creating ? "Creating..." : "New Doc"}
            </button>
          </div>

          {/* Doc list */}
          {loading ? (
            <div className="space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-[#2a2a2a] animate-pulse" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#444]">
              <Folder size={36} className="mb-3 text-[#333]" />
              <p className="text-[15px] font-medium text-[#666] mb-1">No docs in this folder</p>
              <p className="text-[13px] text-[#444]">Click New Doc to get started</p>
            </div>
          ) : (
            <div>
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_120px_120px_100px_80px_36px] items-center px-3 py-2 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3a3a3a]">Name</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3a3a3a]">Created</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3a3a3a]">Last Edited</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3a3a3a]">Author</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3a3a3a]">Priority</span>
                <span />
              </div>

              {/* Rows */}
              {docs.map((doc) => (
                <div
                  key={doc.uuid}
                  onClick={() => router.push(`/docs/${doc.uuid}`)}
                  className="group grid grid-cols-[1fr_120px_120px_100px_80px_36px] items-center px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-[#222] mb-[1px]"
                >
                  {/* Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={13} className="text-[#444] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#e8e8e8] truncate leading-snug">
                        {doc.title || "Untitled"}
                      </p>
                      <p className="text-[11px] text-[#555] truncate leading-snug mt-0.5">
                        {stripHtml(doc.content).slice(0, 80) || "No content"}
                      </p>
                    </div>
                  </div>

                  {/* Created */}
                  <span className="text-[12px] text-[#555]">{formatDate(doc.created_at)}</span>

                  {/* Last Edited */}
                  <span className="text-[12px] text-[#555]">{formatDate(doc.updated_at)}</span>

                  {/* Author */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-4 h-4 rounded-full bg-[#2a2a2a] border border-white/10 flex items-center justify-center text-[9px] font-medium text-[#888] shrink-0">
                      {(doc.author_name || doc.author_email || "?")[0].toUpperCase()}
                    </div>
                    <span className="text-[12px] text-[#555] truncate">
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
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#2a2a2a] text-[#555] hover:text-[#e8e8e8] transition-all"
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {openMenuId === doc.uuid && (
                      <div className="absolute right-0 top-7 w-44 bg-[#2c2c2c] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                        <button
                          onClick={() => { setRenamingDoc(doc); setRenameValue(doc.title || ""); setOpenMenuId(null) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#e8e8e8] hover:bg-white/10 transition-colors"
                        >
                          <Pencil size={13} className="text-[#aaa]" /> Rename
                        </button>
                        <button
                          onClick={() => openMoveModal(doc)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#e8e8e8] hover:bg-white/10 transition-colors"
                        >
                          <FolderInput size={13} className="text-[#aaa]" /> Move
                        </button>
                        <div className="border-t border-white/10 my-1" />
                        <button
                          onClick={() => { setDeletingDoc(doc); setOpenMenuId(null) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-white/10 transition-colors"
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
          <div className="bg-[#2c2c2c] rounded-2xl p-6 w-80 border border-white/10 shadow-2xl">
            <h2 className="text-[#e8e8e8] font-semibold text-base mb-4">Rename doc</h2>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenamingDoc(null) }}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-[#e8e8e8] text-sm outline-none focus:border-white/30 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRenamingDoc(null)} className="px-4 py-2 text-sm text-[#aaa] hover:text-[#e8e8e8] transition-colors">Cancel</button>
              <button onClick={handleRename} className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 text-[#e8e8e8] rounded-lg transition-colors">Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Move modal */}
      {movingDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#2c2c2c] rounded-2xl p-6 w-80 border border-white/10 shadow-2xl">
            <h2 className="text-[#e8e8e8] font-semibold text-base mb-4">Move to folder</h2>
            {folders.length === 0 ? (
              <p className="text-sm text-[#777] mb-4">No folders yet.</p>
            ) : (
              <div className="flex flex-col gap-1 mb-4 max-h-48 overflow-y-auto">
                {folders.filter(f => f.id !== String(id)).map((f) => (
                  <button key={f.id} onClick={() => handleMove(f.id)} className="text-left px-3 py-2 rounded-lg text-sm text-[#e8e8e8] hover:bg-white/10 transition-colors">
                    📁 {f.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setMovingDoc(null)} className="px-4 py-2 text-sm text-[#aaa] hover:text-[#e8e8e8] transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deletingDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#2c2c2c] rounded-2xl p-6 w-80 border border-white/10 shadow-2xl">
            <h2 className="text-[#e8e8e8] font-semibold text-base mb-2">Delete doc?</h2>
            <p className="text-sm text-[#aaa] mb-6">&ldquo;{deletingDoc.title || "Untitled"}&rdquo; will be permanently deleted.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeletingDoc(null)} className="px-4 py-2 text-sm text-[#aaa] hover:text-[#e8e8e8] transition-colors">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
