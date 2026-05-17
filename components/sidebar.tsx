"use client"

import { useState, useEffect } from "react"
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
  FolderOpen,
} from "lucide-react"

interface Doc {
  id: string
  title: string
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
  const [docs, setDocs] = useState<Doc[]>([])
  const [creating, setCreating] = useState(false)

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
      })
      .catch(() => {})

    fetch("/api/docs")
      .then((r) => r.json())
      .then((data) => {
        setDocs(Array.isArray(data) ? data.slice(0, 8) : [])
      })
      .catch(() => {})
  }, [])

  const initial = userName ? userName.charAt(0).toUpperCase() : "?"

  const handleCreateDoc = async () => {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled", content: "", color: "yellow", type: "doc" }),
      })
      const doc = await res.json()
      router.push(`/docs/${doc.id}`)
    } catch {
      setCreating(false)
    }
  }

  const navItem = (href: string, icon: React.ReactNode, label: string) => (
    <Link
      href={href}
      className={`flex items-center gap-2 px-2 py-[5px] rounded-md mb-[1px] transition-colors text-[12px] ${
        pathname === href
          ? "bg-[#E8E8E8] text-gray-900 font-medium"
          : "text-gray-500 hover:bg-[#E8E8E8] hover:text-gray-800"
      }`}
    >
      {icon}
      {label}
    </Link>
  )

  return (
    <aside className="w-[210px] min-w-[210px] h-screen flex flex-col bg-[#F4F4F4] border-r border-[#E0E0E0]">

      {/* Top — User */}
      <div className="flex items-center gap-2 px-3 pt-4 pb-2.5">
        <div className="w-5 h-5 rounded-md bg-black flex items-center justify-center shrink-0">
          <span className="text-white text-[10px] font-bold">T</span>
        </div>
        <span className="font-semibold text-[13px] text-gray-900 truncate">
          {userName || "..."}
        </span>
        <ChevronDown size={12} className="text-gray-400 ml-auto shrink-0" />
      </div>

      {/* Search */}
      <div className="px-2 mb-2">
        <div className="flex items-center gap-2 bg-[#E8E8E8] rounded-md px-2.5 py-1.5">
          <Search size={12} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-[12px] text-gray-600 placeholder-gray-400 outline-none w-full"
          />
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-2 overflow-y-auto mt-0.5">

        {navItem("/", <Home size={13} />, "Home")}
        {navItem("/activity", <Activity size={13} />, "Activity")}
        {navItem("/library", <BookOpen size={13} />, "Library")}

        {/* Divider */}
        <div className="my-2 border-t border-[#E0E0E0]" />

        {/* Workspace Section */}
        <div className="flex items-center justify-between px-2 py-[5px] mb-0.5">
          <button
            onClick={() => setWorkspaceOpen(!workspaceOpen)}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {workspaceOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <span className="text-[10px] font-semibold uppercase tracking-wider truncate">
              {workspaceName}
            </span>
          </button>
          <button
            onClick={handleCreateDoc}
            disabled={creating}
            className="text-gray-400 hover:text-gray-700 transition-colors"
            title="New Doc"
          >
            <Plus size={13} />
          </button>
        </div>

        {workspaceOpen && (
          <div className="space-y-[1px]">
            {/* Folders placeholder */}
            <div className="flex items-center gap-2 px-2 py-[5px] text-gray-400 text-[12px]">
              <FolderOpen size={13} />
              <span>Folders coming soon</span>
            </div>

            {/* Loose docs */}
            {docs.map((doc) => (
              <Link
                key={doc.id}
                href={`/docs/${doc.id}`}
                className={`flex items-center gap-2 px-2 py-[5px] rounded-md transition-colors text-[12px] ${
                  pathname === `/docs/${doc.id}`
                    ? "bg-[#E8E8E8] text-gray-900 font-medium"
                    : "text-gray-500 hover:bg-[#E8E8E8] hover:text-gray-800"
                }`}
              >
                <FileText size={13} className="shrink-0" />
                <span className="truncate">{doc.title || "Untitled"}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom — Settings + User */}
      <div className="border-t border-[#E0E0E0] px-2 py-2.5 space-y-[1px]">
        <Link
          href="/settings"
          className={`flex items-center gap-2 px-2 py-[5px] rounded-md transition-colors text-[12px] ${
            pathname === "/settings"
              ? "bg-[#E8E8E8] text-gray-900 font-medium"
              : "text-gray-500 hover:bg-[#E8E8E8] hover:text-gray-800"
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
            <p className="text-[12px] font-medium text-gray-900 truncate leading-tight">{userName || "..."}</p>
            <p className="text-[11px] text-gray-400 truncate leading-tight">{userEmail}</p>
          </div>
        </div>
      </div>

    </aside>
  )
}
