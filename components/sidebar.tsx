"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Search,
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
  BookOpen,
} from "lucide-react"

interface Notebook {
  id: string
  name: string
  color: string
  count: number
}

interface SidebarProps {
  notebooks?: Notebook[]
  allNotesCount?: number
  onNewNote?: () => void
}

const defaultNotebooks: Notebook[] = [
  { id: "personal", name: "Personal", color: "#4F8EF7", count: 12 },
  { id: "work", name: "Work Projects", color: "#F97316", count: 8 },
  { id: "ideas", name: "Ideas", color: "#A855F7", count: 15 },
]

export default function Sidebar({
  notebooks = defaultNotebooks,
  allNotesCount = 35,
  onNewNote,
}: SidebarProps) {
  const pathname = usePathname()
  const [notebooksOpen, setNotebooksOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")

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
  }, [])

  const initial = userName ? userName.charAt(0).toUpperCase() : "?"

  return (
    <aside className="w-[210px] min-w-[210px] h-screen flex flex-col bg-[#F4F4F4] text-gray-900 border-r border-[#E0E0E0]">
      {/* App Logo */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center">
          <BookOpen size={16} className="text-white" />
        </div>
        <span className="font-semibold text-[15px] tracking-tight text-gray-900">
          {userName || "..."}
        </span>
      </div>

      {/* Search */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 bg-[#E8E8E8] rounded-lg px-3 py-2">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-full"
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto">
        <Link
          href="/"
          className={`flex items-center justify-between px-3 py-2 rounded-lg mb-1 transition-colors ${
            pathname === "/"
              ? "bg-[#E8E8E8] text-gray-900"
              : "text-gray-500 hover:bg-[#E8E8E8] hover:text-gray-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <FileText size={15} />
            <span className="text-sm font-medium">All Notes</span>
          </div>
          <span className="text-xs text-gray-400">{allNotesCount}</span>
        </Link>

        <div className="mt-4 mb-1">
          <button
            onClick={() => setNotebooksOpen(!notebooksOpen)}
            className="flex items-center gap-1.5 px-3 py-1 w-full text-left text-gray-400 hover:text-gray-600 transition-colors"
          >
            {notebooksOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span className="text-xs font-semibold uppercase tracking-wider">Notebooks</span>
          </button>

          {notebooksOpen && (
            <div className="mt-1 space-y-0.5">
              {notebooks.map((nb) => (
                <Link
                  key={nb.id}
                  href={`/notebook/${nb.id}`}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    pathname === `/notebook/${nb.id}`
                      ? "bg-[#E8E8E8] text-gray-900"
                      : "text-gray-500 hover:bg-[#E8E8E8] hover:text-gray-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: nb.color }}
                    />
                    <span className="text-sm">{nb.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{nb.count}</span>
                </Link>
              ))}

              <button
                onClick={onNewNote}
                className="flex items-center gap-2.5 px-3 py-2 w-full text-gray-400 hover:text-gray-600 hover:bg-[#E8E8E8] rounded-lg transition-colors"
              >
                <Plus size={14} />
                <span className="text-sm">Create Notebook</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Bottom: Settings + User */}
      <div className="border-t border-[#E0E0E0] px-3 py-4 space-y-1">
        <Link
          href="/settings"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
            pathname === "/settings"
              ? "bg-[#E8E8E8] text-gray-900"
              : "text-gray-500 hover:bg-[#E8E8E8] hover:text-gray-900"
          }`}
        >
          <Settings size={15} />
          <span className="text-sm">Settings</span>
        </Link>

        <div className="flex items-center gap-3 px-3 py-2 mt-1">
          <div className="w-7 h-7 rounded-full bg-[#7C3AED] flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">{initial}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userName || "..."}</p>
            <p className="text-xs text-gray-400 truncate">{userEmail}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
