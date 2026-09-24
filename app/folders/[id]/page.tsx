"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation"
import { Plus, MoreVertical, Pencil, FolderInput, Trash2, Star, LayoutGrid, List, Users, Folder, ChevronRight } from "lucide-react"
import Sidebar from "@/components/sidebar"
import { formatDate as formatDateI18n, getUserDatePrefs } from "@/lib/format-date"
import { getDescendantIds } from "@/lib/folder-tree"
import MoveToFolderModal from "@/components/move-to-folder-modal"

interface Doc {
  id: string
  uuid: string
  title: string
  content: string
  created_at: string
  is_starred: boolean
  is_workspace_shared?: boolean
}

interface FolderType {
  id: string
  name: string
  parent_id?: string | null
  workspace_id?: string | null
  path?: { id: string; name: string }[]
  pinned?: boolean
  doc_count?: number | string
  [key: string]: unknown
}

interface FolderData {
  id: string
  name: string
  doc_count: number | string
  last_edited: string | null
  workspace_id?: string | null
  parent_id?: string | null
  pinned?: boolean
  [key: string]: unknown
}

const ACCENT_COLORS = [
  "#EF9F27", "#85B7EB", "#5DCAA5", "#F0997B",
  "#AFA9EC", "#97C459", "#ED93B1", "#B4B2A9", "#5DCAA5",
]

function getAccent(index: number) {
  return ACCENT_COLORS[index % ACCENT_COLORS.length]
}

let hasMountedOnClient = false

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ""
  const { timezone, dateFormat } = hasMountedOnClient
    ? getUserDatePrefs()
    : { timezone: "UTC+0", dateFormat: "MMM D, YYYY" }
  return formatDateI18n(date, dateFormat, timezone)
}

