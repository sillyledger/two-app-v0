"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, MoreHorizontal, Pencil, FolderInput, Trash2, LayoutTemplate, Star, Lock, Search, LayoutGrid, List, ChevronRight, Users } from "lucide-react"
import Link from "next/link"
import Sidebar from "@/components/sidebar"
import TemplatePickerModal from "@/components/template-picker-modal"
import { useTabStore } from "@/hooks/use-tab-store"

interface Doc {
  id: string
  uuid: string
  title: string
  content: string
  type: string
  created_at: string
  is_starred: boolean
  folder_id?: string | null
  folder_name?: string | null
  is_workspace_shared?: boolean
}

interface Folder {
  id: string
  name: string
}

interface PinnedFolder {
  id: string
  name: string
  doc_count: number | string
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

function folderDotColor(folderId: string | null) {
  if (!folderId) return null
  let hash = 0
  for (let i = 0; i < folderId.length; i++) hash = (hash * 31 + folderId.charCodeAt(i)) >>> 0
  return ACCENT_COLORS[hash % ACCENT_COLORS.length]
}

function FolderIcon({ color, size = 54 }: { color: string; size?: number }) {
  const rectWidth = size * (50 / 54)
  const rectHeight = size * (36 / 54)
  const backTop = size * (4 / 54)
  const frontTop = size * (11 / 54)
  return (
    <div style={{ position: "relative", height: size, width: size, flexShrink: 0 }}>
      <div style={{ position: "absolute", left: 0, top: backTop, width: rectWidth, height: rectHeight, borderRadius: "7px", backgroundColor: color, opacity: 0.35 }} />
      <div style={{ position: "absolute", left: 0, top: frontTop, width: rectWidth, height: rectHeight, borderRadius: "7px", backgroundColor: color }} />
    </div>
  )
}

type FilterTab = "recent" | "favorites" | "deleted"
type ViewMode = "grid" | "list"

export default function HomePage() {
  const router = useRouter()
  const { openTab } = useTabStore()
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarReady, setSidebarReady] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [limitModalOpen, setLimitModalOpen] = useState(false)
  const [view, setView] = useState<ViewMode>("grid")

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") setCollapsed(true)
    const savedView = localStorage.getItem("docs-view")
    if (savedView === "grid" || savedView === "list") setView(savedView)
    setSidebarReady(true)
  }, [])

  useEffect(() => {
    localStorage.setItem("docs-view", view)
  }, [view])

  const [allDocs, setAllDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>("recent")
  const [hoveredPill, setHoveredPill] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState<string>("free")
  const [searchQuery, setSearchQuery] = useState("")

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [renamingDoc, setRenamingDoc] = useState<Doc | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [movingDoc, setMovingDoc] = useState<Doc | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [deletingDoc, setDeletingDoc] = useState<Doc | null>(null)
  const [pinnedFolders, setPinnedFolders] = useState<PinnedFolder[]>([])

  useEffect(() => {
    fetch("/api/folders")
      .then(res => res.json())
      .then(data => setPinnedFolders(Array.isArray(data) ? data.filter((f: any) => f.pinned) : []))
      .catch(() => setPinnedFolders([]))
  }, [])

  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((data) => {
        setAllDocs(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))

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
    setAllDocs(prev => prev.map(d => d.uuid === doc.uuid ? { ...d, is_starred: newValue } : d))
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
    setAllDocs(prev => prev.map(d => d.uuid === renamingDoc.uuid ? { ...d, title: renameValue.trim() } : d))
    setRenamingDoc(null)
  }

  const handleMove = async (folderId: string) => {
    if (!movingDoc) return
    await fetch(`/api/docs/${movingDoc.uuid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId }),
    })
    setAllDocs(prev => prev.filter(d => d.uuid !== movingDoc.uuid))
    setMovingDoc(null)
  }

  const handleDelete = async () => {
    if (!deletingDoc) return
    await fetch(`/api/docs/${deletingDoc.uuid}`, { method: "DELETE" })
    setAllDocs(prev => prev.filter(d => d.uuid !== deletingDoc.uuid))
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

  const trimmedQuery = searchQuery.trim().toLowerCase()

  const visibleDocs = trimmedQuery
    ? allDocs.filter(d =>
        (d.title || "").toLowerCase().includes(trimmedQuery) ||
        stripHtml(d.content).toLowerCase().includes(trimmedQuery)
      )
    : activeTab === "favorites"
      ? allDocs.filter(d => d.is_starred)
      : allDocs.slice(0, 9)

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
        <div className="max-w-[1180px] mx-auto px-10 py-10">

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

          {/* Search */}
          <div className="relative mb-5">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search docs..."
              className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none placeholder-[var(--text-muted)]"
              style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          {/* Folders preview */}
          <div className="mb-7">
            <div className="flex items-center mb-3">
              <Link
                href="/folders"
                className="flex items-center gap-1 text-[13px] transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                All folders
                <ChevronRight size={14} />
              </Link>
            </div>

            {pinnedFolders.length > 0 && (
              <div className="grid grid-cols-6 gap-4">
                {pinnedFolders.map((folder, index) => {
                  const docCount = Number(folder.doc_count) || 0
                  return (
                    <div
                      key={folder.id}
                      className="flex flex-col items-center text-center cursor-pointer group"
                      onClick={() => router.push(`/folders/${folder.id}?name=${encodeURIComponent(folder.name)}`)}
                    >
                      <div className="mb-2 transition-transform group-hover:scale-105">
                        <FolderIcon color={getAccent(index)} size={48} />
                      </div>
                      <p className="font-medium text-[13px] truncate w-full" style={{ color: "var(--text-primary)" }}>{folder.name}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{docCount} {docCount === 1 ? "doc" : "docs"}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pills */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex gap-2">
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

            <div className="flex gap-1">
              <button
                onClick={() => setView("grid")}
                title="Grid view"
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px",
                  border: "1px solid " + (view === "grid" ? "var(--text-primary)" : "var(--border)"),
                  backgroundColor: view === "grid" ? "var(--bg-tertiary)" : "transparent",
                  color: view === "grid" ? "var(--text-primary)" : "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setView("list")}
                title="List view"
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px",
                  border: "1px solid " + (view === "list" ? "var(--text-primary)" : "var(--border)"),
                  backgroundColor: view === "list" ? "var(--bg-tertiary)" : "transparent",
                  color: view === "list" ? "var(--text-primary)" : "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <List size={15} />
              </button>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-4 gap-4">
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
            <>
              {view === "list" && (
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 20px 8px", fontSize: 11, color: "var(--text-muted)" }}>
                  <div style={{ width: 28 }} />
                  <span style={{ flex: 1 }}>Name</span>
                  <span style={{ width: 130 }}>Folder</span>
                  <span>Edited</span>
                </div>
              )}

              <div className={view === "grid" ? "grid grid-cols-4 gap-4" : "flex flex-col gap-2"}>
              {visibleDocs.map((doc, index) => {
                const isLocked = userPlan === "free" && index >= FREE_LIMIT
                const isMenuOpen = openMenuId === doc.uuid

                const handleOpenDoc = () => {
                  if (isLocked) {
                    setLimitModalOpen(true)
                  } else {
                    openTab(doc.uuid, doc.title || "Untitled")
                    router.push(`/docs/${doc.uuid}`)
                  }
                }

                const favoriteButton = isLocked ? (
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
                )

                const menuButton = (
                  <button
                    onClick={e => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : doc.uuid) }}
                    className="w-7 h-7 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)" }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                )

                const menuDropdown = isMenuOpen && (
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
                )

                if (view === "list") {
                  return (
                    <div
                      key={doc.uuid}
                      className="relative group flex items-stretch transition-colors overflow-hidden"
                      style={{
                        borderBottom: "1px solid var(--border)",
                        opacity: isLocked ? 0.5 : 1,
                      }}
                      onMouseEnter={e => {
                        if (!isLocked) {
                          e.currentTarget.style.backgroundColor = "var(--bg-secondary)"
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isLocked) {
                          e.currentTarget.style.backgroundColor = "transparent"
                        }
                      }}
                    >
                      <button
                        onClick={handleOpenDoc}
                        className="text-left flex items-center gap-4 flex-1 min-w-0 px-5 py-3.5"
                        style={{ cursor: isLocked ? "default" : "pointer" }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#3a393f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4d2c8" strokeWidth="2" strokeLinecap="round">
                            <rect x="4" y="2.5" width="16" height="19" rx="3" />
                            <line x1="8" y1="8" x2="16" y2="8" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                            <line x1="8" y1="16" x2="12.5" y2="16" />
                          </svg>
                        </div>
                        <p className="font-semibold text-[15px] leading-snug flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
                          {doc.title || "Untitled"}
                        </p>
                        {doc.is_workspace_shared && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#e0b48c", backgroundColor: "#e0b48c1a", borderRadius: 20, padding: "2px 8px", flexShrink: 0 }}>
                            <Users size={10} />
                            Shared
                          </span>
                        )}
                        <div style={{ width: 130, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>
                          {doc.folder_name ? (<><span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: folderDotColor(doc.folder_id ?? null) ?? undefined, flexShrink: 0 }} />{doc.folder_name}</>) : <span>—</span>}
                        </div>
                        <p className="text-[12px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>{formatDate(doc.created_at)}</p>
                      </button>

                      <div className="flex items-center gap-1 pr-4 flex-shrink-0">
                        {favoriteButton}
                        {!isLocked && (
                          <div className="relative" ref={isMenuOpen ? menuRef : null}>
                            {menuButton}
                            {menuDropdown}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }

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
                    <div style={{ height: "5px", backgroundColor: "#4a4948", width: "100%", flexShrink: 0 }} />

                    <button
                      onClick={handleOpenDoc}
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
                      {favoriteButton}
                    </div>

                    {!isLocked && (
                      <div className="absolute top-7 right-4" ref={isMenuOpen ? menuRef : null}>
                        {menuButton}
                        {menuDropdown}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            </>
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
