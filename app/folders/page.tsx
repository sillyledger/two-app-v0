"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Pin } from "lucide-react"
import Sidebar from "@/components/sidebar"

interface FolderData {
  id: string
  name: string
  doc_count: number | string
  last_edited: string | null
  pinned: boolean
}

const ACCENT_COLORS = [
  "#EF9F27", "#85B7EB", "#5DCAA5", "#F0997B",
  "#AFA9EC", "#97C459", "#ED93B1", "#B4B2A9", "#5DCAA5",
]

function getAccent(index: number) {
  return ACCENT_COLORS[index % ACCENT_COLORS.length]
}

function formatRelative(dateStr: string | null) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay >= 30) return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  if (diffDay >= 1) return `${diffDay}d ago`
  if (diffHr >= 1) return `${diffHr}h ago`
  if (diffMin >= 1) return `${diffMin}m ago`
  return "just now"
}

function FolderIcon({ color }: { color: string }) {
  return (
    <div style={{ position: "relative", height: "54px", width: "54px", marginBottom: "14px" }}>
      <div style={{ position: "absolute", left: 0, top: "4px", width: "50px", height: "36px", borderRadius: "7px", backgroundColor: color, opacity: 0.35 }} />
      <div style={{ position: "absolute", left: 0, top: "11px", width: "50px", height: "36px", borderRadius: "7px", backgroundColor: color }} />
    </div>
  )
}

export default function FoldersPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarReady, setSidebarReady] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") setCollapsed(true)
    setSidebarReady(true)
  }, [])

  const [folders, setFolders] = useState<FolderData[]>([])
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")

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

  const pinnedFolders = filteredFolders.filter(f => f.pinned)

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

  const FolderCard = ({ folder }: { folder: FolderData }) => {
    const index = folders.findIndex(f => f.id === folder.id)
    const docCount = Number(folder.doc_count) || 0
    const relative = formatRelative(folder.last_edited)
    return (
      <div
        className="relative rounded-xl p-[18px] transition-colors cursor-pointer"
        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onClick={() => router.push(`/folders/${folder.id}?name=${encodeURIComponent(folder.name)}`)}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.borderColor = "var(--text-muted)" }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; e.currentTarget.style.borderColor = "var(--border)" }}
      >
        <button
          onClick={e => handleTogglePin(folder, e)}
          title={folder.pinned ? "Unpin from homepage" : "Pin to homepage"}
          className="absolute top-3.5 right-3.5 transition-opacity"
          style={{
            color: folder.pinned ? "#EF9F27" : "var(--text-muted)",
            opacity: folder.pinned ? 1 : 0.4,
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={e => (e.currentTarget.style.opacity = folder.pinned ? "1" : "0.4")}
        >
          <Pin size={14} fill={folder.pinned ? "#EF9F27" : "none"} />
        </button>

        <FolderIcon color={getAccent(index)} />

        <p className="font-semibold text-[14px] mb-1" style={{ color: "var(--text-primary)" }}>{folder.name}</p>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{docCount} {docCount === 1 ? "doc" : "docs"}</p>
        <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
          {relative ? `Edited ${relative}` : "No docs yet"}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg)" }}>
      {sidebarReady && <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />}

      <main className="flex-1 overflow-y-auto transition-all duration-200">
        <div className="max-w-[1180px] mx-auto px-10 py-10">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-[32px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Folders</h1>
            <button
              onClick={openCreateModal}
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
              New folder
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-7">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search folders..."
              className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none placeholder-[var(--text-muted)]"
              style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-40 rounded-xl animate-pulse" style={{ backgroundColor: "var(--bg-tertiary)" }} />
              ))}
            </div>
          ) : (
            <>
              {pinnedFolders.length > 0 && (
                <>
                  <p className="text-sm mb-3 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    <Pin size={13} fill="#EF9F27" style={{ color: "#EF9F27" }} />
                    Pinned to homepage
                  </p>
                  <div className="grid grid-cols-4 gap-4 mb-9">
                    {pinnedFolders.map(folder => <FolderCard key={folder.id} folder={folder} />)}
                  </div>
                </>
              )}

              <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>All folders · {filteredFolders.length}</p>
              {filteredFolders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--text-muted)" }}>
                  <p className="text-base font-medium mb-1">
                    {trimmedQuery ? "No folders match your search" : "No folders yet"}
                  </p>
                  <p className="text-sm">
                    {trimmedQuery ? "Try a different search term" : "Click + New folder to get started"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {filteredFolders.map(folder => <FolderCard key={folder.id} folder={folder} />)}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Create folder modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-80 shadow-2xl" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <h2 className="font-semibold text-base mb-4" style={{ color: "var(--text-primary)" }}>New folder</h2>
            <input
              autoFocus
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setCreateModalOpen(false) }}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-4"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCreateModalOpen(false)} className="px-4 py-2 text-sm" style={{ color: "var(--text-muted)" }}>Cancel</button>
              <button onClick={handleCreateFolder} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
