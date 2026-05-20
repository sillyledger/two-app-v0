"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, MoreHorizontal, Pencil, FolderInput, Trash2 } from "lucide-react"
import Sidebar from "@/components/sidebar"

interface Doc {
  id: string
  uuid: string
  title: string
  content: string
  type: string
  created_at: string
}

interface Folder {
  id: string
  name: string
}

const CARD_COLORS = [
  "#2a2520",
  "#2a1f1f",
  "#1a2a1f",
  "#1f1a2a",
  "#2a2a1a",
  "#1a2228",
]

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function stripHtml(html: string) {
  if (!html) return ""
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

export default function HomePage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

useEffect(() => {
  const saved = localStorage.getItem("sidebar-collapsed")
  if (saved === "true") setCollapsed(true)
}, [])
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [renamingDoc, setRenamingDoc] = useState<Doc | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const [movingDoc, setMovingDoc] = useState<Doc | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])

  const [deletingDoc, setDeletingDoc] = useState<Doc | null>(null)

  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((data) => {
        setDocs(Array.isArray(data) ? data.slice(0, 9) : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
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

  const handleCreateDoc = async () => {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled", content: "", color: "yellow", type: "doc" }),
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
    setDocs((prev) =>
      prev.map((d) => (d.uuid === renamingDoc.uuid ? { ...d, title: renameValue.trim() } : d))
    )
    setRenamingDoc(null)
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

  const openMoveModal = async (doc: Doc) => {
    setMovingDoc(doc)
    setOpenMenuId(null)
    const res = await fetch("/api/folders")
    const data = await res.json()
    setFolders(Array.isArray(data) ? data : [])
  }

  return (
    <div className="flex h-screen bg-[#1a1a1a] overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <main className="flex-1 overflow-y-auto transition-all duration-200">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-[#e8e8e8]">Recent Docs</h1>
            <button
              onClick={handleCreateDoc}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/20 text-[#e8e8e8] text-sm font-medium hover:bg-white/10 transition-colors"
            >
              <Plus size={15} />
              {creating ? "Creating..." : "New Doc"}
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-44 rounded-2xl bg-[#2a2a2a] animate-pulse" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#666]">
              <p className="text-lg font-medium mb-2">No docs yet</p>
              <p className="text-sm">Click + New Doc to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {docs.map((doc, i) => (
                <div
                  key={doc.uuid}
                  className="relative group rounded-2xl flex flex-col justify-between min-h-[172px]"
                  style={{ backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }}
                >
                  <button
                    onClick={() => router.push(`/docs/${doc.uuid}`)}
                    className="text-left p-5 flex flex-col justify-between w-full h-full min-h-[172px]"
                  >
                    <div>
                      <p className="font-semibold text-[#e8e8e8] text-[15px] leading-snug mb-2 pr-6">
                        {doc.title || "Untitled"}
                      </p>
                      <p className="text-xs text-[#aaa] leading-relaxed line-clamp-3">
                        {stripHtml(doc.content)}
                      </p>
                    </div>
                    <p className="text-xs text-[#777] mt-4">
                      {formatDate(doc.created_at)}
                    </p>
                  </button>

                  <div className="absolute top-3 right-3" ref={openMenuId === doc.uuid ? menuRef : null}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuId(openMenuId === doc.uuid ? null : doc.uuid)
                      }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[#aaa] hover:text-[#e8e8e8] hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal size={15} />
                    </button>

                    {openMenuId === doc.uuid && (
                      <div className="absolute right-0 top-8 w-44 bg-[#2c2c2c] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setRenamingDoc(doc)
                            setRenameValue(doc.title || "")
                            setOpenMenuId(null)
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#e8e8e8] hover:bg-white/10 transition-colors"
                        >
                          <Pencil size={14} className="text-[#aaa]" />
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openMoveModal(doc)
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#e8e8e8] hover:bg-white/10 transition-colors"
                        >
                          <FolderInput size={14} className="text-[#aaa]" />
                          Move
                        </button>
                        <div className="border-t border-white/10 my-1" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletingDoc(doc)
                            setOpenMenuId(null)
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-white/10 transition-colors"
                        >
                          <Trash2 size={14} />
                          Delete
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
              <p className="text-sm text-[#777] mb-4">No folders yet. Create a folder in the sidebar first.</p>
            ) : (
              <div className="flex flex-col gap-1 mb-4 max-h-48 overflow-y-auto">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleMove(folder.id)}
                    className="text-left px-3 py-2 rounded-lg text-sm text-[#e8e8e8] hover:bg-white/10 transition-colors"
                  >
                    📁 {folder.name}
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
            <p className="text-sm text-[#aaa] mb-6">
              &ldquo;{deletingDoc.title || "Untitled"}&rdquo; will be deleted. This cannot be undone.
            </p>
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