function stripHtml(html: string) {
  if (!html) return ""
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

type ViewMode = "grid" | "list"

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
  const [view, setView] = useState<ViewMode>("grid")

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") setCollapsed(true)
  }, [])

  useEffect(() => { hasMountedOnClient = true }, [])

  useEffect(() => {
    const savedView = localStorage.getItem("folder-docs-view")
    if (savedView === "grid" || savedView === "list") setView(savedView)
  }, [])

  useEffect(() => {
    localStorage.setItem("folder-docs-view", view)
  }, [view])

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [renamingDoc, setRenamingDoc] = useState<Doc | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const [movingDoc, setMovingDoc] = useState<Doc | null>(null)
  const [folders, setFolders] = useState<FolderType[]>([])

  const [deletingDoc, setDeletingDoc] = useState<Doc | null>(null)

  const [subfolders, setSubfolders] = useState<FolderData[]>([])
  const [newSubfolderModalOpen, setNewSubfolderModalOpen] = useState(false)
  const [newSubfolderName, setNewSubfolderName] = useState("")
  const [myWorkspaceId, setMyWorkspaceId] = useState<string | null>(null)

  const [movingSubfolder, setMovingSubfolder] = useState<FolderData | null>(null)
  const [moveCandidates, setMoveCandidates] = useState<FolderData[]>([])

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (!res.ok) router.push("/login")
    })
  }, [])

  useEffect(() => {
    fetch("/api/workspace")
      .then(r => r.json())
      .then(data => setMyWorkspaceId(data?.id ?? null))
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

  useEffect(() => {
    if (!id) return
    setLoading(true)

    fetch(`/api/folders/${id}`)
      .then((r) => r.json())
      .then((data: FolderType) => {
        if (data?.name) {
          setFolder(data)
          const subfolderUrl = data.workspace_id
            ? `/api/folders?workspace_id=${data.workspace_id}&parent_id=${id}`
            : `/api/folders?parent_id=${id}`
          fetch(subfolderUrl)
            .then((r) => r.json())
            .then((subData: FolderData[]) => setSubfolders(Array.isArray(subData) ? subData : []))
            .catch(() => {})
        }
      })
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

  const handleToggleFavorite = async (doc: Doc, e: React.MouseEvent) => {
    e.stopPropagation()
    const newValue = !doc.is_starred
    const res = await fetch(`/api/docs/${doc.uuid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_starred: newValue }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Failed to update favorite.")
      return
    }
    setDocs(prev => prev.map(d => d.uuid === doc.uuid ? { ...d, is_starred: newValue } : d))
  }

  const handleRename = async () => {
    if (!renamingDoc || !renameValue.trim()) return
    const res = await fetch(`/api/docs/${renamingDoc.uuid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: renameValue.trim() }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Failed to rename doc.")
      setRenamingDoc(null)
      return
    }
    setDocs((prev) => prev.map((d) => d.uuid === renamingDoc.uuid ? { ...d, title: renameValue.trim() } : d))
    setRenamingDoc(null)
  }

  const openMoveModal = async (doc: Doc) => {
    setMovingDoc(doc)
    setOpenMenuId(null)
    const res = await fetch("/api/folders?all=true")
    const data = await res.json()
    setFolders(Array.isArray(data) ? data : [])
  }

  const handleMove = async (folderId: string) => {
    if (!movingDoc) return
    const res = await fetch(`/api/docs/${movingDoc.uuid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Failed to move doc.")
      return
    }
    setDocs((prev) => prev.filter((d) => d.uuid !== movingDoc.uuid))
    setMovingDoc(null)
  }

  const handleDelete = async () => {
    if (!deletingDoc) return
    const res = await fetch(`/api/docs/${deletingDoc.uuid}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Failed to delete doc.")
      setDeletingDoc(null)
      return
    }
    setDocs((prev) => prev.filter((d) => d.uuid !== deletingDoc.uuid))
    setDeletingDoc(null)
  }

  const handleCreateSubfolder = async () => {
    if (!newSubfolderName.trim() || !folder?.workspace_id) return
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSubfolderName.trim(), workspace_id: folder.workspace_id, parent_id: id }),
    })
    if (res.ok) {
      const created = await res.json()
      setSubfolders(prev => [...prev, { ...created, doc_count: 0, last_edited: null }])
    }
    setNewSubfolderModalOpen(false)
    setNewSubfolderName("")
  }

  const handleDeleteSubfolder = async (sub: FolderData, e: React.MouseEvent) => {
    e.stopPropagation()
    const confirmed = window.confirm(`Delete "${sub.name}"?\n\nAll docs inside will be moved to Trash and can be recovered within 30 days.`)
    if (!confirmed) return
    try {
      const res = await fetch(`/api/folders/${sub.id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Failed to delete folder.")
        return
      }
      setSubfolders(prev => prev.filter(f => f.id !== sub.id))
    } catch {
      alert("Failed to delete folder.")
    }
  }

  const handleOpenMoveSubfolder = async (sub: FolderData, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenuId(null)
    setMovingSubfolder(sub)
    try {
      const res = await fetch("/api/folders?all=true")
      const data = await res.json()
      const allFolders: FolderData[] = Array.isArray(data) ? data : []
      const descendantIds = getDescendantIds(allFolders, sub.id)
      setMoveCandidates(
        allFolders.filter(f => f.workspace_id === folder?.workspace_id && f.id !== sub.id && !descendantIds.has(f.id))
      )
    } catch {
      setMoveCandidates([])
    }
  }

  const handleMoveToTopLevel = async (sub: FolderData, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenMenuId(null)
    try {
      const res = await fetch(`/api/folders/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_id: null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Failed to move folder.")
        return
      }
      setSubfolders(prev => prev.filter(f => f.id !== sub.id))
    } catch {
      alert("Failed to move folder.")
    }
  }

  const handleMoveSubfolder = async (newParentId: string) => {
    if (!movingSubfolder) return
    const res = await fetch(`/api/folders/${movingSubfolder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id: newParentId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Failed to move folder.")
      return
    }
    setSubfolders(prev => prev.filter(f => f.id !== movingSubfolder.id))
    setMovingSubfolder(null)
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--panel)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1180px] mx-auto px-10 py-10">

          {/* Breadcrumb */}
          {folder?.path && folder.path.length > 0 && (
            <div className="flex items-center flex-wrap gap-1 mb-3 text-[12px]" style={{ color: "var(--text-3)" }}>
              <button onClick={() => {
                const isSharedContext = folder?.workspace_id && folder.workspace_id !== myWorkspaceId
                router.push(isSharedContext ? `/workspaces/${folder!.workspace_id}` : "/folders")
              }} className="transition-colors" style={{ color: "var(--text-3)" }} onMouseEnter={e => (e.currentTarget.style.color = "var(--text-1)")} onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}>
                Folders
              </button>
              {folder.path.map((crumb, i) => {
                const isLast = i === folder.path!.length - 1
                return (
                  <span key={crumb.id} className="flex items-center gap-1">
                    <ChevronRight size={12} />
                    {isLast ? (
                      <span className="font-semibold" style={{ color: "var(--text-1)" }}>{crumb.name}</span>
                    ) : (
                      <button onClick={() => router.push(`/folders/${crumb.id}?name=${encodeURIComponent(crumb.name)}`)} className="transition-colors" style={{ color: "var(--text-3)" }} onMouseEnter={e => (e.currentTarget.style.color = "var(--text-1)")} onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}>
                        {crumb.name}
                      </button>
                    )}
                  </span>
                )
              })}
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Folder size={18} style={{ color: "var(--text-3)" }} />
              <h1 className="text-xl font-semibold" style={{ color: "var(--text-1)" }}>
                {folder?.name ?? folderNameFromUrl}
              </h1>
              <span className="text-[12px]" style={{ color: "var(--text-3)" }}>
                {folder?.doc_count !== undefined ? Number(folder.doc_count) || 0 : docs.length} docs
              </span>
            </div>
            <button
              onClick={handleCreateDoc}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{
                backgroundColor: "var(--primary-bg)",
                border: "1px solid var(--border-subtle)",
                color: "var(--primary-text)",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              <Plus size={15} />
              {creating ? "Creating..." : "New Doc"}
            </button>
          </div>

          <div className="flex items-center justify-end mb-7">
            <div className="flex gap-1">
              <button
                onClick={() => setView("grid")}
                title="Grid view"
                style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", border: "1px solid " + (view === "grid" ? "var(--text-1)" : "var(--border-subtle)"), backgroundColor: view === "grid" ? "var(--surface-2)" : "transparent", color: view === "grid" ? "var(--text-1)" : "var(--text-3)", cursor: "pointer", transition: "all 0.15s" }}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setView("list")}
                title="List view"
                style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", border: "1px solid " + (view === "list" ? "var(--text-1)" : "var(--border-subtle)"), backgroundColor: view === "list" ? "var(--surface-2)" : "transparent", color: view === "list" ? "var(--text-1)" : "var(--text-3)", cursor: "pointer", transition: "all 0.15s" }}
              >
                <List size={15} />
              </button>
            </div>
          </div>

          {/* Subfolders */}
          <div className="mb-6">
            <p className="text-[12px] mb-3" style={{ color: "var(--text-3)" }}>Folders · {subfolders.length}</p>
            <div className="flex flex-wrap gap-2">
              {subfolders.map((sub, i) => {
                const subDocCount = Number(sub.doc_count) || 0
                const isSubMenuOpen = openMenuId === sub.id
                return (
                  <div
                    key={sub.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/folders/${sub.id}?name=${encodeURIComponent(sub.name)}`)}
                    className="group flex items-center gap-2 rounded-full transition-colors cursor-pointer"
                    style={{ height: "34px", padding: "0 6px 0 10px", backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--text-3)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                  >
                    <span style={{ width: "14px", height: "14px", borderRadius: "4px", backgroundColor: getAccent(i), flexShrink: 0 }} />
                    <span className="text-[13px]" style={{ color: "var(--text-1)" }}>{sub.name}</span>
                    <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{subDocCount}</span>
                    <div className="relative" ref={isSubMenuOpen ? menuRef : null}>
                      <button
                        onClick={e => { e.stopPropagation(); setOpenMenuId(isSubMenuOpen ? null : sub.id) }}
                        title="More options"
                        className="transition-opacity"
                        style={{ color: "var(--text-3)", display: "flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "999px", opacity: isSubMenuOpen ? 1 : 0.4 }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={e => (e.currentTarget.style.opacity = isSubMenuOpen ? "1" : "0.4")}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {isSubMenuOpen && (
                        <div
                          style={{
                            position: "absolute", right: 0, top: 26, zIndex: 50,
                            borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                            width: 130, padding: "4px 0", overflow: "hidden",
                            background: "var(--menu-bg)", border: "1px solid var(--border-subtle)",
                          }}
                        >
                          <button
                            onClick={e => handleOpenMoveSubfolder(sub, e)}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
                              fontSize: 13, color: "var(--text-3)", background: "transparent", border: "none",
                              cursor: "pointer", textAlign: "left",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--hover)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >
                            <FolderInput size={12} /> Move to folder
                          </button>
                          <button
                            onClick={e => handleMoveToTopLevel(sub, e)}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
                              fontSize: 13, color: "var(--text-3)", background: "transparent", border: "none",
                              cursor: "pointer", textAlign: "left",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--hover)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >
                            <FolderInput size={12} /> Move to top level
                          </button>
                          <button
                            onClick={e => { setOpenMenuId(null); handleDeleteSubfolder(sub, e) }}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
                              fontSize: 13, color: "var(--danger)", background: "transparent", border: "none",
                              cursor: "pointer", textAlign: "left",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--hover)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <button
                onClick={() => { setNewSubfolderName(""); setNewSubfolderModalOpen(true) }}
                className="flex items-center gap-1.5 rounded-full transition-colors"
                style={{ height: "34px", padding: "0 14px", border: "1px dashed var(--border-subtle)", backgroundColor: "transparent", color: "var(--text-3)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-1)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
              >
                <Plus size={13} />
                New subfolder
              </button>
            </div>
          </div>

          <div className="mb-7" style={{ borderTop: "1px solid var(--border-subtle)" }} />

          {/* Doc list */}
          {loading ? (
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-52 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--text-3)" }}>
              <Folder size={36} className="mb-3" style={{ color: "var(--text-3)" }} />
              <p className="text-[15px] font-medium mb-1" style={{ color: "var(--text-2)" }}>No docs in this folder</p>
              <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Click New Doc to get started</p>
            </div>
          ) : (
            <>
              {view === "list" && (
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 20px 8px", fontSize: 11, color: "var(--text-3)" }}>
                  <div style={{ width: 28 }} />
                  <span style={{ flex: 1 }}>Name</span>
                  <span>Edited</span>
                </div>
              )}

              <div className={view === "grid" ? "grid grid-cols-4 gap-4" : "flex flex-col gap-2"}>
              {docs.map((doc) => {
                const isMenuOpen = openMenuId === doc.uuid

                const favoriteButton = (
                  <button
                    onClick={e => handleToggleFavorite(doc, e)}
                    title={doc.is_starred ? "Remove from favorites" : "Add to favorites"}
                    className="transition-opacity"
                    style={{ color: doc.is_starred ? "#EF9F27" : "var(--text-3)", opacity: doc.is_starred ? 1 : 0 }}
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
                    style={{ color: "var(--text-3)" }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-1)" }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-3)" }}
                  >
                    <MoreVertical size={15} />
                  </button>
                )

                const menuDropdown = isMenuOpen && (
                  <div className="absolute right-0 top-8 w-44 rounded-xl shadow-xl z-50 overflow-hidden py-1" style={{ backgroundColor: "var(--menu-bg)", border: "1px solid var(--border-subtle)" }}>
                    <button onClick={e => { e.stopPropagation(); setRenamingDoc(doc); setRenameValue(doc.title || ""); setOpenMenuId(null) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors" style={{ color: "var(--text-2)" }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--surface-2)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <Pencil size={13} style={{ color: "var(--text-3)" }} /> Rename
                    </button>
                    <button onClick={e => { e.stopPropagation(); openMoveModal(doc) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors" style={{ color: "var(--text-2)" }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--surface-2)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <FolderInput size={13} style={{ color: "var(--text-3)" }} /> Move
                    </button>
                    <div className="my-1 border-t" style={{ borderColor: "var(--border-subtle)" }} />
                    <button onClick={e => { e.stopPropagation(); setDeletingDoc(doc); setOpenMenuId(null) }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--danger-text)] hover:text-[var(--danger-text-hover)] transition-colors" onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--surface-2)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                )

                if (view === "list") {
                  return (
                    <div key={doc.uuid} className="relative group flex items-stretch transition-colors overflow-hidden" style={{ borderBottom: "1px solid var(--border-subtle)" }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--surface)" }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent" }}
                    >
                      <button onClick={() => router.push(`/docs/${doc.uuid}`)} className="text-left flex items-center gap-4 flex-1 min-w-0 px-5 py-3.5" style={{ cursor: "pointer" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "var(--doc-icon-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--doc-icon-fg)" strokeWidth="2" strokeLinecap="round">
                            <rect x="4" y="2.5" width="16" height="19" rx="3" />
                            <line x1="8" y1="8" x2="16" y2="8" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                            <line x1="8" y1="16" x2="12.5" y2="16" />
                          </svg>
                        </div>
                        <p className="font-semibold text-[15px] leading-snug flex-1 min-w-0 truncate" style={{ color: "var(--text-1)" }}>{doc.title || "Untitled"}</p>
                        {doc.is_workspace_shared && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--doc-shared-text)", backgroundColor: "var(--doc-shared-bg)", borderRadius: 20, padding: "2px 8px", flexShrink: 0 }}>
                            <Users size={10} /> Shared
                          </span>
                        )}
                        <p className="text-[12px] flex-shrink-0" style={{ color: "var(--text-3)" }}>{formatDate(doc.created_at)}</p>
                      </button>
                      <div className="flex items-center gap-1 pr-4 flex-shrink-0">
                        {favoriteButton}
                        <div className="relative" ref={isMenuOpen ? menuRef : null}>
                          {menuButton}
                          {menuDropdown}
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={doc.uuid} className="relative group rounded-xl flex flex-col transition-colors overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)", minHeight: "200px" }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--surface-2)"; e.currentTarget.style.borderColor = "var(--text-3)" }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = "var(--surface)"; e.currentTarget.style.borderColor = "var(--border-subtle)" }}
                  >
                    <div style={{ height: "5px", backgroundColor: "var(--doc-card-strip)", width: "100%", flexShrink: 0 }} />
                    <button onClick={() => router.push(`/docs/${doc.uuid}`)} className="text-left px-5 pt-4 pb-3 flex flex-col flex-1 w-full" style={{ cursor: "pointer" }}>
                      <p className="font-semibold text-[15px] leading-snug mb-3 pr-6" style={{ color: "var(--text-1)" }}>{doc.title || "Untitled"}</p>
                      <p className="text-[13px] leading-relaxed line-clamp-3 flex-1" style={{ color: "var(--text-2)" }}>{stripHtml(doc.content)}</p>
                    </button>
                    <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <p className="text-[12px]" style={{ color: "var(--text-3)" }}>{formatDate(doc.created_at)}</p>
                      {favoriteButton}
                    </div>
                    <div className="absolute top-7 right-4" ref={isMenuOpen ? menuRef : null}>
                      {menuButton}
                      {menuDropdown}
                    </div>
                  </div>
                )
              })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Rename modal */}
      {renamingDoc && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "var(--overlay)" }}>
          <div
            className="rounded-2xl p-6 w-80 shadow-2xl"
            style={{ backgroundColor: "var(--menu-bg)", border: "1px solid var(--border-subtle)" }}
          >
            <h2 className="font-semibold text-base mb-4" style={{ color: "var(--text-1)" }}>Rename doc</h2>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenamingDoc(null) }}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-4"
              style={{
                backgroundColor: "var(--surface-2)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-1)",
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRenamingDoc(null)}
                className="px-4 py-2 text-sm transition-colors"
                style={{ color: "var(--text-3)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-1)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-4 py-2 text-sm rounded-lg transition-colors"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--text-1)" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--border-subtle)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--surface-2)")}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New subfolder modal */}
      {newSubfolderModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "var(--overlay)" }}>
          <div className="rounded-2xl p-6 w-80 shadow-2xl" style={{ backgroundColor: "var(--menu-bg)", border: "1px solid var(--border-subtle)" }}>
            <h2 className="font-semibold text-base mb-4" style={{ color: "var(--text-1)" }}>New subfolder</h2>
            <input
              autoFocus
              value={newSubfolderName}
              onChange={e => setNewSubfolderName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreateSubfolder(); if (e.key === "Escape") setNewSubfolderModalOpen(false) }}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-4"
              style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)", color: "var(--text-1)" }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setNewSubfolderModalOpen(false)} className="px-4 py-2 text-sm" style={{ color: "var(--text-3)" }}>Cancel</button>
              <button onClick={handleCreateSubfolder} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-1)" }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Move modal */}
      {movingDoc && (
        <MoveToFolderModal
          folders={folders}
          onMove={handleMove}
          onClose={() => setMovingDoc(null)}
          currentFolderId={String(id)}
        />
      )}

      {/* Move subfolder modal */}
      {movingSubfolder && (
        <MoveToFolderModal
          folders={moveCandidates}
          onMove={handleMoveSubfolder}
          onClose={() => setMovingSubfolder(null)}
          currentFolderId={id as string}
        />
      )}

      {/* Delete modal */}
      {deletingDoc && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "var(--overlay)" }}>
          <div
            className="rounded-2xl p-6 w-80 shadow-2xl"
            style={{ backgroundColor: "var(--menu-bg)", border: "1px solid var(--border-subtle)" }}
          >
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text-1)" }}>Delete doc?</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-3)" }}>
              &ldquo;{deletingDoc.title || "Untitled"}&rdquo; will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeletingDoc(null)}
                className="px-4 py-2 text-sm transition-colors"
                style={{ color: "var(--text-3)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-1)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm rounded-lg transition-colors bg-red-500/20 hover:bg-red-500/30 text-[var(--danger-text)]"
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
