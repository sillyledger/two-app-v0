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
  BookOpen,
  Activity,
  Home,
  Plus,
  Folder,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"

interface Doc {
  id: string
  title: string
}

interface FolderType {
  id: string
  name: string
}

interface SidebarProps {
  onNewNote?: () => void
}

export default function Sidebar({ onNewNote }: SidebarProps = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const [workspaceOpen, setWorkspaceOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [workspaceName, setWorkspaceName] = useState("My Workspace")
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [docs, setDocs] = useState<Doc[]>([])
  const [folders, setFolders] = useState<FolderType[]>([])
  const [creating, setCreating] = useState(false)

  // Rename workspace
  const [renamingWorkspace, setRenamingWorkspace] = useState(false)
  const [workspaceRenameValue, setWorkspaceRenameValue] = useState("")
  const workspaceInputRef = useRef<HTMLInputElement>(null)

  // Folder three-dot menu
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null)
  const folderMenuRef = useRef<HTMLDivElement>(null)

  // Folder rename
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [folderRenameValue, setFolderRenameValue] = useState("")
  const folderRenameInputRef = useRef<HTMLInputElement>(null)

  // Picker (the + dropdown)
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<"doc" | "folder">("doc")
  const [modalName, setModalName] = useState("")
  const modalInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUserName(data.user.name || data.user.email.split("@")[0])
          setUserEmail(data.user.email)
        }
      })
      .catch(() => {})

    fetch("/api/workspace")
      .then((r) => r.json())
      .then((data) => {
        if (data?.name) setWorkspaceName(data.name)
        if (data?.id) setWorkspaceId(data.id)
      })
      .catch(() => {})

    fetch("/api/docs")
      .then((r) => r.json())
      .then((data) => {
        setDocs(Array.isArray(data) ? data.slice(0, 8) : [])
      })
      .catch(() => {})

    fetch("/api/folders")
      .then((r) => r.json())
      .then((data) => {
        setFolders(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
  }, [])

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    if (showPicker) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showPicker])

  // Close folder menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) {
        setFolderMenuId(null)
      }
    }
    if (folderMenuId) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [folderMenuId])

  useEffect(() => {
    if (showModal) setTimeout(() => modalInputRef.current?.focus(), 50)
  }, [showModal])

  useEffect(() => {
    if (renamingWorkspace) setTimeout(() => workspaceInputRef.current?.select(), 50)
  }, [renamingWorkspace])

  useEffect(() => {
    if (renamingFolderId) setTimeout(() => folderRenameInputRef.current?.select(), 50)
  }, [renamingFolderId])

  const startRenamingWorkspace = () => {
    setWorkspaceRenameValue(workspaceName)
    setRenamingWorkspace(true)
  }

  const commitWorkspaceRename = async () => {
    const trimmed = workspaceRenameValue.trim()
    setRenamingWorkspace(false)
    if (!trimmed || trimmed === workspaceName) return
    setWorkspaceName(trimmed)
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

  const startRenamingFolder = (folder: FolderType) => {
    setFolderMenuId(null)
    setFolderRenameValue(folder.name)
    setRenamingFolderId(folder.id)
  }

  const commitFolderRename = async (folderId: string) => {
    const trimmed = folderRenameValue.trim()
    setRenamingFolderId(null)
    if (!trimmed) return
    setFolders((prev) => prev.map((f) => f.id === folderId ? { ...f, name: trimmed } : f))
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
    setFolders((prev) => prev.filter((f) => f.id !== folderId))
    try {
      await fetch(`/api/folders/${folderId}`, { method: "DELETE" })
    } catch {}
  }

  const initial = userName ? userName.charAt(0).toUpperCase() : "?"

  const openModal = (type: "doc" | "folder") => {
    setShowPicker(false)
    setModalType(type)
    setModalName(type === "doc" ? "Untitled" : "New Folder")
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
          body: JSON.stringify({ title: modalName, content: "", color: "yellow", type: "doc" }),
        })
        const doc = await res.json()
        setDocs((prev) => [doc, ...prev])
        router.push(`/docs/${doc.id}`)
      } finally {
        setCreating(false)
      }
    }

    if (modalType === "folder" && workspaceId) {
      try {
        const res = await fetch("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: modalName, workspace_id: workspaceId }),
        })
        const folder = await res.json()
        setFolders((prev) => [...prev, folder])
      } catch {}
    }
  }

  const navItem = (href: string, icon: React.ReactNode, label: string) => (
    <Link
      href={href}
      className={`flex items-center gap-2 px-2 py-[5px] rounded-md mb-[1px] transition-colors text-[12px] font-medium ${
        pathname === href
          ? "bg-[#2a2a2a] text-[#e8e8e8]"
          : "text-[#888] hover:bg-[#2a2a2a] hover:text-[#e8e8e8]"
      }`}
    >
      {icon}
      {label}
    </Link>
  )

  return (
    <>
      <aside className="w-[210px] min-w-[210px] h-screen flex flex-col bg-[#1f1f1f] border-r border-[#2a2a2a]">

        {/* Top — User */}
        <div className="flex items-center gap-2 px-3 pt-4 pb-2.5">
          <div className="w-5 h-5 rounded-md bg-[#e8e8e8] flex items-center justify-center shrink-0">
            <span className="text-[#1a1a1a] text-[10px] font-bold">T</span>
          </div>
          <span className="font-semibold text-[13px] text-[#e8e8e8] truncate">
            {userName || "..."}
          </span>
          <ChevronDown size={12} className="text-[#555] ml-auto shrink-0" />
        </div>

        {/* Search */}
        <div className="px-2 mb-2">
          <div className="flex items-center gap-2 bg-[#2a2a2a] rounded-md px-2.5 py-[6px]">
            <Search size={12} className="text-[#555] shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[12px] text-[#ccc] placeholder-[#555] outline-none w-full"
            />
          </div>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 px-2 overflow-y-auto mt-0.5">

          {navItem("/", <Home size={13} />, "Home")}
          {navItem("/activity", <Activity size={13} />, "Activity")}
          {navItem("/library", <BookOpen size={13} />, "Library")}

          <div className="my-2 border-t border-[#2a2a2a]" />

          {/* Workspace Header */}
          <div className="flex items-center justify-between px-2 py-[4px] mb-0.5">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <button
                onClick={() => setWorkspaceOpen(!workspaceOpen)}
                className="text-[#555] hover:text-[#aaa] transition-colors shrink-0"
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
                  className="flex-1 min-w-0 bg-[#2a2a2a] border border-[#444] rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#aaa] outline-none focus:border-[#666]"
                />
              ) : (
                <span
                  onDoubleClick={startRenamingWorkspace}
                  title="Double-click to rename"
                  className="text-[10px] font-semibold uppercase tracking-wider text-[#555] truncate cursor-default select-none hover:text-[#777] transition-colors"
                >
                  {workspaceName}
                </span>
              )}
            </div>

            {/* + button with picker */}
            <div className="relative ml-1 shrink-0" ref={pickerRef}>
              <button
                onClick={() => setShowPicker((v) => !v)}
                disabled={creating}
                className="text-[#555] hover:text-[#e8e8e8] transition-colors"
                title="New Doc or Folder"
              >
                <Plus size={13} />
              </button>

              {showPicker && (
                <div className="absolute right-0 top-5 z-50 bg-[#242424] border border-[#333] rounded-lg shadow-xl w-[140px] py-1 overflow-hidden">
                  <button
                    onClick={() => openModal("doc")}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-[#ccc] hover:bg-[#2a2a2a] hover:text-[#e8e8e8] transition-colors"
                  >
                    <FileText size={12} className="text-[#666]" />
                    New Doc
                  </button>
                  <button
                    onClick={() => openModal("folder")}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-[#ccc] hover:bg-[#2a2a2a] hover:text-[#e8e8e8] transition-colors"
                  >
                    <Folder size={12} className="text-[#666]" />
                    New Folder
                  </button>
                </div>
              )}
            </div>
          </div>

          {workspaceOpen && (
            <div className="space-y-[1px]">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className={`group relative flex items-center gap-2 px-2 py-[5px] rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                    pathname === `/folders/${folder.id}`
                      ? "bg-[#2a2a2a] text-[#e8e8e8]"
                      : "text-[#888] hover:bg-[#2a2a2a] hover:text-[#e8e8e8]"
                  }`}
                  onClick={() => {
                    if (renamingFolderId !== folder.id) {
                      router.push(`/folders/${folder.id}`)
                    }
                  }}
                >
                  <Folder size={13} className="shrink-0 text-[#555]" />

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
                      className="flex-1 min-w-0 bg-[#333] border border-[#444] rounded px-1.5 py-0.5 text-[12px] text-[#e8e8e8] outline-none focus:border-[#666]"
                    />
                  ) : (
                    <span className="truncate flex-1">{folder.name}</span>
                  )}

                  {/* Three-dot menu button */}
                  {renamingFolderId !== folder.id && (
                    <div
                      className="relative"
                      ref={folderMenuId === folder.id ? folderMenuRef : undefined}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setFolderMenuId(folderMenuId === folder.id ? null : folder.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#3a3a3a] text-[#666] hover:text-[#e8e8e8] transition-all"
                      >
                        <MoreHorizontal size={13} />
                      </button>

                      {folderMenuId === folder.id && (
                        <div className="absolute right-0 top-6 z-50 bg-[#242424] border border-[#333] rounded-lg shadow-xl w-[140px] py-1 overflow-hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startRenamingFolder(folder)
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-[#ccc] hover:bg-[#2a2a2a] hover:text-[#e8e8e8] transition-colors"
                          >
                            <Pencil size={12} className="text-[#666]" />
                            Rename
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteFolder(folder.id)
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-red-400 hover:bg-[#2a2a2a] hover:text-red-300 transition-colors"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {docs.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/docs/${doc.id}`}
                  className={`flex items-center gap-2 px-2 py-[5px] rounded-md transition-colors text-[12px] font-medium ${
                    pathname === `/docs/${doc.id}`
                      ? "bg-[#2a2a2a] text-[#e8e8e8]"
                      : "text-[#888] hover:bg-[#2a2a2a] hover:text-[#e8e8e8]"
                  }`}
                >
                  <FileText size={13} className="shrink-0 text-[#555]" />
                  <span className="truncate">{doc.title || "Untitled"}</span>
                </Link>
              ))}

              {folders.length === 0 && docs.length === 0 && (
                <p className="text-[11px] text-[#444] px-2 py-1">No docs yet</p>
              )}
            </div>
          )}
        </nav>

        {/* Bottom — Settings + User */}
        <div className="border-t border-[#2a2a2a] px-2 py-2.5 space-y-[1px]">
          <Link
            href="/settings"
            className={`flex items-center gap-2 px-2 py-[5px] rounded-md transition-colors text-[12px] font-medium ${
              pathname === "/settings"
                ? "bg-[#2a2a2a] text-[#e8e8e8]"
                : "text-[#888] hover:bg-[#2a2a2a] hover:text-[#e8e8e8]"
            }`}
          >
            <Settings size={13} />
            Settings
          </Link>

          <div className="flex items-center gap-2 px-2 py-[5px]">
            <div className="w-5 h-5 rounded-full bg-[#7C3AED] flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-white">{initial}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[#e8e8e8] truncate leading-tight">{userName || "..."}</p>
              <p className="text-[11px] text-[#555] truncate leading-tight">{userEmail}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-[#242424] border border-[#333] rounded-xl shadow-2xl w-[320px] p-5 z-10">
            <h2 className="text-[14px] font-semibold text-[#e8e8e8] mb-4">
              {modalType === "doc" ? "New Doc" : "New Folder"}
            </h2>

            <div className="mb-1">
              <label className="text-[11px] text-[#666] font-medium uppercase tracking-wider mb-1 block">
                Name
              </label>
              <input
                ref={modalInputRef}
                type="text"
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleModalConfirm()
                  if (e.key === "Escape") setShowModal(false)
                }}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-[13px] text-[#e8e8e8] outline-none focus:border-[#555] focus:ring-1 focus:ring-[#333]"
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#888] hover:bg-[#2a2a2a] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleModalConfirm}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#e8e8e8] text-[#1a1a1a] hover:bg-white transition-colors"
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
