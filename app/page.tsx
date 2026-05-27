"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, MoreHorizontal, Pencil, FolderInput, Trash2, LayoutTemplate, Star, Lock } from "lucide-react"
import Sidebar from "@/components/sidebar"
import TemplatePickerModal from "@/components/template-picker-modal"

interface Doc {
  id: string
  uuid: string
  title: string
  content: string
  type: string
  created_at: string
  is_starred: boolean
}

interface Folder {
  id: string
  name: string
}

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function stripHtml(html: string) {
  if (!html) return ""
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

const ACCENT_COLORS = [
  "#EF9F27", "#85B7EB", "#5DCAA5", "#F0997B",
  "#AFA9EC", "#97C459", "#ED93B1", "#B4B2A9", "#5DCAA5",
]

function getAccent(index: number) {
  return ACCENT_COLORS[index % ACCENT_COLORS.length]
}

type FilterTab = "recent" | "favorites" | "deleted"

export default function HomePage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarReady, setSidebarReady] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [limitModalOpen, setLimitModalOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") setCollapsed(true)
    setSidebarReady(true)
  }, [])

  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>("recent")
  const [hoveredPill, setHoveredPill] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState<string>("free")

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [renamingDoc, setRenamingDoc] = useState<Doc | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [movingDoc, setMovingDoc] = useState<Doc | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [deletingDoc, setDeletingDoc] = useState<Doc | null>(null)

  useEffect(() => {
    // Fetch docs
    fetch("/api/docs")
      .then((r) => r.json())
      .then((data) => {
        setDocs(Array.isArray(data) ? data.slice(0, 9) : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))

    // Fetch plan
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setUserPlan(data.user.plan || "free")
      })
      .catch(() => {})
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

  const handleNewDoc = async () => {
    const res = await fetch("/api/docs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "", content: "", color: "" }) })
    if (res.status === 403) {
      const data = await res.json()
      if (data.error === "free_limit_reached") {
        setLimitModalOpen(true)
        return
      }
    }
    setTemplateModalOpen(true)
  }

  const handleToggleFavorite = async (doc: Doc, e: React.MouseEvent) => {
    e.stopPropagation()
    const newValue = !doc.is_starred
    setDocs(prev => prev.map(d => d.uuid === doc.uuid ? { ...d, is_starred: newValue } : d))
    await fetch(`/api/docs/${doc.uuid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_starred: newValue }),
    })
  }

  const handleRename = async () => {
    if (!renamingDoc || !renameValue.trim()) return
    await fetch(`/api/docs/${renamingDoc.uuid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: renameValue.trim() }),
    })
    setDocs(prev => prev.map(d => d.uuid === renamingDoc.uuid ? { ...d, title: renameValue.trim() } : d))
    setRenamingDoc(null)
  }

  const handleMove = async (folderId: string) => {
    if (!movingDoc) return
    await fetch(`/api/docs/${movingDoc.uuid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId }),
    })
    setDocs(prev => prev.filter(d => d.uuid !== movingDoc.uuid))
    setMovingDoc(null)
  }

  const handleDelete = async () => {
    if (!deletingDoc) return
    await fetch(`/api/docs/${deletingDoc.uuid}`, { method: "DELETE" })
    setDocs(prev => prev.filter(d => d.uuid !== deletingDoc.uuid))
    setDeletingDoc(null)
  }

  const openMoveModal = async (doc: Doc) => {
    setMovingDoc(doc)
    setOpenMenuId(null)
    const res = await fetch("/api/folders")
    const data = await res.json()
    setFolders(Array.isArray(data) ? data : [])
  }

  const pills: { key: FilterTab; label: string; href?: string }[] = [
    { key: "recent", label: "Recent" },
    { key: "favorites", label: "Favorites" },
    { key: "deleted", label: "Deleted", href: "/trash" },
  ]

  const visibleDocs = activeTab === "favorites"
    ? docs.filter(d => d.is_starred)
    : docs

  const FREE_LIMIT = 30

  const btnBase: React.CSSProperties = {
    height: "36px",
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "0 16px",
    borderRadius: "8px",
    fontSize: "13.5px",
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "opacity 0.15s, background-color 0.15s, border-color 0.15s, color 0.15s",
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg)" }}>
      {sidebarReady && <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />}

      <main className="flex-1 overflow-y-auto transition-all duration-200">
        <div className="max-w-5xl mx-auto px-10 py-10">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-[32px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {activeTab === "favorites" ? "Favorites" : "Recent Docs"}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={() => setTemplateModalOpen(true)}
                style={{
                  ...btnBase,
                  backgroundColor: "transparent",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"
                  e.currentTarget.style.color = "var(--text-primary)"
                  e.currentTarget.style.borderColor = "var(--text-muted)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = "transparent"
                  e.currentTarget.style.color = "var(--text-muted)"
                  e.currentTarget.style.borderColor = "var(--border)"
                }}
              >
                <LayoutTemplate size={14} />
                Templates
              </button>
              <button
                onClick={handleNewDoc}
                style={{
                  ...btnBase,
                  backgroundColor: "var(--text-primary)",
                  color: "var(--bg)",
                  border: "1px solid transparent",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <Plus size={14} />
                New Doc
              </button>
            </div>
          </div>

          {/* Pills */}
          <div className="flex gap-2 mb-7">
            {pills.map(pill => {
              const isActive = activeTab === pill.key
              return (
                <button
                  key={pill.key}
                  onClick={() => pill.href ? router.push(pill.href) : setActiveTab(pill.key)}
                  onMouseEnter={() => setHoveredPill(pill.key)}
                  onMouseLeave={() => setHoveredPill(null)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: "99px",
                    fontSize: "13.5px",
                    fontWeight: isActive ? 500 : 400,
                    border: "1px solid",
                    borderColor: isActive ? "var(--text-primary)" : "var(--border)",
                    backgroundColor: isActive ? "var(--text-primary)" : "transparent",
                    color: isActive ? "var(--bg)" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {pill.label}
                </button>
              )
            })}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-3 gap-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-52 rounded-xl animate-pulse" style={{ backgroundColor: "var(--bg-tertiary)" }} />
              ))}
            </div>
          ) : visibleDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--text-muted)" }}>
              <p className="text-base font-medium mb-1">
                {activeTab === "favorites" ? "No favorites yet" : "No docs yet"}
              </p>
              <p className="text-sm">
                {activeTab === "favorites" ? "Star a doc to add it here" : "Click + New Doc to get started"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-5">
              {visibleDocs.map((doc, index) => {
                const isLocked = userPlan === "free" && index >= FREE_LIMIT
                return (
                  <div
                    key={doc.uuid}
                    className="relative group rounded-xl flex flex-col transition-colors overflow-hidden"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      border: `1px solid ${isLocked ? "rgba(255,255,255,0.04)" : "var(--border)"}`,
                      minHeight: "200px",
                      opacity: isLocked ? 0.5 : 1,
                    }}
                    onMouseEnter={e => {
                      if (!isLocked) {
                        e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"
                        e.currentTarget.style.borderColor = "var(--text-muted)"
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isLocked) {
                        e.currentTarget.style.backgroundColor = "var(--bg-secondary)"
                        e.currentTarget.style.borderColor = "var(--border)"
                      }
                    }}
                  >
                    <div style={{ height: "5px", backgroundColor: getAccent(index), width: "100%", flexShrink: 0 }} />

                    <button
                      onClick={() => isLocked ? setLimitModalOpen(true) : router.push(`/docs/${doc.uuid}`)}
                      className="text-left px-5 pt-4 pb-3 flex flex-col flex-1 w-full"
                      style={{ cursor: isLocked ? "default" : "pointer" }}
                    >
                      <p className="font-semibold text-[15px] leading-snug mb-3 pr-6" style={{ color: "var(--text-primary)" }}>
                        {doc.title || "Untitled"}
                      </p>
                      <p className="text-[13px] leading-relaxed line-clamp-3 flex-1" style={{ color: "var(--text-secondary)" }}>
                        {stripHtml(doc.content)}
                      </p>
                    </button>

                    <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{formatDate(doc.created_at)}</p>
                      {isLocked ? (
                        <Lock size={13} style={{ color: "var(--text-muted)" }} />
                      ) : (
                        <button
                          onClick={e => handleToggleFavorite(doc, e)}
                          title={doc.is_starred ? "Remove from favorites" : "Add to favorites"}
                          className="transition-opacity"
                          style={{
                            color: doc.is_starred ? "#EF9F27" : "var(--text-muted)",
                            opacity: doc.is_starred ? 1 : 0,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={e => (e.currentTarget.style.opacity = doc.is_starred ? "1" : "0")}
                        >
                          <Star size={13} fill={doc.is_starred ? "#EF9F27" : "none"} />
                        </button>
                      )}
                    </div>

                    {/* Three-dot menu — hidden for locked docs */}
                    {!isLocked && (
                      <div className="absolute top-7 right-4" ref={openMenuId === doc.uuid ? menuRef : null}>
                        <button
                          onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === doc.uuid ? null : doc.uuid) }}
                          className="w-7 h-7 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)" }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}
                        >
                          <MoreHorizontal size={15} />
                        </button>

                        {openMenuId === doc.uuid && (
                          <div
                            className="absolute right-0 top-8 w-44 rounded-xl shadow-xl z-50 overflow-hidden py-1"
                            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                          >
                            <button
                              onClick={e => { e.stopPropagation(); setRenamingDoc(doc); setRenameValue(doc.title || ""); setOpenMenuId(null) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                              style={{ color: "var(--text-secondary)" }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              <Pencil size={13} style={{ color: "var(--text-muted)" }} /> Rename
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); openMoveModal(doc) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                              style={{ color: "var(--text-secondary)" }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              <FolderInput size={13} style={{ color: "var(--text-muted)" }} /> Move
                            </button>
                            <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
                            <button
                              onClick={e => { e.stopPropagation(); setDeletingDoc(doc); setOpenMenuId(null) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <TemplatePickerModal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} />

      {/* Free limit modal */}
      {limitModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="rounded-2xl p-8 w-96 shadow-2xl" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div style={{ width: 40, height: 40, borderRadius: "10px", background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
              <Lock size={20} color="#fff" />
            </div>
            <h2 className="font-semibold text-lg mb-2" style={{ color: "var(--text-primary)" }}>This doc is locked</h2>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Free accounts can hold up to 30 active docs. Upgrade to Pro to unlock all your docs and get unlimited storage.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setLimitModalOpen(false); router.push("/settings") }}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-center"
                style={{ backgroundColor: "#534AB7", color: "#fff", border: "none", cursor: "pointer" }}
              >
                Upgrade to Pro
              </button>
              <button
                onClick={() => setLimitModalOpen(false)}
                className="w-full py-2.5 rounded-xl text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renamingDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-80 shadow-2xl" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <h2 className="font-semibold text-base mb-4" style={{ color: "var(--text-primary)" }}>Rename doc</h2>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenamingDoc(null) }}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-4"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRenamingDoc(null)} className="px-4 py-2 text-sm" style={{ color: "var(--text-muted)" }}>Cancel</button>
              <button onClick={handleRename} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Move modal */}
      {movingDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-80 shadow-2xl" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <h2 className="font-semibold text-base mb-4" style={{ color: "var(--text-primary)" }}>Move to folder</h2>
            {folders.length === 0 ? (
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>No folders yet. Create one in the sidebar first.</p>
            ) : (
              <div className="flex flex-col gap-1 mb-4 max-h-48 overflow-y-auto">
                {folders.map(folder => (
                  <button key={folder.id} onClick={() => handleMove(folder.id)} className="text-left px-3 py-2 rounded-lg text-sm" style={{ color: "var(--text-secondary)" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >📁 {folder.name}</button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setMovingDoc(null)} className="px-4 py-2 text-sm" style={{ color: "var(--text-muted)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deletingDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-80 shadow-2xl" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text-primary)" }}>Delete doc?</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>&ldquo;{deletingDoc.title || "Untitled"}&rdquo; will be deleted. This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeletingDoc(null)} className="px-4 py-2 text-sm" style={{ color: "var(--text-muted)" }}>Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
