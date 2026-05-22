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

// ── simple session cache ──────────────────────────────────────────
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
    const updated = workspaces.filter((w) => w.id !== wsId)
    setWorkspaces(updated)
    cacheSet("sb_workspaces", updated)
    if (activeWorkspaceId === wsId) setActiveWorkspaceId(workspaceId)
    try {
      await fetch(`/api/workspaces/${wsId}`, { method: "DELETE" })
    } catch {}
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
      if (res.ok && workspaceId) fetchDocsForWorkspace(workspaceId, true)
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

  const navItem = (href: string, icon: React.ReactNode, label: string) => (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-2 px-2 py-[5px] rounded-md mb-[1px] transition-colors text-[12px] font-medium ${
        collapsed ? "justify-center" : ""
      } ${
        pathname === href
          ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
          : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
      }`}
    >
      {icon}
      {!collapsed && label}
    </Link>
  )

  const AvatarBubble = ({ size = 5 }: { size?: number }) => (
    <div className={`w-${size} h-${size} rounded-full overflow-hidden shrink-0`}>
      {userAvatar ? (
        <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full bg-[#7C3AED] flex items-center justify-center">
          <span className="text-[9px] font-bold text-white">{initial}</span>
        </div>
      )}
    </div>
  )

  const WorkspaceContents = ({
    wsFolders,
    wsDocs,
    wsId,
  }: {
    wsFolders: FolderType[]
    wsDocs: Doc[]
    wsId: string
  }) => (
    <div className="space-y-[1px]">
      {wsFolders.map((folder) => (
        <div
          key={folder.id}
          className="group relative flex items-center gap-2 px-2 py-[5px] rounded-md text-[12px] font-medium transition-colors cursor-pointer"
          style={{
            backgroundColor:
              dragOverFolderId === folder.id || pathname === `/folders/${folder.id}`
                ? "var(--bg-tertiary)"
                : "transparent",
            color:
              dragOverFolderId === folder.id || pathname === `/folders/${folder.id}`
                ? "var(--text-primary)"
                : "var(--text-muted)",
          }}
          onMouseEnter={e => {
            if (pathname !== `/folders/${folder.id}`) {
              e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"
              e.currentTarget.style.color = "var(--text-primary)"
            }
          }}
          onMouseLeave={e => {
            if (pathname !== `/folders/${folder.id}`) {
              e.currentTarget.style.backgroundColor = "transparent"
              e.currentTarget.style.color = "var(--text-muted)"
            }
          }}
          onClick={() => {
            if (renamingFolderId !== folder.id) {
              router.push(`/folders/${folder.id}?name=${encodeURIComponent(folder.name)}`)
            }
          }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolderId(folder.id) }}
          onDragLeave={(e) => { e.stopPropagation(); setDragOverFolderId(null) }}
          onDrop={(e) => handleDrop(e, folder.id)}
        >
          <FolderOpen size={13} className="shrink-0" style={{ color: "var(--text-muted)" }} />
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
              className="flex-1 min-w-0 rounded px-1.5 py-0.5 text-[12px] outline-none"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          ) : (
            <span className="truncate flex-1">{folder.name}</span>
          )}
          {renamingFolderId !== folder.id && (
            <div className="relative" ref={folderMenuId === folder.id ? folderMenuRef : undefined}>
              <button
                onClick={(e) => { e.stopPropagation(); setFolderMenuId(folderMenuId === folder.id ? null : folder.id) }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
                style={{ color: "var(--text-muted)" }}
              >
                <MoreHorizontal size={13} />
              </button>
              {folderMenuId === folder.id && (
                <div
                  className="absolute right-0 top-6 z-50 rounded-lg shadow-xl w-[140px] py-1 overflow-hidden"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)" }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); startRenamingFolder(folder) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[12px] transition-colors"
                    style={{ color: "var(--text-secondary)" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-secondary)")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <Pencil size={12} style={{ color: "var(--text-muted)" }} /> Rename
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-red-400 hover:text-red-300 transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-secondary)")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {wsDocs.map((doc) => (
        <div
          key={doc.uuid}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("docId", String(doc.uuid))
            e.dataTransfer.effectAllowed = "move"
            setDraggingDocId(doc.uuid)
          }}
          onDragEnd={() => { setDraggingDocId(null); setDragOverFolderId(null) }}
          onClick={() => router.push(`/docs/${doc.uuid}`)}
          className="flex items-center gap-2 px-2 py-[5px] rounded-md transition-colors text-[12px] font-medium cursor-pointer"
          style={{
            opacity: draggingDocId === doc.uuid ? 0.4 : 1,
            backgroundColor: pathname === `/docs/${doc.uuid}` ? "var(--bg-tertiary)" : "transparent",
            color: pathname === `/docs/${doc.uuid}` ? "var(--text-primary)" : "var(--text-muted)",
          }}
          onMouseEnter={e => {
            if (pathname !== `/docs/${doc.uuid}`) {
              e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"
              e.currentTarget.style.color = "var(--text-primary)"
            }
          }}
          onMouseLeave={e => {
            if (pathname !== `/docs/${doc.uuid}`) {
              e.currentTarget.style.backgroundColor = "transparent"
              e.currentTarget.style.color = "var(--text-muted)"
            }
          }}
        >
          <FileText size={13} className="shrink-0" style={{ color: "var(--text-muted)" }} />
          <span className="truncate">{doc.title || "Untitled"}</span>
        </div>
      ))}

      {wsFolders.length === 0 && wsDocs.length === 0 && (
        <p className="text-[11px] px-2 py-1" style={{ color: "var(--text-muted)" }}>No docs yet</p>
      )}
    </div>
  )

  const extraWorkspaces = workspaces.filter((w) => w.id !== workspaceId)

  return (
    <>
      <aside
        className="h-screen flex flex-col sticky top-0 border-r transition-all duration-200 ease-in-out overflow-hidden shrink-0"
        style={{
          width: collapsed ? "52px" : "210px",
          minWidth: collapsed ? "52px" : "210px",
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        {collapsed ? (
          <div className="flex flex-col items-center px-3 pt-4 pb-2.5 gap-2.5">
            <AvatarBubble />
            <button
              onClick={() => { localStorage.setItem("sidebar-collapsed", "false"); onToggle?.() }}
              title="Expand sidebar"
              style={{ color: "var(--text-muted)" }}
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              <PanelLeftOpen size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 pt-4 pb-2.5">
            <AvatarBubble />
            <span className="font-semibold text-[13px] truncate flex-1" style={{ color: "var(--text-primary)" }}>
              {userName || "..."}
            </span>
            <button
              onClick={() => { localStorage.setItem("sidebar-collapsed", "true"); onToggle?.() }}
              title="Collapse sidebar"
              style={{ color: "var(--text-muted)" }}
              className="hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <PanelLeftClose size={14} />
            </button>
          </div>
        )}

        {!collapsed && (
          <div className="px-2 mb-2">
            <div
              className="flex items-center gap-2 rounded-md px-2.5 py-[6px]"
              style={{ backgroundColor: "var(--bg-tertiary)" }}
            >
              <Search size={12} style={{ color: "var(--text-muted)" }} className="shrink-0" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-[12px] placeholder-[var(--text-muted)] outline-none w-full"
                style={{ color: "var(--text-secondary)" }}
              />
            </div>
          </div>
        )}

        <nav className="flex-1 px-2 overflow-y-auto mt-0.5">
          {navItem("/", <Home size={13} />, "Home")}
          {navItem("/planner", <CheckSquare size={13} />, "Planner")}
          {navItem("/activity", <Activity size={13} />, "Activity")}
          {navItem("/library", <Layers size={13} />, "Library")}

          {!collapsed && (
            <>
              <div className="my-2 border-t" style={{ borderColor: "var(--border)" }} />

              {/* PRIMARY WORKSPACE */}
              <div className="flex items-center justify-between px-2 py-[4px] mb-0.5">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <button
                    onClick={() => setWorkspaceOpen(!workspaceOpen)}
                    style={{ color: "var(--text-muted)" }}
                    className="hover:text-[var(--text-secondary)] transition-colors shrink-0"
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
                      className="flex-1 min-w-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider outline-none"
                      style={{
                        backgroundColor: "var(--bg-tertiary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                      }}
                    />
                  ) : (
                    <span
                      onDoubleClick={startRenamingWorkspace}
                      title="Double-click to rename"
                      className="text-[10px] font-semibold uppercase tracking-wider truncate cursor-default select-none"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {workspaceName}
                    </span>
                  )}
                </div>
                <div className="relative ml-1 shrink-0" ref={pickerRef}>
                  <button
                    onClick={() => setShowPicker((v) => !v)}
                    disabled={creating}
                    style={{ color: "var(--text-muted)" }}
                    className="hover:text-[var(--text-primary)] transition-colors"
                  >
                    <Plus size={13} />
                  </button>
                  {showPicker && (
                    <div
                      className="absolute right-0 top-5 z-50 rounded-lg shadow-xl w-[140px] py-1 overflow-hidden"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)" }}
                    >
                      <button
                        onClick={() => openModal("doc", workspaceId ?? undefined)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-[12px] transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-secondary)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <FileText size={12} style={{ color: "var(--text-muted)" }} />
                        New Doc
                      </button>
                      <button
                        onClick={() => openModal("folder", workspaceId ?? undefined)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-[12px] transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-secondary)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <FolderOpen size={12} style={{ color: "var(--text-muted)" }} />
                        New Folder
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {workspaceOpen && (
                <WorkspaceContents
                  wsFolders={folders}
                  wsDocs={docs}
                  wsId={workspaceId ?? ""}
                />
              )}

              {/* EXTRA WORKSPACES */}
              {extraWorkspaces.map((ws) => (
                <div key={ws.id} className="mt-3">
                  <div className="group flex items-center justify-between px-2 py-[4px] mb-0.5">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <button
                        onClick={() => toggleExtraWorkspace(ws.id)}
                        style={{ color: "var(--text-muted)" }}
                        className="hover:text-[var(--text-secondary)] transition-colors shrink-0"
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
                          className="flex-1 min-w-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider outline-none"
                          style={{
                            backgroundColor: "var(--bg-tertiary)",
                            border: "1px solid var(--border)",
                            color: "var(--text-secondary)",
                          }}
                        />
                      ) : (
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider truncate cursor-default select-none"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {ws.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openModal("doc", ws.id)}
                        style={{ color: "var(--text-muted)" }}
                        className="opacity-0 group-hover:opacity-100 hover:text-[var(--text-primary)] transition-all"
                        title="New Doc"
                      >
                        <Plus size={13} />
                      </button>
                      <div className="relative" ref={wsMenuId === ws.id ? wsMenuRef : undefined}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setWsMenuId(wsMenuId === ws.id ? null : ws.id) }}
                          style={{ color: "var(--text-muted)" }}
                          className="opacity-0 group-hover:opacity-100 hover:text-[var(--text-primary)] transition-all p-0.5 rounded"
                        >
                          <MoreHorizontal size={13} />
                        </button>
                        {wsMenuId === ws.id && (
                          <div
                            className="absolute right-0 top-6 z-50 rounded-lg shadow-xl w-[150px] py-1 overflow-hidden"
                            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)" }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setWsMenuId(null)
                                setWsRenameValue(ws.name)
                                setRenamingWsId(ws.id)
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-[12px] transition-colors"
                              style={{ color: "var(--text-secondary)" }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-secondary)")}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              <Pencil size={12} style={{ color: "var(--text-muted)" }} /> Rename
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openModal("folder", ws.id); setWsMenuId(null) }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-[12px] transition-colors"
                              style={{ color: "var(--text-secondary)" }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-secondary)")}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              <FolderOpen size={12} style={{ color: "var(--text-muted)" }} /> New Folder
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteExtraWorkspace(ws.id) }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-red-400 hover:text-red-300 transition-colors"
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-secondary)")}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedWorkspaces[ws.id] && (
                    <WorkspaceContents
                      wsFolders={wsData[ws.id]?.folders ?? []}
                      wsDocs={wsData[ws.id]?.docs ?? []}
                      wsId={ws.id}
                    />
                  )}
                </div>
              ))}
            </>
          )}
        </nav>

        <div
          className={`border-t px-2 py-2.5 space-y-[1px] ${collapsed ? "flex flex-col items-center" : ""}`}
          style={{ borderColor: "var(--border)" }}
        >
          {navItem("/settings", <Settings size={13} />, "Settings")}
          {!collapsed && navItem("/trash", <Trash2 size={13} />, "Trash")}
          {!collapsed && (
            <button
              onClick={() => openModal("workspace")}
              className="flex items-center gap-2 px-2 py-[5px] rounded-md transition-colors text-[12px] font-medium w-full"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}
            >
              <Plus size={13} />
              Add Workspace
            </button>
          )}
          {!collapsed ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-2 py-[5px] rounded-md transition-colors text-[12px] font-medium w-full"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-secondary)" }}
            >
              <LogOut size={13} />
              Log out
            </button>
          ) : (
            <button
              onClick={handleLogout}
              title="Log out"
              className="flex items-center justify-center p-1.5 rounded-md transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}
            >
              <LogOut size={13} />
            </button>
          )}
        </div>
      </aside>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setShowModal(false)} />
          <div
            className="relative rounded-xl shadow-2xl w-[320px] p-5 z-10"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          >
            <h2 className="text-[14px] font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
              {modalType === "doc" ? "New Doc" : modalType === "folder" ? "New Folder" : "New Workspace"}
            </h2>
            <div className="mb-1">
              <label className="text-[11px] font-medium uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Name</label>
              <input
                ref={modalInputRef}
                type="text"
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleModalConfirm()
                  if (e.key === "Escape") setShowModal(false)
                }}
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Cancel
              </button>
              <button
                onClick={handleModalConfirm}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                style={{ backgroundColor: "var(--text-primary)", color: "var(--bg)" }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
