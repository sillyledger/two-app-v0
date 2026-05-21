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
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <main className="flex-1 overflow-y-auto transition-all duration-200">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Recent Docs</h1>
            <button
              onClick={handleCreateDoc}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <Plus size={15} />
              {creating ? "Creating..." : "New Doc"}
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-44 rounded-2xl animate-pulse" style={{ backgroundColor: "var(--bg-tertiary)" }} />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--text-muted)" }}>
              <p className="text-lg font-medium mb-2">No docs yet</p>
              <p className="text-sm">Click + New Doc to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {docs.map((doc) => (
                <div
                  key={doc.uuid}
                  className="relative group rounded-2xl flex flex-col justify-between min-h-[172px] transition-colors"
                  style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--bg-secondary)")}
                >
                  <button
                    onClick={() => router.push(`/docs/${doc.uuid}`)}
                    className="text-left p-5 flex flex-col justify-between w-full h-full min-h-[172px]"
                  >
                    <div>
                      <p className="font-semibold text-[15px] leading-snug mb-2 pr-6" style={{ color: "var(--text-primary)" }}>
                        {doc.title || "Untitled"}
                      </p>
                      <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--text-muted)" }}>
                        {stripHtml(doc.content)}
                      </p>
                    </div>
                    <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
                      {formatDate(doc.created_at)}
                    </p>
                  </button>

                  <div className="absolute top-3 right-3" ref={openMenuId === doc.uuid ? menuRef : null}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuId(openMenuId === doc.uuid ? null : doc.uuid)
                      }}
                      className="w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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

                    {openMenuId === doc.uuid && (
                      <div
                        className="absolute right-0 top-8 w-44 rounded-xl shadow-xl z-50 overflow-hidden py-1"
                        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setRenamingDoc(doc)
                            setRenameValue(doc.title || "")
                            setOpenMenuId(null)
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                          style={{ color: "var(--text-secondary)" }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <Pencil size={14} style={{ color: "var(--text-muted)" }} />
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openMoveModal(doc)
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                          style={{ color: "var(--text-secondary)" }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <FolderInput size={14} style={{ color: "var(--text-muted)" }} />
                          Move
                        </button>
                        <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletingDoc(doc)
                            setOpenMenuId(null)
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
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
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
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
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>No folders yet. Create a folder in the sidebar first.</p>
            ) : (
              <div className="flex flex-col gap-1 mb-4 max-h-48 overflow-y-auto">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleMove(folder.id)}
                    className="text-left px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{ color: "var(--text-secondary)" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    📁 {folder.name}
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
              &ldquo;{deletingDoc.title || "Untitled"}&rdquo; will be deleted. This cannot be undone.
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
