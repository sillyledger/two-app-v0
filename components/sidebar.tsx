"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Search, FileText, ChevronDown, ChevronRight, Settings,
  Layers, Activity, Home, Plus, FolderOpen, MoreHorizontal,
  Pencil, Trash2, LogOut, PanelLeftClose, PanelLeftOpen, CheckSquare,
} from "lucide-react"

interface Doc { id: string; uuid: string; title: string }
interface FolderType { id: string; name: string }
interface Workspace { id: string; name: string }
interface SidebarProps { onNewNote?: () => void; collapsed?: boolean; onToggle?: () => void }

function cacheGet<T>(key: string): T | null {
  try { const raw = sessionStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null } catch { return null }
}
function cacheSet(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch {}
}

const SB = "#161618"
const ACTIVE_BG = "rgba(107,92,231,0.18)"
const ACTIVE_COLOR = "#c4b8ff"
const ITEM_COLOR = "#b0afb8"
const HOVER_BG = "rgba(255,255,255,0.07)"
const HOVER_COLOR = "#e8e7e1"
const MUTED = "#6a6a74"
const BORDER = "1px solid rgba(255,255,255,0.07)"
const FONT = "'DM Sans', system-ui, sans-serif"

export default function Sidebar({ onNewNote, collapsed = false, onToggle }: SidebarProps = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const [myDocsOpen, setMyDocsOpen] = useState(true)
  const [unfiledOpen, setUnfiledOpen] = useState(true)
  const [sharedOpen, setSharedOpen] = useState(true)
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
      const isTyping = (e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable
if (e.key === "?" && !showModal && !isTyping && !e.shiftKey) setShowHelp(v => !v)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [showModal])
  useEffect(() => {
    const handler = () => {
      if (workspaceId) fetchDocsForWorkspace(workspaceId, true)
    }
    window.addEventListener("sb-refresh", handler)
    return () => window.removeEventListener("sb-refresh", handler)
  }, [workspaceId])

  const fetchDocsForWorkspace = (wsId: string, isPrimary: boolean) => {
    fetch(`/api/docs?workspace_id=${wsId}`).then(r => r.json()).then(data => {
      const unfiled = Array.isArray(data) ? data.filter((d: any) => !d.folder_id) : []
      const sliced = unfiled.slice(0, 8)
      if (isPrimary) { setDocs(sliced); cacheSet("sb_docs", sliced) }
      else setWsData(prev => ({ ...prev, [wsId]: { docs: sliced, folders: prev[wsId]?.folders ?? [] } }))
    }).catch(() => {})
  }

  const fetchFoldersForWorkspace = (wsId: string, isPrimary: boolean) => {
    fetch(`/api/folders?workspace_id=${wsId}`).then(r => r.json()).then(data => {
      const list = Array.isArray(data) ? data : []
      if (isPrimary) { setFolders(list); cacheSet("sb_folders", list) }
      else setWsData(prev => ({ ...prev, [wsId]: { folders: list, docs: prev[wsId]?.docs ?? [] } }))
    }).catch(() => {})
  }

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(data => {
      if (data.user) {
        const name = data.user.name || data.user.email.split("@")[0]
        const avatar = data.user.avatar_url || null
        setUserName(name); setUserAvatar(avatar)
        cacheSet("sb_userName", name); cacheSet("sb_userAvatar", avatar)
      }
    }).catch(() => {})
    fetch("/api/workspace").then(r => r.json()).then(data => {
      if (data?.name) { setWorkspaceName(data.name); cacheSet("sb_workspaceName", data.name) }
      if (data?.id) {
        setWorkspaceId(data.id); setActiveWorkspaceId(data.id); cacheSet("sb_workspaceId", data.id)
        fetchDocsForWorkspace(data.id, true); fetchFoldersForWorkspace(data.id, true)
      }
    }).catch(() => {})
    fetch("/api/workspaces").then(r => r.json()).then(data => {
      const list = Array.isArray(data) ? data : []; setWorkspaces(list); cacheSet("sb_workspaces", list)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false) }
    if (showPicker) document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [showPicker])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) setFolderMenuId(null) }
    if (folderMenuId) document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [folderMenuId])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (wsMenuRef.current && !wsMenuRef.current.contains(e.target as Node)) setWsMenuId(null) }
    if (wsMenuId) document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [wsMenuId])
  useEffect(() => { if (showModal) setTimeout(() => modalInputRef.current?.focus(), 50) }, [showModal])
  useEffect(() => { if (renamingWorkspace) setTimeout(() => workspaceInputRef.current?.select(), 50) }, [renamingWorkspace])
  useEffect(() => { if (renamingFolderId) setTimeout(() => folderRenameInputRef.current?.select(), 50) }, [renamingFolderId])
  useEffect(() => { if (renamingWsId) setTimeout(() => wsRenameInputRef.current?.select(), 50) }, [renamingWsId])

  const startRenamingWorkspace = () => { setWorkspaceRenameValue(workspaceName); setRenamingWorkspace(true) }
  const commitWorkspaceRename = async () => {
    const trimmed = workspaceRenameValue.trim(); setRenamingWorkspace(false)
    if (!trimmed || trimmed === workspaceName) return
    setWorkspaceName(trimmed); cacheSet("sb_workspaceName", trimmed)
    try { await fetch("/api/workspace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: trimmed }) }) } catch {}
  }
  const cancelWorkspaceRename = () => { setRenamingWorkspace(false); setWorkspaceRenameValue("") }
  const commitExtraWsRename = async (wsId: string) => {
    const trimmed = wsRenameValue.trim(); setRenamingWsId(null); if (!trimmed) return
    const updated = workspaces.map(w => w.id === wsId ? { ...w, name: trimmed } : w)
    setWorkspaces(updated); cacheSet("sb_workspaces", updated)
    try { await fetch(`/api/workspaces/${wsId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: trimmed }) }) } catch {}
  }
  const deleteExtraWorkspace = async (wsId: string) => {
    setWsMenuId(null)
    if (!window.confirm("Delete this workspace? This cannot be undone.")) return
    try {
      const res = await fetch(`/api/workspaces/${wsId}`, { method: "DELETE" })
      if (!res.ok) { alert("Failed to delete workspace."); return }
      const updated = workspaces.filter(w => w.id !== wsId); setWorkspaces(updated); cacheSet("sb_workspaces", updated)
      if (activeWorkspaceId === wsId) setActiveWorkspaceId(workspaceId)
    } catch { alert("Something went wrong.") }
  }
  const startRenamingFolder = (folder: FolderType) => { setFolderMenuId(null); setFolderRenameValue(folder.name); setRenamingFolderId(folder.id) }
  const commitFolderRename = async (folderId: string) => {
    const trimmed = folderRenameValue.trim(); setRenamingFolderId(null); if (!trimmed) return
    const updated = folders.map(f => f.id === folderId ? { ...f, name: trimmed } : f)
    setFolders(updated); cacheSet("sb_folders", updated)
    try { await fetch(`/api/folders/${folderId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: trimmed }) }) } catch {}
  }
  const deleteFolder = async (folderId: string) => {
    setFolderMenuId(null)
    const updated = folders.filter(f => f.id !== folderId); setFolders(updated); cacheSet("sb_folders", updated)
    try { await fetch(`/api/folders/${folderId}`, { method: "DELETE" }) } catch {}
  }
  const handleLogout = async () => { sessionStorage.clear(); await fetch("/api/auth", { method: "DELETE" }); router.push("/login") }
  const handleDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault(); e.stopPropagation()
    const docId = e.dataTransfer.getData("docId"); if (!docId) return
    setDragOverFolderId(null); setDraggingDocId(null)
    try {
      const res = await fetch(`/api/docs/${docId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder_id: folderId }) })
      if (res.ok) { if (workspaceId) fetchDocsForWorkspace(workspaceId, true); setDocs(prev => prev.filter(d => d.uuid !== docId)) }
    } catch {}
  }
  const initial = userName ? userName.charAt(0).toUpperCase() : "?"
  const openModal = (type: "doc" | "folder" | "workspace", targetWsId?: string) => {
    setShowPicker(false); setModalType(type); setModalTargetWorkspaceId(targetWsId ?? activeWorkspaceId)
    setModalName(type === "doc" ? "Untitled" : type === "folder" ? "New Folder" : "New Workspace"); setShowModal(true)
  }
  const handleModalConfirm = async () => {
    if (!modalName.trim()) return; setShowModal(false)
    if (modalType === "doc") {
      setCreating(true)
      try {
        const res = await fetch("/api/docs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: modalName, content: "", color: "yellow", type: "doc", workspace_id: modalTargetWorkspaceId }) })
        const doc = await res.json()
        if (modalTargetWorkspaceId && modalTargetWorkspaceId !== workspaceId) fetchDocsForWorkspace(modalTargetWorkspaceId, false)
        else if (workspaceId) fetchDocsForWorkspace(workspaceId, true)
        router.push(`/docs/${doc.uuid}`)
      } finally { setCreating(false) }
    }
    if (modalType === "folder") {
      const targetId = modalTargetWorkspaceId ?? workspaceId; if (!targetId) return
      try {
        const res = await fetch("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: modalName, workspace_id: targetId }) })
        const folder = await res.json()
        if (targetId !== workspaceId) fetchFoldersForWorkspace(targetId, false)
        else { const updated = [...folders, folder]; setFolders(updated); cacheSet("sb_folders", updated) }
      } catch {}
    }
    if (modalType === "workspace") {
      try {
        const res = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: modalName }) })
        const workspace = await res.json()
        const updated = [...workspaces, workspace]; setWorkspaces(updated); cacheSet("sb_workspaces", updated)
      } catch {}
    }
  }
  const toggleExtraWorkspace = (wsId: string) => {
    const isExpanding = !expandedWorkspaces[wsId]; setExpandedWorkspaces(prev => ({ ...prev, [wsId]: isExpanding }))
    if (isExpanding && !wsData[wsId]) { fetchDocsForWorkspace(wsId, false); fetchFoldersForWorkspace(wsId, false) }
  }

  const extraWorkspaces = workspaces.filter(w => w.id !== workspaceId)

  // ── Shared styles ──
  const dropdownStyle: React.CSSProperties = {
    position: "absolute", right: 0, top: 30, zIndex: 50,
    borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    width: 148, padding: "4px 0", overflow: "hidden",
    background: "#242428", border: "1px solid rgba(255,255,255,0.09)",
  }
  const dropdownBtn = (danger = false): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
    fontSize: 13, color: danger ? "#f87171" : "#8a8a92",
    background: "transparent", border: "none", cursor: "pointer", fontFamily: FONT, textAlign: "left",
  })

  // ── Nav item (primary) ──
  const NavItem = ({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) => {
    const isActive = pathname === href
    const [hov, setHov] = useState(false)
    return (
      <Link href={href}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: collapsed ? "9px 0" : "9px 12px", justifyContent: collapsed ? "center" : "flex-start", borderRadius: 9, marginBottom: 2, fontSize: 14, fontWeight: isActive ? 500 : 400, letterSpacing: "-0.01em", color: isActive ? ACTIVE_COLOR : hov ? HOVER_COLOR : ITEM_COLOR, background: isActive ? ACTIVE_BG : hov ? HOVER_BG : "transparent", textDecoration: "none", position: "relative", transition: "background 0.12s, color 0.12s", fontFamily: FONT }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      >
        {isActive && !collapsed && <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, background: "#6b5ce7", borderRadius: "0 3px 3px 0" }} />}
        <span style={{ opacity: isActive ? 1 : 0.65, display: "flex", flexShrink: 0 }}>{icon}</span>
        {!collapsed && label}
      </Link>
    )
  }

  // ── Bottom button ──
  const BotBtn = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) => {
    const [hov, setHov] = useState(false)
    return (
      <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: collapsed ? "9px 0" : "9px 12px", justifyContent: collapsed ? "center" : "flex-start", borderRadius: 9, marginBottom: 2, fontSize: 14, fontWeight: 400, letterSpacing: "-0.01em", color: hov ? HOVER_COLOR : ITEM_COLOR, background: hov ? HOVER_BG : "transparent", border: "none", cursor: "pointer", width: "100%", fontFamily: FONT, transition: "background 0.12s, color 0.12s" }}
      >
        <span style={{ opacity: 0.65, display: "flex", flexShrink: 0 }}>{icon}</span>
        {!collapsed && label}
      </button>
    )
  }

  // ── Avatar ──
  const AvatarBubble = () => (
    <div style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
      {userAvatar
        ? <img src={userAvatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#f59e0b,#ef4444)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{initial}</span>
          </div>
      }
    </div>
  )

  const sidebarWidth = collapsed ? 56 : 256

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        .sb-scroll { flex: 1; overflow-y: auto; scrollbar-width: none; padding: 8px 8px; }
        .sb-scroll::-webkit-scrollbar { display: none; }
        .sb-group:hover .sb-group-btn { opacity: 1 !important; }
      `}</style>

      <aside style={{ width: sidebarWidth, minWidth: sidebarWidth, height: "100vh", display: "flex", flexDirection: "column", position: "sticky", top: 0, overflow: "hidden", flexShrink: 0, background: SB, borderRight: BORDER, transition: "width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)", fontFamily: FONT }}>

        {/* ── Header ── */}
        {collapsed ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0 12px", gap: 12, borderBottom: BORDER, flexShrink: 0 }}>
            <AvatarBubble />
            <button onClick={() => { localStorage.setItem("sidebar-collapsed", "false"); onToggle?.() }}
              style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 4, display: "flex" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ccc")} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
              <PanelLeftOpen size={16} />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 14px 16px", borderBottom: BORDER, flexShrink: 0 }}>
            <AvatarBubble />
            <span style={{ fontSize: 15, fontWeight: 600, color: "#eeede7", letterSpacing: "-0.02em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName || "…"}</span>
            <button onClick={() => { localStorage.setItem("sidebar-collapsed", "true"); onToggle?.() }}
              style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 4, flexShrink: 0, display: "flex" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ccc")} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
              <PanelLeftClose size={15} />
            </button>
          </div>
        )}

        {/* ── Search ── */}
        {!collapsed && (
          <div style={{ padding: "12px 10px 6px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", borderRadius: 9, padding: "8px 12px" }}>
              <Search size={13} style={{ color: MUTED, flexShrink: 0 }} />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ background: "transparent", border: "none", outline: "none", fontSize: 13.5, color: ITEM_COLOR, width: "100%", fontFamily: FONT }} />
            </div>
          </div>
        )}

        {/* ── Scrollable nav ── */}
        <div className="sb-scroll">

          {/* Primary nav */}
          <NavItem href="/" icon={<span style={{fontSize:17,lineHeight:1}}>⌂</span>} label="Home" />
          <NavItem href="/planner" icon={<span style={{fontSize:15,lineHeight:1}}>◎</span>} label="Planner" />
          <NavItem href="/activity" icon={<span style={{fontSize:15,lineHeight:1}}>⟳</span>} label="Activity" />
          <NavItem href="/library" icon={<span style={{fontSize:15,lineHeight:1}}>◫</span>} label="Library" />

          {!collapsed && (
            <>
              {/* ── Divider ── */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "10px 4px" }} />

              {/* ── My Workspace header ── */}
              <div
                style={{ display: "flex", alignItems: "center", padding: "6px 12px 4px", cursor: "pointer" }}
                onClick={() => { if (!renamingWorkspace) setMyDocsOpen(v => !v) }}
              >
                {/* Left arrow — same pattern as Shared Workspaces */}
                <span style={{ fontSize: 9, color: MUTED, marginRight: 6, display: "inline-block", transform: myDocsOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.18s", flexShrink: 0 }}>▶</span>
                <span style={{ opacity: 0.5, fontSize: 15, flexShrink: 0, marginRight: 8 }}>☁</span>
                {renamingWorkspace
                  ? <input ref={workspaceInputRef} value={workspaceRenameValue} onChange={e => setWorkspaceRenameValue(e.target.value)} onBlur={commitWorkspaceRename} onKeyDown={e => { if (e.key === "Enter") commitWorkspaceRename(); if (e.key === "Escape") cancelWorkspaceRename() }} onClick={e => e.stopPropagation()}
                      style={{ flex: 1, minWidth: 0, borderRadius: 6, padding: "2px 8px", fontSize: 13, outline: "none", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#e0dfd9", fontFamily: FONT }} />
                  : <span onDoubleClick={e => { e.stopPropagation(); startRenamingWorkspace() }} title="Double-click to rename" style={{ flex: 1, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, userSelect: "none" }}>{workspaceName}</span>
                }
                {/* + button — right side, well separated */}
                <div style={{ position: "relative", marginLeft: 8, flexShrink: 0 }} ref={pickerRef}>
                  <button onClick={e => { e.stopPropagation(); setShowPicker(v => !v) }} disabled={creating}
                    style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 2, display: "flex" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#888")} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
                    <Plus size={13} />
                  </button>
                  {showPicker && (
                    <div style={dropdownStyle}>
                      <button style={dropdownBtn()} onClick={() => openModal("doc", workspaceId ?? undefined)} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><span style={{fontSize:13}}>▣</span> New Doc</button>
                      <button style={dropdownBtn()} onClick={() => openModal("folder", workspaceId ?? undefined)} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><FolderOpen size={12} style={{ color: "#888" }} /> New Folder</button>
                    </div>
                  )}
                </div>
              </div>

              {myDocsOpen && (
                <>
                  {/* Folders */}
                  {folders.map(folder => {
                    const isActive = pathname === `/folders/${folder.id}`
                    const isDragOver = dragOverFolderId === folder.id
                    return (
                      <div key={folder.id} className="sb-group"
                        style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px 7px 16px", borderRadius: 8, fontSize: 13.5, cursor: "pointer", color: isActive || isDragOver ? HOVER_COLOR : "#5a5a64", background: isActive || isDragOver ? HOVER_BG : "transparent", transition: "all 0.12s", marginBottom: 1 }}
                        onMouseEnter={e => { e.currentTarget.style.background = HOVER_BG; e.currentTarget.style.color = HOVER_COLOR }}
                        onMouseLeave={e => { e.currentTarget.style.background = isActive ? HOVER_BG : "transparent"; e.currentTarget.style.color = isActive ? HOVER_COLOR : "#5a5a64" }}
                        onClick={() => { if (renamingFolderId !== folder.id) router.push(`/folders/${folder.id}?name=${encodeURIComponent(folder.name)}`) }}
                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverFolderId(folder.id) }}
                        onDragLeave={e => { e.stopPropagation(); setDragOverFolderId(null) }}
                        onDrop={e => handleDrop(e, folder.id)}
                      >
                        <FolderOpen size={14} style={{ color: "#4a4a56", flexShrink: 0 }} />
                        {renamingFolderId === folder.id
                          ? <input ref={folderRenameInputRef} value={folderRenameValue} onChange={e => setFolderRenameValue(e.target.value)} onBlur={() => commitFolderRename(folder.id)} onKeyDown={e => { if (e.key === "Enter") commitFolderRename(folder.id); if (e.key === "Escape") setRenamingFolderId(null) }} onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 0, borderRadius: 6, padding: "2px 8px", fontSize: 13, outline: "none", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#e0dfd9", fontFamily: FONT }} />
                          : <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.name}</span>
                        }
                        {renamingFolderId !== folder.id && (
                          <div style={{ position: "relative" }} ref={folderMenuId === folder.id ? folderMenuRef : undefined}>
                            <button className="sb-group-btn" onClick={e => { e.stopPropagation(); setFolderMenuId(folderMenuId === folder.id ? null : folder.id) }}
                              style={{ opacity: 0, color: "#555", background: "none", border: "none", cursor: "pointer", padding: 2, borderRadius: 4, display: "flex", transition: "opacity 0.1s" }}>
                              <MoreHorizontal size={13} />
                            </button>
                            {folderMenuId === folder.id && (
                              <div style={dropdownStyle}>
                                <button style={dropdownBtn()} onClick={e => { e.stopPropagation(); startRenamingFolder(folder) }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><Pencil size={12} style={{ color: "#555" }} /> Rename</button>
                                <button style={dropdownBtn(true)} onClick={e => { e.stopPropagation(); deleteFolder(folder.id) }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><Trash2 size={12} /> Delete</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Unfiled label — collapsible */}
                  {docs.length > 0 && (
                    <div onClick={() => setUnfiledOpen(v => !v)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "10px 12px 4px", cursor: "pointer", userSelect: "none" }}>
                      <span style={{ fontSize: 9, color: MUTED, display: "inline-block", transform: unfiledOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.18s" }}>▶</span>
                      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED }}>Unfiled</span>
                    </div>
                  )}

                  {/* Unfiled docs */}
                  {unfiledOpen && docs.map(doc => {
                    const isActive = pathname === `/docs/${doc.uuid}`
                    return (
                      <div key={doc.uuid} draggable
                        onDragStart={e => { e.dataTransfer.setData("docId", String(doc.uuid)); e.dataTransfer.effectAllowed = "move"; setDraggingDocId(doc.uuid) }}
                        onDragEnd={() => { setDraggingDocId(null); setDragOverFolderId(null) }}
                        onClick={() => router.push(`/docs/${doc.uuid}`)}
                        className="sb-group"
                        style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 10px 6px 20px", borderRadius: 7, fontSize: 13.5, cursor: "pointer", opacity: draggingDocId === doc.uuid ? 0.4 : 1, color: isActive ? ACTIVE_COLOR : ITEM_COLOR, background: isActive ? ACTIVE_BG : "transparent", transition: "all 0.12s", marginBottom: 1 }}
                        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = HOVER_BG; e.currentTarget.style.color = HOVER_COLOR } }}
                        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = ITEM_COLOR } }}
                      >
                        <span style={{ fontSize: 13, opacity: isActive ? 1 : 0.5, flexShrink: 0, lineHeight: 1 }}>▣</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title || "Untitled"}</span>
                      </div>
                    )
                  })}

                  {folders.length === 0 && docs.length === 0 && (
                    <p style={{ fontSize: 12, padding: "4px 12px", color: MUTED }}>No docs yet</p>
                  )}
                </>
              )}

              {/* ── Divider ── */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "10px 4px" }} />

              {/* ── SHARED WORKSPACES ── */}
              <div style={{ display: "flex", alignItems: "center", padding: "6px 12px 4px", cursor: "pointer" }} onClick={() => setSharedOpen(v => !v)}>
                <span style={{ fontSize: 9, color: MUTED, marginRight: 5, display: "inline-block", transform: sharedOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.18s" }}>▶</span>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, flex: 1 }}>Shared Workspaces</span>
                <button onClick={e => { e.stopPropagation(); openModal("workspace") }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 2, display: "flex" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#888")} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
                  <Plus size={13} />
                </button>
              </div>

              {sharedOpen && extraWorkspaces.map(ws => (
                <div key={ws.id} style={{ marginBottom: 2 }}>
                  <div className="sb-group" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontSize: 13.5, color: "#5a5a64", transition: "all 0.12s" }}
                    onClick={() => toggleExtraWorkspace(ws.id)}
                    onMouseEnter={e => { e.currentTarget.style.background = HOVER_BG; e.currentTarget.style.color = HOVER_COLOR }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#5a5a64" }}
                  >
                    {expandedWorkspaces[ws.id] ? <ChevronDown size={12} style={{ color: MUTED, flexShrink: 0 }} /> : <ChevronRight size={12} style={{ color: MUTED, flexShrink: 0 }} />}
                    {renamingWsId === ws.id
                      ? <input ref={wsRenameInputRef} value={wsRenameValue} onChange={e => setWsRenameValue(e.target.value)} onBlur={() => commitExtraWsRename(ws.id)} onKeyDown={e => { if (e.key === "Enter") commitExtraWsRename(ws.id); if (e.key === "Escape") setRenamingWsId(null) }} onClick={e => e.stopPropagation()} style={{ flex: 1, minWidth: 0, borderRadius: 6, padding: "2px 8px", fontSize: 13, outline: "none", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#e0dfd9", fontFamily: FONT }} />
                      : <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ws.name}</span>
                    }
                    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      <button className="sb-group-btn" onClick={e => { e.stopPropagation(); openModal("doc", ws.id) }} style={{ opacity: 0, background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 2, display: "flex", transition: "opacity 0.1s" }} onMouseEnter={e => (e.currentTarget.style.color = "#888")} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}><Plus size={12} /></button>
                      <div style={{ position: "relative" }} ref={wsMenuId === ws.id ? wsMenuRef : undefined}>
                        <button className="sb-group-btn" onClick={e => { e.stopPropagation(); setWsMenuId(wsMenuId === ws.id ? null : ws.id) }} style={{ opacity: 0, background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 2, display: "flex", borderRadius: 4, transition: "opacity 0.1s" }} onMouseEnter={e => (e.currentTarget.style.color = "#888")} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}><MoreHorizontal size={12} /></button>
                        {wsMenuId === ws.id && (
                          <div style={dropdownStyle}>
                            <button style={dropdownBtn()} onClick={e => { e.stopPropagation(); setWsMenuId(null); setWsRenameValue(ws.name); setRenamingWsId(ws.id) }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><Pencil size={12} style={{ color: "#555" }} /> Rename</button>
                            <button style={dropdownBtn()} onClick={e => { e.stopPropagation(); openModal("folder", ws.id); setWsMenuId(null) }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><FolderOpen size={12} style={{ color: "#555" }} /> New Folder</button>
                            <button style={dropdownBtn(true)} onClick={e => { e.stopPropagation(); deleteExtraWorkspace(ws.id) }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><Trash2 size={12} /> Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedWorkspaces[ws.id] && (
                    <div style={{ paddingLeft: 8 }}>
                      {(wsData[ws.id]?.folders ?? []).map(f => (
                        <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px 7px 16px", borderRadius: 8, fontSize: 13.5, cursor: "pointer", color: "#5a5a64", marginBottom: 1, transition: "all 0.12s" }}
                          onMouseEnter={e => { e.currentTarget.style.background = HOVER_BG; e.currentTarget.style.color = HOVER_COLOR }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#5a5a64" }}
                          onClick={() => router.push(`/folders/${f.id}?name=${encodeURIComponent(f.name)}`)}>
                          <FolderOpen size={13} style={{ color: "#4a4a56", flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        </div>
                      ))}
                      {(wsData[ws.id]?.docs ?? []).map(doc => (
                        <div key={doc.uuid} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 10px 6px 20px", borderRadius: 7, fontSize: 13, cursor: "pointer", color: "#4a4a54", marginBottom: 1, transition: "all 0.12s" }}
                          onMouseEnter={e => { e.currentTarget.style.background = HOVER_BG; e.currentTarget.style.color = "#a0a0aa" }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4a4a54" }}
                          onClick={() => router.push(`/docs/${doc.uuid}`)}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#3a3a44", flexShrink: 0, display: "inline-block" }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title || "Untitled"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {sharedOpen && extraWorkspaces.length === 0 && (
                <p style={{ fontSize: 12, padding: "4px 12px", color: MUTED }}>No shared workspaces yet</p>
              )}
            </>
          )}
        </div>

        {/* ── Bottom ── */}
        <div style={{ borderTop: BORDER, padding: "8px 8px 14px", flexShrink: 0 }}>
          <NavItem href="/settings" icon={<Settings size={16} />} label="Settings" />
          {!collapsed && <NavItem href="/trash" icon={<Trash2 size={16} />} label="Trash" />}
          {!collapsed && (
            <BotBtn icon={<span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)", fontSize: 10, fontFamily: "monospace", color: "#4a4a56" }}>?</span>} label="Help & Shortcuts" onClick={() => { setHelpTab("shortcuts"); setShowHelp(true) }} />
          )}

          <BotBtn icon={<LogOut size={16} />} label="Log out" onClick={handleLogout} />
        </div>
      </aside>

      {/* ── Modal ── */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)" }} onClick={() => setShowModal(false)} />
          <div style={{ position: "relative", borderRadius: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", width: 320, padding: "22px 22px 18px", zIndex: 10, background: "#1c1c1f", border: "1px solid rgba(255,255,255,0.09)", fontFamily: FONT }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "#eeede7", letterSpacing: "-0.01em" }}>{modalType === "doc" ? "New Doc" : modalType === "folder" ? "New Folder" : "New Workspace"}</h2>
            <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED, display: "block", marginBottom: 6 }}>Name</label>
            <input ref={modalInputRef} type="text" value={modalName} onChange={e => setModalName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleModalConfirm(); if (e.key === "Escape") setShowModal(false) }}
              style={{ width: "100%", borderRadius: 9, padding: "9px 12px", fontSize: 13.5, outline: "none", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e0dfd9", fontFamily: FONT, boxSizing: "border-box" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "#5a5a62", background: "transparent", border: "none", cursor: "pointer", fontFamily: FONT }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>Cancel</button>
              <button onClick={handleModalConfirm} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", background: "#6b5ce7", border: "none", cursor: "pointer", fontFamily: FONT }} onMouseEnter={e => (e.currentTarget.style.background = "#7c6ef0")} onMouseLeave={e => (e.currentTarget.style.background = "#6b5ce7")}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Help modal ── */}
      {showHelp && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)" }} onClick={() => setShowHelp(false)} />
          <div style={{ position: "relative", borderRadius: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", width: 500, maxWidth: "calc(100vw - 32px)", zIndex: 10, overflow: "hidden", background: "#1c1c1f", border: "1px solid rgba(255,255,255,0.09)", fontFamily: FONT }}>
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {(["shortcuts", "started", "tips", "new"] as const).map(tab => (
                <button key={tab} onClick={() => setHelpTab(tab)} style={{ padding: "10px 14px", fontSize: 12, fontWeight: 500, background: "none", border: "none", cursor: "pointer", borderBottom: helpTab === tab ? "2px solid #e0dfd9" : "2px solid transparent", color: helpTab === tab ? "#e0dfd9" : MUTED, fontFamily: FONT, transition: "color 0.12s" }}>
                  {tab === "shortcuts" && "Shortcuts"}{tab === "started" && "Getting Started"}{tab === "tips" && "Tips"}{tab === "new" && "What's New"}
                </button>
              ))}
              <button onClick={() => setShowHelp(false)} style={{ marginLeft: "auto", padding: "8px 14px", fontSize: 13, color: MUTED, background: "none", border: "none", cursor: "pointer" }} onMouseEnter={e => (e.currentTarget.style.color = "#aaa")} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>✕</button>
            </div>
            <div style={{ overflowY: "auto", maxHeight: 380 }}>
              {helpTab === "shortcuts" && (
                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
                  {[{ label: "Formatting", rows: [{ action: "Bold", keys: ["⌘","B"] }, { action: "Italic", keys: ["⌘","I"] }, { action: "Strikethrough", keys: ["⌘","⇧","S"] }, { action: "Inline code", keys: ["⌘","E"] }, { action: "Heading 1 / 2 / 3", keys: ["⌘","⌥","1–3"] }] }, { label: "Navigation", rows: [{ action: "New doc", keys: ["⌘","N"] }, { action: "Search", keys: ["⌘","K"] }, { action: "Toggle sidebar", keys: ["⌘","\\"] }, { action: "Open help", keys: ["?"] }] }].map(section => (
                    <div key={section.label}>
                      <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 8 }}>{section.label}</p>
                      {section.rows.map(row => (
                        <div key={row.action} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <span style={{ fontSize: 12, color: ITEM_COLOR }}>{row.action}</span>
                          <div style={{ display: "flex", gap: 4 }}>{row.keys.map(k => <kbd key={k} style={{ fontFamily: "monospace", fontSize: 11, padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#c0bfba" }}>{k}</kbd>)}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {helpTab === "started" && (
                <div style={{ padding: 20 }}>
                  {[{ n: 1, title: "Create your first doc", desc: "Press ⌘N or tap + in the sidebar to create a new doc instantly." }, { n: 2, title: "Format as you write", desc: "Select any text to reveal the formatting toolbar." }, { n: 3, title: "Find anything fast", desc: "Press ⌘K to search across all your docs instantly." }, { n: 4, title: "Your docs save automatically", desc: "Every change is saved in the background — no manual saving needed." }].map(step => (
                    <div key={step.n} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: "monospace", color: MUTED, flexShrink: 0, marginTop: 2 }}>{step.n}</div>
                      <div><p style={{ fontSize: 12, fontWeight: 500, color: "#e0dfd9", marginBottom: 4 }}>{step.title}</p><p style={{ fontSize: 12, lineHeight: 1.6, color: "#4a4a52" }}>{step.desc}</p></div>
                    </div>
                  ))}
                </div>
              )}
              {helpTab === "tips" && (
                <div style={{ padding: 20 }}>
                  {[{ title: "Use headings to create structure", desc: "Break long docs into sections with H1, H2, and H3." }, { title: "Code blocks for technical notes", desc: "Wrap commands or config values in a code block." }, { title: "Keep one doc per topic", desc: "Short focused docs are easier to find and reference." }, { title: "Blockquotes for highlights", desc: "Use blockquotes to call out key decisions or quotes." }].map(tip => (
                    <div key={tip.title} style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "#e0dfd9", marginBottom: 4 }}>{tip.title}</p>
                      <p style={{ fontSize: 12, lineHeight: 1.6, color: "#4a4a52" }}>{tip.desc}</p>
                    </div>
                  ))}
                </div>
              )}
              {helpTab === "new" && (
                <div style={{ padding: 20 }}>
                  {[{ version: "v0.4", date: "May 2026", tag: "Latest", items: ["Notes scoped per user", "Autosave with Saved indicator", "Search bar with autocomplete"] }, { version: "v0.3", date: "Apr 2026", tag: null, items: ["Rich text editor with toolbar", "Heading levels H1–H3", "Code blocks and inline code"] }, { version: "v0.2", date: "Mar 2026", tag: null, items: ["Auth system — signup, login, logout", "Sidebar with settings and avatar"] }].map(release => (
                    <div key={release.version} style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 500, color: "#e0dfd9" }}>{release.version}</span>
                        <span style={{ fontSize: 11, color: MUTED }}>{release.date}</span>
                        {release.tag && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: ITEM_COLOR }}>{release.tag}</span>}
                      </div>
                      {release.items.map(item => <p key={item} style={{ fontSize: 12, lineHeight: 1.6, color: "#4a4a52", paddingLeft: 12, position: "relative" }}><span style={{ position: "absolute", left: 0, color: "#2a2a32" }}>–</span>{item}</p>)}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: "10px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: MUTED }}>Press</span>
              <kbd style={{ fontFamily: "monospace", fontSize: 10, padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#c0bfba" }}>?</kbd>
              <span style={{ fontSize: 11, color: MUTED }}>or</span>
              <kbd style={{ fontFamily: "monospace", fontSize: 10, padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#c0bfba" }}>Esc</kbd>
              <span style={{ fontSize: 11, color: MUTED }}>to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
