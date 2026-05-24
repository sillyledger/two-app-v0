"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Search,
  FileText,
  ChevronDown,
  ChevronRight,
  Settings,
  Layers,
  Activity,
  Home,
  Plus,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  CheckSquare,
} from "lucide-react"

interface Doc {
  id: string
  uuid: string
  title: string
}

interface FolderType {
  id: string
  name: string
}

interface Workspace {
  id: string
  name: string
}

interface SidebarProps {
  onNewNote?: () => void
  collapsed?: boolean
  onToggle?: () => void
}

function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch { return null }
}
function cacheSet(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export default function Sidebar({ onNewNote, collapsed = false, onToggle }: SidebarProps = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const [workspaceOpen, setWorkspaceOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [userName, setUserName] = useState(() => cacheGet<string>("sb_userName") ?? "")
  const [userAvatar, setUserAvatar] = useState<string | null>(() => cacheGet<string>("sb_userAvatar"))
  const [workspaceName, setWorkspaceName] = useState(() => cacheGet<string>("sb_workspaceName") ?? "My Workspace")
  const [workspaceId, setWorkspaceId] = useState<string | null>(() => cacheGet<string>("sb_workspaceId"))
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => cacheGet<Workspace[]>("sb_workspaces") ?? [])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => cacheGet<string>("sb_workspaceId"))
  const [docs, setDocs] = useState<Doc[]>(() => cacheGet<Doc[]>("sb_docs") ?? [])
  const [folders, setFolders] = useState<FolderType[]>(() => cacheGet<FolderType[]>("sb_folders") ?? [])
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({})
  const [wsData, setWsData] = useState<Record<string, { docs: Doc[]; folders: FolderType[] }>>({})
  const [creating, setCreating] = useState(false)
  const [renamingWorkspace, setRenamingWorkspace] = useState(false)
  const [workspaceRenameValue, setWorkspaceRenameValue] = useState("")
  const workspaceInputRef = useRef<HTMLInputElement>(null)
  const [wsMenuId, setWsMenuId] = useState<string | null>(null)
  const wsMenuRef = useRef<HTMLDivElement>(null)
  const [renamingWsId, setRenamingWsId] = useState<string | null>(null)
  const [wsRenameValue, setWsRenameValue] = useState("")
  const wsRenameInputRef = useRef<HTMLInputElement>(null)
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null)
  const folderMenuRef = useRef<HTMLDivElement>(null)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [folderRenameValue, setFolderRenameValue] = useState("")
  const folderRenameInputRef = useRef<HTMLInputElement>(null)
  const [draggingDocId, setDraggingDocId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<"doc" | "folder" | "workspace">("doc")
  const [modalName, setModalName] = useState("")
  const [modalTargetWorkspaceId, setModalTargetWorkspaceId] = useState<string | null>(null)
  const modalInputRef = useRef<HTMLInputElement>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [helpTab, setHelpTab] = useState<"shortcuts" | "started" | "tips" | "new">("shortcuts")

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowHelp(false)
      if (e.key === "?" && !showModal) setShowHelp((v) => !v)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [showModal])

  const fetchDocsForWorkspace = (wsId: string, isPrimary: boolean) => {
    fetch(`/api/docs?workspace_id=${wsId}`)
      .then((r) => r.json())
      .then((data) => {
        const unfiled = Array.isArray(data) ? data.filter((d: any) => !d.folder_id) : []
        const sliced = unfiled.slice(0, 8)
        if (isPrimary) {
          setDocs(sliced)
          cacheSet("sb_docs", sliced)
        } else {
          setWsData((prev) => ({
            ...prev,
            [wsId]: { docs: sliced, folders: prev[wsId]?.folders ?? [] },
          }))
        }
      })
      .catch(() => {})
  }

  const fetchFoldersForWorkspace = (wsId: string, isPrimary: boolean) => {
    fetch(`/api/folders?workspace_id=${wsId}`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        if (isPrimary) {
          setFolders(list)
          cacheSet("sb_folders", list)
        } else {
          setWsData((prev) => ({
            ...prev,
            [wsId]: { folders: list, docs: prev[wsId]?.docs ?? [] },
          }))
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          const name = data.user.name || data.user.email.split("@")[0]
          const avatar = data.user.avatar_url || null
          setUserName(name)
          setUserAvatar(avatar)
          cacheSet("sb_userName", name)
          cacheSet("sb_userAvatar", avatar)
        }
      })
      .catch(() => {})

    fetch("/api/workspace")
      .then((r) => r.json())
      .then((data) => {
        if (data?.name) {
          setWorkspaceName(data.name)
          cacheSet("sb_workspaceName", data.name)
        }
        if (data?.id) {
          setWorkspaceId(data.id)
          setActiveWorkspaceId(data.id)
          cacheSet("sb_workspaceId", data.id)
          fetchDocsForWorkspace(data.id, true)
          fetchFoldersForWorkspace(data.id, true)
        }
      })
      .catch(() => {})

    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setWorkspaces(list)
        cacheSet("sb_workspaces", list)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false)
    }
    if (showPicker) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showPicker])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) setFolderMenuId(null)
    }
    if (folderMenuId) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [folderMenuId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wsMenuRef.current && !wsMenuRef.current.contains(e.target as Node)) setWsMenuId(null)
    }
    if (wsMenuId) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [wsMenuId])

  useEffect(() => {
    if (showModal) setTimeout(() => modalInputRef.current?.focus(), 50)
  }, [showModal])

  useEffect(() => {
    if (renamingWorkspace) setTimeout(() => workspaceInputRef.current?.select(), 50)
  }, [renamingWorkspace])

  useEffect(() => {
    if (renamingFolderId) setTimeout(() => folderRenameInputRef.current?.select(), 50)
  }, [renamingFolderId])

  useEffect(() => {
    if (renamingWsId) setTimeout(() => wsRenameInputRef.current?.select(), 50)
  }, [renamingWsId])

  const startRenamingWorkspace = () => {
    setWorkspaceRenameValue(workspaceName)
    setRenamingWorkspace(true)
  }

  const commitWorkspaceRename = async () => {
    const trimmed = workspaceRenameValue.trim()
    setRenamingWorkspace(false)
    if (!trimmed || trimmed === workspaceName) return
    setWorkspaceName(trimmed)
    cacheSet("sb_workspaceName", trimmed)
    try {
      await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
    } catch {}
  }

  const cancelWorkspaceRename = () => {
    setRenamingWorkspace(false)
    setWorkspaceRenameValue("")
  }

  const commitExtraWsRename = async (wsId: string) => {
    const trimmed = wsRenameValue.trim()
    setRenamingWsId(null)
    if (!trimmed) return
    const updated = workspaces.map((w) => (w.id === wsId ? { ...w, name: trimmed } : w))
    setWorkspaces(updated)
    cacheSet("sb_workspaces", updated)
    try {
      await fetch(`/api/workspaces/${wsId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
    } catch {}
  }

  const deleteExtraWorkspace = async (wsId: string) => {
    setWsMenuId(null)
    const confirmed = window.confirm("Delete this workspace? This cannot be undone.")
    if (!confirmed) return
    try {
      const res = await fetch(`/api/workspaces/${wsId}`, { method: "DELETE" })
      if (!res.ok) {
        alert("Failed to delete workspace. Please try again.")
        return
      }
      const updated = workspaces.filter((w) => w.id !== wsId)
      setWorkspaces(updated)
      cacheSet("sb_workspaces", updated)
      if (activeWorkspaceId === wsId) setActiveWorkspaceId(workspaceId)
    } catch {
      alert("Something went wrong. Please try again.")
    }
  }

  const startRenamingFolder = (folder: FolderType) => {
    setFolderMenuId(null)
    setFolderRenameValue(folder.name)
    setRenamingFolderId(folder.id)
  }

  const commitFolderRename = async (folderId: string) => {
    const trimmed = folderRenameValue.trim()
    setRenamingFolderId(null)
    if (!trimmed) return
    const updated = folders.map((f) => (f.id === folderId ? { ...f, name: trimmed } : f))
    setFolders(updated)
    cacheSet("sb_folders", updated)
    try {
      await fetch(`/api/folders/${folderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
    } catch {}
  }

  const deleteFolder = async (folderId: string) => {
    setFolderMenuId(null)
    const updated = folders.filter((f) => f.id !== folderId)
    setFolders(updated)
    cacheSet("sb_folders", updated)
    try {
      await fetch(`/api/folders/${folderId}`, { method: "DELETE" })
    } catch {}
  }

  const handleLogout = async () => {
    sessionStorage.clear()
    await fetch("/api/auth", { method: "DELETE" })
    router.push("/login")
  }

  const handleDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const docId = e.dataTransfer.getData("docId")
    if (!docId) return
    setDragOverFolderId(null)
    setDraggingDocId(null)
    try {
      const res = await fetch(`/api/docs/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: folderId }),
      })
      if (res.ok) {
        if (workspaceId) fetchDocsForWorkspace(workspaceId, true)
        setDocs(prev => prev.filter(d => d.uuid !== docId))
      }
    } catch {}
  }

  const initial = userName ? userName.charAt(0).toUpperCase() : "?"

  const openModal = (type: "doc" | "folder" | "workspace", targetWsId?: string) => {
    setShowPicker(false)
    setModalType(type)
    setModalTargetWorkspaceId(targetWsId ?? activeWorkspaceId)
    setModalName(
      type === "doc" ? "Untitled" :
      type === "folder" ? "New Folder" :
      "New Workspace"
    )
    setShowModal(true)
  }

  const handleModalConfirm = async () => {
    if (!modalName.trim()) return
    setShowModal(false)

    if (modalType === "doc") {
      setCreating(true)
      try {
        const res = await fetch("/api/docs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: modalName,
            content: "",
            color: "yellow",
            type: "doc",
            workspace_id: modalTargetWorkspaceId,
          }),
        })
        const doc = await res.json()
        if (modalTargetWorkspaceId && modalTargetWorkspaceId !== workspaceId) {
          fetchDocsForWorkspace(modalTargetWorkspaceId, false)
        } else if (workspaceId) {
          fetchDocsForWorkspace(workspaceId, true)
        }
        router.push(`/docs/${doc.uuid}`)
      } finally {
        setCreating(false)
      }
    }

    if (modalType === "folder") {
      const targetId = modalTargetWorkspaceId ?? workspaceId
      if (!targetId) return
      try {
        const res = await fetch("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: modalName, workspace_id: targetId }),
        })
        const folder = await res.json()
        if (targetId !== workspaceId) {
          fetchFoldersForWorkspace(targetId, false)
        } else {
          const updated = [...folders, folder]
          setFolders(updated)
          cacheSet("sb_folders", updated)
        }
      } catch {}
    }

    if (modalType === "workspace") {
      try {
        const res = await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: modalName }),
        })
        const workspace = await res.json()
        const updated = [...workspaces, workspace]
        setWorkspaces(updated)
        cacheSet("sb_workspaces", updated)
      } catch {}
    }
  }

  const toggleExtraWorkspace = (wsId: string) => {
    const isExpanding = !expandedWorkspaces[wsId]
    setExpandedWorkspaces((prev) => ({ ...prev, [wsId]: isExpanding }))
    if (isExpanding && !wsData[wsId]) {
      fetchDocsForWorkspace(wsId, false)
      fetchFoldersForWorkspace(wsId, false)
    }
  }

  // ── Styled nav item (works for both Link and button) ──
  const navItemClass = (href: string) =>
    `group relative flex items-center gap-3 px-3 py-2 rounded-lg mb-[2px] transition-all duration-100 text-[13.5px] font-medium tracking-[-0.01em] ${
      collapsed ? "justify-center" : ""
    } ${
      pathname === href
        ? "text-[#c4b8ff]"
        : "text-[#7a7a82] hover:text-[#d8d7d1]"
    }`

  const navItemStyle = (href: string): React.CSSProperties =>
    pathname === href
      ? { background: "rgba(107,92,231,0.16)" }
      : {}

  const ActiveBar = ({ href }: { href: string }) =>
    pathname === href ? (
      <span
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: 3,
          height: 18,
          background: "#6b5ce7",
          borderRadius: "0 3px 3px 0",
        }}
      />
    ) : null

  const AvatarBubble = ({ size = 28 }: { size?: number }) => (
    <div
      style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}
    >
      {userAvatar ? (
        <img src={userAvatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div
          style={{
            width: "100%", height: "100%", borderRadius: "50%",
            background: "linear-gradient(135deg,#f59e0b,#ef4444)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{initial}</span>
        </div>
      )}
    </div>
  )

  // ── Dropdown menu shared styles ──
  const dropdownStyle: React.CSSProperties = {
    position: "absolute", right: 0, top: 28, zIndex: 50,
    borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    width: 148, padding: "4px 0", overflow: "hidden",
    background: "#28282c", border: "1px solid rgba(255,255,255,0.08)",
  }
  const dropdownBtnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    width: "100%", padding: "8px 12px",
    fontSize: 12.5, color: "#9a9a9f",
    background: "transparent", border: "none", cursor: "pointer",
    transition: "all 0.1s", textAlign: "left",
  }

  const WorkspaceContents = ({
    wsFolders, wsDocs, wsId,
  }: {
    wsFolders: FolderType[]
    wsDocs: Doc[]
    wsId: string
  }) => (
    <div style={{ paddingLeft: 4 }}>
      {wsFolders.map((folder) => (
        <div
          key={folder.id}
          className="group relative"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 10px 6px 12px", borderRadius: 8,
            fontSize: 13, fontWeight: 400, cursor: "pointer",
            color: dragOverFolderId === folder.id || pathname === `/folders/${folder.id}` ? "#d8d7d1" : "#5a5a64",
            background: dragOverFolderId === folder.id || pathname === `/folders/${folder.id}` ? "rgba(255,255,255,0.06)" : "transparent",
            transition: "all 0.1s", marginBottom: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#c0bfba" }}
          onMouseLeave={e => {
            e.currentTarget.style.background = pathname === `/folders/${folder.id}` ? "rgba(255,255,255,0.06)" : "transparent"
            e.currentTarget.style.color = pathname === `/folders/${folder.id}` ? "#d8d7d1" : "#5a5a64"
          }}
          onClick={() => { if (renamingFolderId !== folder.id) router.push(`/folders/${folder.id}?name=${encodeURIComponent(folder.name)}`) }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolderId(folder.id) }}
          onDragLeave={(e) => { e.stopPropagation(); setDragOverFolderId(null) }}
          onDrop={(e) => handleDrop(e, folder.id)}
        >
          <FolderOpen size={13} style={{ color: "#4a4a52", flexShrink: 0 }} />
          {renamingFolderId === folder.id ? (
            <input
              ref={folderRenameInputRef}
              value={folderRenameValue}
              onChange={(e) => setFolderRenameValue(e.target.value)}
              onBlur={() => commitFolderRename(folder.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitFolderRename(folder.id)
                if (e.key === "Escape") setRenamingFolderId(null)
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1, minWidth: 0, borderRadius: 6, padding: "2px 8px",
                fontSize: 12, outline: "none",
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                color: "#e0dfd9",
              }}
            />
          ) : (
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.name}</span>
          )}
          {renamingFolderId !== folder.id && (
            <div className="relative" ref={folderMenuId === folder.id ? folderMenuRef : undefined}>
              <button
                onClick={(e) => { e.stopPropagation(); setFolderMenuId(folderMenuId === folder.id ? null : folder.id) }}
                style={{ opacity: 0, color: "#555", background: "none", border: "none", cursor: "pointer", padding: 2, borderRadius: 4, transition: "opacity 0.1s" }}
                className="group-hover:opacity-100"
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1" }}
              >
                <MoreHorizontal size={13} />
              </button>
              {folderMenuId === folder.id && (
                <div style={dropdownStyle}>
                  <button style={dropdownBtnStyle}
                    onClick={(e) => { e.stopPropagation(); startRenamingFolder(folder) }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "#d0cfca" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#9a9a9f" }}
                  >
                    <Pencil size={12} style={{ color: "#555" }} /> Rename
                  </button>
                  <button style={{ ...dropdownBtnStyle, color: "#f87171" }}
                    onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id) }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {wsDocs.length > 0 && (
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", padding: "10px 12px 4px", color: "#3a3a42", userSelect: "none" }}>
          Unfiled
        </p>
      )}
      {wsDocs.map((doc) => (
        <div
          key={doc.uuid}
          draggable
          onDragStart={(e) => { e.dataTransfer.setData("docId", String(doc.uuid)); e.dataTransfer.effectAllowed = "move"; setDraggingDocId(doc.uuid) }}
          onDragEnd={() => { setDraggingDocId(null); setDragOverFolderId(null) }}
          onClick={() => router.push(`/docs/${doc.uuid}`)}
          className="group"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 10px 6px 12px", borderRadius: 8,
            fontSize: 13, fontWeight: 400, cursor: "pointer",
            opacity: draggingDocId === doc.uuid ? 0.4 : 1,
            color: pathname === `/docs/${doc.uuid}` ? "#c4b8ff" : "#5a5a64",
            background: pathname === `/docs/${doc.uuid}` ? "rgba(107,92,231,0.14)" : "transparent",
            transition: "all 0.1s", marginBottom: 1,
          }}
          onMouseEnter={e => { if (pathname !== `/docs/${doc.uuid}`) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#c0bfba" } }}
          onMouseLeave={e => { if (pathname !== `/docs/${doc.uuid}`) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#5a5a64" } }}
        >
          <span className="opacity-0 group-hover:opacity-100" style={{ fontSize: 12, color: "#3a3a42", cursor: "grab", userSelect: "none", flexShrink: 0 }}>⠿</span>
          <FileText size={13} style={{ color: "#4a4a52", flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title || "Untitled"}</span>
        </div>
      ))}

      {wsFolders.length === 0 && wsDocs.length === 0 && (
        <p style={{ fontSize: 11, padding: "4px 12px", color: "#3a3a42" }}>No docs yet</p>
      )}
    </div>
  )

  const extraWorkspaces = workspaces.filter((w) => w.id !== workspaceId)

  const helpTabClass = (tab: string) =>
    `px-3 py-2 text-[11px] font-medium transition-colors border-b-2 ${
      helpTab === tab
        ? "border-[var(--text-primary)] text-[var(--text-primary)]"
        : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
    }`

  // ── Sidebar width ──
  const sidebarWidth = collapsed ? 52 : 220

  return (
    <>
      <aside
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          overflow: "hidden",
          flexShrink: 0,
          background: "#1a1a1c",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          transition: "width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)",
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {/* ── Header ── */}
        {collapsed ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "18px 0 12px", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <AvatarBubble />
            <button
              onClick={() => { localStorage.setItem("sidebar-collapsed", "false"); onToggle?.() }}
              title="Expand sidebar"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#444", padding: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#888")}
              onMouseLeave={e => (e.currentTarget.style.color = "#444")}
            >
              <PanelLeftOpen size={15} />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "18px 14px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <AvatarBubble />
            <span style={{ fontSize: 14.5, fontWeight: 600, color: "#f0efe9", letterSpacing: "-0.02em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userName || "…"}
            </span>
            <button
              onClick={() => { localStorage.setItem("sidebar-collapsed", "true"); onToggle?.() }}
              title="Collapse sidebar"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#444", padding: 4, flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#888")}
              onMouseLeave={e => (e.currentTarget.style.color = "#444")}
            >
              <PanelLeftClose size={15} />
            </button>
          </div>
        )}

        {/* ── Search ── */}
        {!collapsed && (
          <div style={{ padding: "10px 10px 4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", borderRadius: 9, padding: "7px 12px" }}>
              <Search size={12} style={{ color: "#3a3a42", flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ background: "transparent", border: "none", outline: "none", fontSize: 13.5, color: "#7a7a82", width: "100%", fontFamily: "inherit" }}
              />
            </div>
          </div>
        )}

        {/* ── Nav ── */}
        <nav style={{ flex: 1, padding: "8px 8px", overflowY: "auto", scrollbarWidth: "none" }}>

          {/* Primary links */}
          <Link href="/" className={navItemClass("/")} style={navItemStyle("/")}>
            <ActiveBar href="/" />
            <Home size={15} style={{ flexShrink: 0, opacity: pathname === "/" ? 1 : 0.6 }} />
            {!collapsed && "Home"}
          </Link>
          <Link href="/planner" className={navItemClass("/planner")} style={navItemStyle("/planner")}>
            <ActiveBar href="/planner" />
            <CheckSquare size={15} style={{ flexShrink: 0, opacity: pathname === "/planner" ? 1 : 0.6 }} />
            {!collapsed && "Planner"}
          </Link>
          <Link href="/activity" className={navItemClass("/activity")} style={navItemStyle("/activity")}>
            <ActiveBar href="/activity" />
            <Activity size={15} style={{ flexShrink: 0, opacity: pathname === "/activity" ? 1 : 0.6 }} />
            {!collapsed && "Activity"}
          </Link>
          <Link href="/library" className={navItemClass("/library")} style={navItemStyle("/library")}>
            <ActiveBar href="/library" />
            <Layers size={15} style={{ flexShrink: 0, opacity: pathname === "/library" ? 1 : 0.6 }} />
            {!collapsed && "Library"}
          </Link>

          {!collapsed && (
            <>
              {/* Divider */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "8px 4px" }} />

              {/* Workspace header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px 2px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
                  <button
                    onClick={() => setWorkspaceOpen(!workspaceOpen)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#3a3a42", padding: 2, display: "flex" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#666")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#3a3a42")}
                  >
                    {workspaceOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>
                  {renamingWorkspace ? (
                    <input
                      ref={workspaceInputRef}
                      value={workspaceRenameValue}
                      onChange={(e) => setWorkspaceRenameValue(e.target.value)}
                      onBlur={commitWorkspaceRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitWorkspaceRename()
                        if (e.key === "Escape") cancelWorkspaceRename()
                      }}
                      style={{
                        flex: 1, minWidth: 0, borderRadius: 5, padding: "2px 8px",
                        fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em",
                        outline: "none", background: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,255,255,0.12)", color: "#9a9a9f", fontFamily: "inherit",
                      }}
                    />
                  ) : (
                    <span
                      onDoubleClick={startRenamingWorkspace}
                      title="Double-click to rename"
                      style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#3a3a42", userSelect: "none", cursor: "default", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {workspaceName}
                    </span>
                  )}
                </div>
                <div className="relative" ref={pickerRef} style={{ marginLeft: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => setShowPicker((v) => !v)}
                    disabled={creating}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#3a3a42", padding: 2, display: "flex" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#888")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#3a3a42")}
                  >
                    <Plus size={13} />
                  </button>
                  {showPicker && (
                    <div style={dropdownStyle}>
                      <button style={dropdownBtnStyle}
                        onClick={() => openModal("doc", workspaceId ?? undefined)}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "#d0cfca" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#9a9a9f" }}
                      >
                        <FileText size={12} style={{ color: "#555" }} /> New Doc
                      </button>
                      <button style={dropdownBtnStyle}
                        onClick={() => openModal("folder", workspaceId ?? undefined)}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "#d0cfca" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#9a9a9f" }}
                      >
                        <FolderOpen size={12} style={{ color: "#555" }} /> New Folder
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {workspaceOpen && (
                <WorkspaceContents wsFolders={folders} wsDocs={docs} wsId={workspaceId ?? ""} />
              )}

              {/* Extra workspaces */}
              {extraWorkspaces.map((ws) => (
                <div key={ws.id} style={{ marginTop: 10 }}>
                  <div className="group" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px 2px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
                      <button
                        onClick={() => toggleExtraWorkspace(ws.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#3a3a42", padding: 2, display: "flex" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#666")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#3a3a42")}
                      >
                        {expandedWorkspaces[ws.id] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </button>
                      {renamingWsId === ws.id ? (
                        <input
                          ref={wsRenameInputRef}
                          value={wsRenameValue}
                          onChange={(e) => setWsRenameValue(e.target.value)}
                          onBlur={() => commitExtraWsRename(ws.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitExtraWsRename(ws.id)
                            if (e.key === "Escape") setRenamingWsId(null)
                          }}
                          style={{
                            flex: 1, minWidth: 0, borderRadius: 5, padding: "2px 8px",
                            fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em",
                            outline: "none", background: "rgba(255,255,255,0.07)",
                            border: "1px solid rgba(255,255,255,0.12)", color: "#9a9a9f", fontFamily: "inherit",
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#3a3a42", userSelect: "none", cursor: "default", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ws.name}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => openModal("doc", ws.id)}
                        title="New Doc"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#3a3a42", padding: 2, display: "flex", opacity: 0, transition: "opacity 0.1s" }}
                        className="group-hover:opacity-100"
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.color = "#888" }}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "#3a3a42"}
                      >
                        <Plus size={13} />
                      </button>
                      <div className="relative" ref={wsMenuId === ws.id ? wsMenuRef : undefined}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setWsMenuId(wsMenuId === ws.id ? null : ws.id) }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#3a3a42", padding: 2, display: "flex", opacity: 0, borderRadius: 4, transition: "opacity 0.1s" }}
                          className="group-hover:opacity-100"
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.color = "#888" }}
                          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "#3a3a42"}
                        >
                          <MoreHorizontal size={13} />
                        </button>
                        {wsMenuId === ws.id && (
                          <div style={dropdownStyle}>
                            <button style={dropdownBtnStyle}
                              onClick={(e) => { e.stopPropagation(); setWsMenuId(null); setWsRenameValue(ws.name); setRenamingWsId(ws.id) }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "#d0cfca" }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#9a9a9f" }}
                            >
                              <Pencil size={12} style={{ color: "#555" }} /> Rename
                            </button>
                            <button style={dropdownBtnStyle}
                              onClick={(e) => { e.stopPropagation(); openModal("folder", ws.id); setWsMenuId(null) }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "#d0cfca" }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#9a9a9f" }}
                            >
                              <FolderOpen size={12} style={{ color: "#555" }} /> New Folder
                            </button>
                            <button style={{ ...dropdownBtnStyle, color: "#f87171" }}
                              onClick={(e) => { e.stopPropagation(); deleteExtraWorkspace(ws.id) }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)" }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedWorkspaces[ws.id] && (
                    <WorkspaceContents wsFolders={wsData[ws.id]?.folders ?? []} wsDocs={wsData[ws.id]?.docs ?? []} wsId={ws.id} />
                  )}
                </div>
              ))}
            </>
          )}
        </nav>

        {/* ── Bottom utility row ── */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "8px 8px 14px", display: "flex", flexDirection: "column", alignItems: collapsed ? "center" : "stretch", gap: 1 }}>

          {/* Settings */}
          <Link href="/settings" className={navItemClass("/settings")} style={navItemStyle("/settings")}>
            <ActiveBar href="/settings" />
            <Settings size={15} style={{ flexShrink: 0, opacity: pathname === "/settings" ? 1 : 0.6 }} />
            {!collapsed && "Settings"}
          </Link>

          {/* Trash */}
          {!collapsed && (
            <Link href="/trash" className={navItemClass("/trash")} style={navItemStyle("/trash")}>
              <ActiveBar href="/trash" />
              <Trash2 size={15} style={{ flexShrink: 0, opacity: pathname === "/trash" ? 1 : 0.6 }} />
              Help & Shortcuts
            </Link>
          )}

          {/* Help */}
          {!collapsed && (
            <button
              onClick={() => { setHelpTab("shortcuts"); setShowHelp(true) }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 500, letterSpacing: "-0.01em", color: "#7a7a82", background: "transparent", border: "none", cursor: "pointer", width: "100%", fontFamily: "inherit", transition: "all 0.1s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "#d8d7d1" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#7a7a82" }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)", fontSize: 10, fontFamily: "monospace", color: "#4a4a52", flexShrink: 0 }}>?</span>
              Help & Shortcuts
            </button>
          )}

          {/* Add Workspace */}
          {!collapsed && (
            <button
              onClick={() => openModal("workspace")}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 500, letterSpacing: "-0.01em", color: "#7a7a82", background: "transparent", border: "none", cursor: "pointer", width: "100%", fontFamily: "inherit", transition: "all 0.1s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "#d8d7d1" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#7a7a82" }}
            >
              <Plus size={15} style={{ flexShrink: 0, opacity: 0.6 }} />
              Add Workspace
            </button>
          )}

          {/* Log out */}
          {!collapsed ? (
            <button
              onClick={handleLogout}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 500, letterSpacing: "-0.01em", color: "#7a7a82", background: "transparent", border: "none", cursor: "pointer", width: "100%", fontFamily: "inherit", transition: "all 0.1s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "#d8d7d1" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#7a7a82" }}
            >
              <LogOut size={15} style={{ flexShrink: 0, opacity: 0.6 }} />
              Log out
            </button>
          ) : (
            <button
              onClick={handleLogout}
              title="Log out"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 8, borderRadius: 8, color: "#444", background: "transparent", border: "none", cursor: "pointer", transition: "all 0.1s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "#888" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#444" }}
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </aside>

      {/* ── New doc / folder / workspace modal ── */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }} onClick={() => setShowModal(false)} />
          <div style={{ position: "relative", borderRadius: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", width: 320, padding: "22px 22px 18px", zIndex: 10, background: "#1e1e21", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "inherit" }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "#f0efe9", letterSpacing: "-0.01em" }}>
              {modalType === "doc" ? "New Doc" : modalType === "folder" ? "New Folder" : "New Workspace"}
            </h2>
            <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#3a3a42", display: "block", marginBottom: 6 }}>Name</label>
            <input
              ref={modalInputRef}
              type="text"
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleModalConfirm(); if (e.key === "Escape") setShowModal(false) }}
              style={{ width: "100%", borderRadius: 9, padding: "9px 12px", fontSize: 13.5, outline: "none", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e0dfd9", fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 500, color: "#5a5a62", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                Cancel
              </button>
              <button
                onClick={handleModalConfirm}
                style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#6b5ce7", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#7c6ef0")}
                onMouseLeave={e => (e.currentTarget.style.background = "#6b5ce7")}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Help modal ── */}
      {showHelp && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }} onClick={() => setShowHelp(false)} />
          <div style={{ position: "relative", borderRadius: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", width: 500, maxWidth: "calc(100vw - 32px)", zIndex: 10, overflow: "hidden", background: "#1e1e21", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "inherit" }}>
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {(["shortcuts", "started", "tips", "new"] as const).map((tab) => (
                <button key={tab} onClick={() => setHelpTab(tab)} className={helpTabClass(tab)}>
                  {tab === "shortcuts" && "Shortcuts"}
                  {tab === "started" && "Getting Started"}
                  {tab === "tips" && "Tips"}
                  {tab === "new" && "What's New"}
                </button>
              ))}
              <button
                onClick={() => setShowHelp(false)}
                style={{ marginLeft: "auto", padding: "8px 12px", fontSize: 12, color: "#444", background: "none", border: "none", cursor: "pointer", transition: "color 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#aaa")}
                onMouseLeave={e => (e.currentTarget.style.color = "#444")}
              >✕</button>
            </div>

            <div style={{ overflowY: "auto", maxHeight: 380 }}>
              {helpTab === "shortcuts" && (
                <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
                  {[
                    { label: "Formatting", rows: [{ action: "Bold", keys: ["⌘","B"] }, { action: "Italic", keys: ["⌘","I"] }, { action: "Strikethrough", keys: ["⌘","⇧","S"] }, { action: "Inline code", keys: ["⌘","E"] }, { action: "Heading 1 / 2 / 3", keys: ["⌘","⌥","1–3"] }] },
                    { label: "Navigation", rows: [{ action: "New doc", keys: ["⌘","N"] }, { action: "Search", keys: ["⌘","K"] }, { action: "Toggle sidebar", keys: ["⌘","\\"] }, { action: "Open help", keys: ["?"] }] },
                  ].map((section) => (
                    <div key={section.label}>
                      <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#3a3a42", marginBottom: 8 }}>{section.label}</p>
                      {section.rows.map((row) => (
                        <div key={row.action} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <span style={{ fontSize: 12, color: "#7a7a82" }}>{row.action}</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            {row.keys.map((k) => (
                              <kbd key={k} style={{ fontFamily: "monospace", fontSize: 11, padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#c0bfba" }}>{k}</kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {helpTab === "started" && (
                <div style={{ padding: "20px 20px" }}>
                  {[
                    { n: 1, title: "Create your first doc", desc: "Press ⌘N or tap + in the sidebar to create a new doc instantly." },
                    { n: 2, title: "Format as you write", desc: "Select any text to reveal the formatting toolbar. Use headings, bold, italic, and code blocks." },
                    { n: 3, title: "Find anything fast", desc: "Press ⌘K to search across all your docs by title or content. Results appear instantly." },
                    { n: 4, title: "Your docs save automatically", desc: "Every change is saved in the background. You'll see a quiet \"Saved\" indicator — no manual saving needed." },
                  ].map((step) => (
                    <div key={step.n} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: "monospace", color: "#3a3a42", flexShrink: 0, marginTop: 2 }}>{step.n}</div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#e0dfd9", marginBottom: 4 }}>{step.title}</p>
                        <p style={{ fontSize: 12, lineHeight: 1.6, color: "#4a4a52" }}>{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {helpTab === "tips" && (
                <div style={{ padding: "20px 20px" }}>
                  {[
                    { title: "Use headings to create structure", desc: "Break long docs into sections with H1, H2, and H3. Makes scanning much faster when you revisit later." },
                    { title: "Code blocks for technical notes", desc: "Wrap commands, snippets, or config values in a code block to keep them visually distinct and easy to copy." },
                    { title: "Keep one doc per topic", desc: "Short focused docs are easier to find and reference than one giant file. Use search to pull them up in seconds." },
                    { title: "Blockquotes for highlights", desc: "Use blockquotes to call out key decisions, quotes from meetings, or anything you want to stand out at a glance." },
                  ].map((tip) => (
                    <div key={tip.title} style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "#e0dfd9", marginBottom: 4 }}>{tip.title}</p>
                      <p style={{ fontSize: 12, lineHeight: 1.6, color: "#4a4a52" }}>{tip.desc}</p>
                    </div>
                  ))}
                </div>
              )}

              {helpTab === "new" && (
                <div style={{ padding: "20px 20px" }}>
                  {[
                    { version: "v0.4", date: "May 2026", tag: "Latest", items: ["Notes are scoped per user — your docs are private to your account", "Autosave with Saved status indicator in the editor", "Search bar with autocomplete on the dashboard"] },
                    { version: "v0.3", date: "Apr 2026", tag: null, items: ["Rich text editor with full formatting toolbar", "Heading levels H1, H2, H3", "Code blocks and inline code"] },
                    { version: "v0.2", date: "Mar 2026", tag: null, items: ["Auth system — signup, login, logout", "Sidebar with settings and user avatar"] },
                  ].map((release) => (
                    <div key={release.version} style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 500, color: "#e0dfd9" }}>{release.version}</span>
                        <span style={{ fontSize: 11, color: "#3a3a42" }}>{release.date}</span>
                        {release.tag && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#7a7a82" }}>{release.tag}</span>}
                      </div>
                      {release.items.map((item) => (
                        <p key={item} style={{ fontSize: 12, lineHeight: 1.6, color: "#4a4a52", paddingLeft: 12, position: "relative" }}>
                          <span style={{ position: "absolute", left: 0, color: "#2a2a32" }}>–</span>{item}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: "10px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#3a3a42" }}>Press</span>
              <kbd style={{ fontFamily: "monospace", fontSize: 10, padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#c0bfba" }}>?</kbd>
              <span style={{ fontSize: 11, color: "#3a3a42" }}>or</span>
              <kbd style={{ fontFamily: "monospace", fontSize: 10, padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#c0bfba" }}>Esc</kbd>
              <span style={{ fontSize: 11, color: "#3a3a42" }}>to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
