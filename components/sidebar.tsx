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
} from "lucide-react"

interface Doc {
  id: string
  title: string
}

interface Folder {
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
  const [folders, setFolders] = useState<Folder[]>([])
  const [creating, setCreating] = useState(false)

  // Modal state
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

  useEffect(() => {
    if (showModal) {
      setTimeout(() => modalInputRef.current?.focus(), 50)
    }
  }, [showModal])

  const initial = userName ? userName.charAt(0).toUpperCase() : "?"

  const openModal = (type: "doc" | "folder") => {
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
          ? "bg-[#E0E0E0] text-[#111111]"
          : "text-[#3a3a3a] hover:bg-[#E0E0E0] hover:text-[#111111]"
      }`}
    >
      {icon}
      {label}
    </Link>
  )

  return (
    <>
      <aside className="w-[210px] min-w-[210px] h-screen flex flex-col bg-[#EBEBEB] border-r border-[#D8D8D8]">

        {/* Top — User */}
        <div className="flex items-center gap-2 px-3 pt-4 pb-2.5">
          <div className="w-5 h-5 rounded-md bg-[#111111] flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">T</span>
          </div>
          <span className="font-semibold text-[13px] text-[#111111] truncate">
            {userName || "..."}
          </span>
          <ChevronDown size={12} className="text-[#888] ml-auto shrink-0" />
        </div>

        {/* Search */}
        <div className="px-2 mb-2">
          <div className="flex items-center gap-2 bg-[#DCDCDC] rounded-md px-2.5 py-[6px]">
            <Search size={12} className="text-[#888] shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[12px] text-[#333] placeholder-[#999] outline-none w-full"
            />
          </div>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 px-2 overflow-y-auto mt-0.5">

          {navItem("/", <Home size={13} />, "Home")}
          {navItem("/activity", <Activity size={13} />, "Activity")}
          {navItem("/library", <BookOpen size={13} />, "Library")}

          {/* Divider */}
          <div className="my-2 border-t border-[#D4D4D4]" />

          {/* Workspace Header */}
          <div className="flex items-center justify-between px-2 py-[4px] mb-0.5">
            <button
              onClick={() => setWorkspaceOpen(!workspaceOpen)}
              className="flex items-center gap-1 text-[#888] hover:text-[#333] transition-colors"
            >
              {workspaceOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">
                {workspaceName}
              </span>
            </button>
            <button
              onClick={() => openModal("doc")}
              disabled={creating}
              className="text-[#888] hover:text-[#111] transition-colors"
              title="New Doc or Folder"
            >
              <Plus size={13} />
            </button>
          </div>

          {workspaceOpen && (
            <div className="space-y-[1px]">

              {/* Folders */}
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center gap-2 px-2 py-[5px] rounded-md text-[12px] font-medium text-[#3a3a3a] hover:bg-[#E0E0E0] hover:text-[#111] transition-colors cursor-pointer"
                >
                  <Folder size={13} className="shrink-0 text-[#888]" />
                  <span className="truncate">{folder.name}</span>
                </div>
              ))}

              {/* Loose Docs */}
              {docs.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/docs/${doc.id}`}
                  className={`flex items-center gap-2 px-2 py-[5px] rounded-md transition-colors text-[12px] font-medium ${
                    pathname === `/docs/${doc.id}`
                      ? "bg-[#E0E0E0] text-[#111111]"
                      : "text-[#3a3a3a] hover:bg-[#E0E0E0] hover:text-[#111111]"
                  }`}
                >
                  <FileText size={13} className="shrink-0 text-[#888]" />
                  <span className="truncate">{doc.title || "Untitled"}</span>
                </Link>
              ))}

              {folders.length === 0 && docs.length === 0 && (
                <p className="text-[11px] text-[#999] px-2 py-1">No docs yet</p>
              )}
            </div>
          )}
        </nav>

        {/* Bottom — Settings + User */}
        <div className="border-t border-[#D4D4D4] px-2 py-2.5 space-y-[1px]">
          <Link
            href="/settings"
            className={`flex items-center gap-2 px-2 py-[5px] rounded-md transition-colors text-[12px] font-medium ${
              pathname === "/settings"
                ? "bg-[#E0E0E0] text-[#111111]"
                : "text-[#3a3a3a] hover:bg-[#E0E0E0] hover:text-[#111111]"
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
              <p className="text-[12px] font-medium text-[#111] truncate leading-tight">{userName || "..."}</p>
              <p className="text-[11px] text-[#888] truncate leading-tight">{userEmail}</p>
            </div>
          </div>
        </div>

      </aside>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setShowModal(false)}
          />

          {/* Modal Box */}
          <div className="relative bg-white rounded-xl shadow-2xl w-[320px] p-5 z-10">
            <h2 className="text-[14px] font-semibold text-gray-900 mb-4">
              {modalType === "doc" ? "New Doc" : "New Folder"}
            </h2>

            <div className="mb-1">
              <label className="text-[11px] text-gray-500 font-medium uppercase tracking-wider mb-1 block">
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-300"
              />
            </div>

            {/* Two buttons for the + action */}
            {modalType === "doc" && (
              <div className="mt-3 mb-3">
                <button
                  onClick={() => { setModalType("folder"); setModalName("New Folder") }}
                  className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Create a folder instead →
                </button>
              </div>
            )}
            {modalType === "folder" && (
              <div className="mt-3 mb-3">
                <button
                  onClick={() => { setModalType("doc"); setModalName("Untitled") }}
                  className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Create a doc instead →
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleModalConfirm}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-black text-white hover:bg-gray-800 transition-colors"
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
