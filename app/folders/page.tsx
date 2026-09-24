"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search } from "lucide-react"
import Sidebar from "@/components/sidebar"
import { getDescendantIds } from "@/lib/folder-tree"
import MoveToFolderModal from "@/components/move-to-folder-modal"
import { FolderCard, FolderData, getAccent, markFolderCardMounted } from "@/components/folder-card"

export default function FoldersPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarReady, setSidebarReady] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") setCollapsed(true)
    setSidebarReady(true)
  }, [])

  useEffect(() => { markFolderCardMounted() }, [])

  const [folders, setFolders] = useState<FolderData[]>([])
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const renameInputRef = useRef<HTMLInputElement>(null)

  const [movingFolder, setMovingFolder] = useState<FolderData | null>(null)
  const [moveCandidates, setMoveCandidates] = useState<FolderData[]>([])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null) }
    if (menuOpenId) document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [menuOpenId])

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  useEffect(() => {
    fetch("/api/folders")
      .then(r => r.json())
      .then(data => {
        setFolders(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch("/api/workspace")
      .then(r => r.json())
      .then(data => { if (data?.id) setWorkspaceId(data.id) })
      .catch(() => {})
  }, [])

  const handleTogglePin = async (folder: FolderData, e: React.MouseEvent) => {
    e.stopPropagation()
    const newValue = !folder.pinned
    setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, pinned: newValue } : f))
    await fetch(`/api/folders/${folder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: newValue }),
    })
  }

  const startRenaming = (folder: FolderData, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(null)
    setRenameValue(folder.name)
    setRenamingId(folder.id)
  }

  const commitRename = async (folder: FolderData) => {
    const trimmed = renameValue.trim()
    setRenamingId(null)
    if (!trimmed || trimmed === folder.name) return
    setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, name: trimmed } : f))
    try {
      await fetch(`/api/folders/${folder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
    } catch {}
  }

  const handleOpenMoveFolder = async (folder: FolderData, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(null)
    setMovingFolder(folder)
    try {
      const res = await fetch("/api/folders?all=true")
      const data = await res.json()
      const allFolders: FolderData[] = Array.isArray(data) ? data : []
      const descendantIds = getDescendantIds(allFolders, folder.id)
      setMoveCandidates(
        allFolders.filter(f => f.workspace_id === folder.workspace_id && f.id !== folder.id && !descendantIds.has(f.id))
      )
    } catch {
      setMoveCandidates([])
    }
  }

  const handleMoveFolder = async (newParentId: string) => {
    if (!movingFolder) return
    const res = await fetch(`/api/folders/${movingFolder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id: newParentId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Failed to move folder.")
      return
    }
    setFolders(prev => prev.filter(f => f.id !== movingFolder.id))
    setMovingFolder(null)
  }

  const handleDeleteFolder = async (folder: FolderData, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(null)
    const confirmed = window.confirm(`Delete "${folder.name}"?\n\nAll docs inside will be moved to Trash and can be recovered within 30 days.`)
    if (!confirmed) return
    setFolders(prev => prev.filter(f => f.id !== folder.id))
    try { await fetch(`/api/folders/${folder.id}`, { method: "DELETE" }) } catch {}
  }

  const openCreateModal = () => {
    setNewFolderName("")
    setCreateModalOpen(true)
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !workspaceId) return
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolderName.trim(), workspace_id: workspaceId }),
    })
    if (res.ok) {
      const created = await res.json()
      setFolders(prev => [...prev, { ...created, doc_count: 0, last_edited: null, pinned: created.pinned ?? false }])
    }
    setCreateModalOpen(false)
    setNewFolderName("")
  }

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const filteredFolders = trimmedQuery
    ? folders.filter(f => f.name.toLowerCase().includes(trimmedQuery))
    : folders

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

  const handleToggleMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(prev => prev === id ? null : id)
  }

  const renderFolderCard = (folder: FolderData) => (
    <FolderCard
      key={folder.id}
      folder={folder}
      accentColor={getAccent(folders.findIndex(f => f.id === folder.id))}
      isMenuOpen={menuOpenId === folder.id}
      menuRef={menuRef}
      onToggleMenu={handleToggleMenu}
      onTogglePin={handleTogglePin}
      onOpen={f => router.push(`/folders/${f.id}?name=${encodeURIComponent(f.name)}`)}
      isRenaming={renamingId === folder.id}
      renameValue={renameValue}
      onRenameChange={setRenameValue}
      renameInputRef={renameInputRef}
      onCommitRename={commitRename}
      onCancelRename={() => setRenamingId(null)}
      onStartRename={startRenaming}
      onMove={handleOpenMoveFolder}
      onDelete={handleDeleteFolder}
    />
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--app-frame)" }}>
      {sidebarReady && <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />}

      <main className="app-panel flex-1 overflow-y-auto transition-all duration-200">
        <div className="max-w-[1180px] mx-auto px-10 py-10">

          <div className="flex items-center justify-between mb-6 gap-4">
            <div className="relative flex-1" style={{ maxWidth: 420 }}>
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-3)" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search folders..."
                className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none placeholder-[var(--text-3)]"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)", color: "var(--text-1)" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <button
                onClick={openCreateModal}
                style={{ ...btnBase, backgroundColor: "var(--primary-bg)", color: "var(--primary-text)", border: "1px solid transparent" }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <Plus size={14} />
                New folder
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-40 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
              ))}
            </div>
          ) : (
            <>
              <p className="text-sm mb-3" style={{ color: "var(--text-3)" }}>All folders · {filteredFolders.length}</p>
              {filteredFolders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--text-3)" }}>
                  <p className="text-base font-medium mb-1">
                    {trimmedQuery ? "No folders match your search" : "No folders yet"}
                  </p>
                  <p className="text-sm">
                    {trimmedQuery ? "Try a different search term" : "Click + New folder to get started"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {filteredFolders.map(renderFolderCard)}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Create folder modal */}
      {createModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: "var(--overlay)" }}>
          <div className="rounded-2xl p-6 w-80 shadow-2xl" style={{ backgroundColor: "var(--menu-bg)", border: "1px solid var(--border-subtle)" }}>
            <h2 className="font-semibold text-base mb-4" style={{ color: "var(--text-1)" }}>New folder</h2>
            <input
              autoFocus
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setCreateModalOpen(false) }}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-4"
              style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)", color: "var(--text-1)" }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCreateModalOpen(false)} className="px-4 py-2 text-sm" style={{ color: "var(--text-3)" }}>Cancel</button>
              <button onClick={handleCreateFolder} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-1)" }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Move folder modal */}
      {movingFolder && (
        <MoveToFolderModal
          folders={moveCandidates}
          onMove={handleMoveFolder}
          onClose={() => setMovingFolder(null)}
          currentFolderId={movingFolder?.parent_id ?? undefined}
        />
      )}
    </div>
  )
}
