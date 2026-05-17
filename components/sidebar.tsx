"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Search,
  Inbox,
  CheckSquare,
  FileText,
  FolderKanban,
  ChevronDown,
  ChevronRight,
  Settings,
} from "lucide-react"

interface SidebarProps {
  onNewNote?: () => void
}

export default function Sidebar({ onNewNote }: SidebarProps = {}) {
  const pathname = usePathname()
  const [workspaceOpen, setWorkspaceOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [workspaceName, setWorkspaceName] = useState("My Workspace")

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
  }, [])

  const initial = userName ? userName.charAt(0).toUpperCase() : "?"

  return (
    <aside className="w-[220px] min-w-[220px] h-screen flex flex-col bg-[#F4F4F4] border-r border-[#E0E0E0]">

      {/* Top — Logo + User */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-3">
        <div className="w-6 h-6 rounded-md bg-black flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">T</span>
        </div>
        <span className="font-semibold text-[14px] text-gray-900 truncate">
          {userName || "..."}
        </span>
        <ChevronDown size={13} className="text-gray-400 ml-auto shrink-0" />
      </div>

      {/* Search */}
      <div className="px-3 mb-2">
        <div className="flex items-center gap-2 bg-[#E8E8E8] rounded-md px-3 py-1.5">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-full"
          />
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-2 overflow-y-auto mt-1">

        {/* Inbox */}
        <Link
          href="/inbox"
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md mb-0.5 transition-colors text-sm ${
            pathname === "/inbox"
              ? "bg-[#E8E8E8] text-gray-900 font-medium"
              : "text-gray-500 hover:bg-[#E8E8E8] hover:text-gray-900"
          }`}
        >
          <Inbox size={15} />
          Inbox
        </Link>

        {/* My Tasks */}
        <Link
          href="/tasks"
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md mb-0.5 transition-colors text-sm ${
            pathname === "/tasks"
              ? "bg-[#E8E8E8] text-gray-900 font-medium"
              : "text-gray-500 hover:bg-[#E8E8E8] hover:text-gray-900"
          }`}
        >
          <CheckSquare size={15} />
          My Tasks
        </Link>

        {/* Divider */}
        <div className="my-3 border-t border-[#E0E0E0]" />

        {/* Workspace Section */}
        <button
          onClick={() => setWorkspaceOpen(!workspaceOpen)}
          className="flex items-center gap-1.5 px-3 py-1 w-full text-left text-gray-400 hover:text-gray-600 transition-colors mb-1"
        >
          {workspaceOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="text-xs font-semibold uppercase tracking-wider truncate">
            {workspaceName}
          </span>
        </button>

        {workspaceOpen && (
          <div className="space-y-0.5">
            <Link
              href="/"
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors text-sm ${
                pathname === "/"
                  ? "bg-[#E8E8E8] text-gray-900 font-medium"
                  : "text-gray-500 hover:bg-[#E8E8E8] hover:text-gray-900"
              }`}
            >
              <FileText size={15} />
              Docs
            </Link>

            <Link
              href="/projects"
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors text-sm ${
                pathname === "/projects"
                  ? "bg-[#E8E8E8] text-gray-900 font-medium"
                  : "text-gray-500 hover:bg-[#E8E8E8] hover:text-gray-900"
              }`}
            >
              <FolderKanban size={15} />
              Projects
            </Link>
          </div>
        )}
      </nav>

      {/* Bottom — Settings + User */}
      <div className="border-t border-[#E0E0E0] px-2 py-3 space-y-0.5">
        <Link
          href="/settings"
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors text-sm ${
            pathname === "/settings"
              ? "bg-[#E8E8E8] text-gray-900 font-medium"
              : "text-gray-500 hover:bg-[#E8E8E8] hover:text-gray-900"
          }`}
        >
          <Settings size={15} />
          Settings
        </Link>

        <div className="flex items-center gap-2.5 px-3 py-1.5">
          <div className="w-6 h-6 rounded-full bg-[#7C3AED] flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">{initial}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate leading-tight">{userName || "..."}</p>
            <p className="text-xs text-gray-400 truncate leading-tight">{userEmail}</p>
          </div>
        </div>
      </div>

    </aside>
  )
}
