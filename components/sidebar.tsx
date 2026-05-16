'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Home, FolderClosed, Clock, Plus, Settings, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface SidebarProps {
  onNewNote: () => void
}

export function Sidebar({ onNewNote }: SidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const navItems = [
    { icon: Search, label: 'Search', active: false },
    { icon: Home, label: 'Home', active: true },
    { icon: FolderClosed, label: 'Folders', active: false },
    { icon: Clock, label: 'History', active: false },
  ]

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
    router.push('/login')
  }

  return (
    <aside className="flex h-screen w-20 flex-col items-center bg-sidebar py-8">
      {/* New note button */}
      <button
        onClick={onNewNote}
        className="mb-12 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105"
        aria-label="Create new note"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {/* Nav items */}
      <nav className="flex flex-col gap-6">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl transition-colors',
              item.active
                ? 'bg-sidebar-accent text-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
            )}
            aria-label={item.label}
          >
            <item.icon className="h-5 w-5" />
          </button>
        ))}
      </nav>

      {/* Bottom section — settings + avatar */}
      <div className="mt-auto flex flex-col items-center gap-4">

        {/* Settings with popup menu */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setSettingsOpen((prev) => !prev)}
            className="flex h-12 w-12 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>

          {/* Popup menu */}
          {settingsOpen && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-36 rounded-xl border border-border bg-background shadow-lg py-1 z-50">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          )}
        </div>

        {/* User avatar */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted overflow-hidden ring-2 ring-border hover:ring-foreground transition-all"
          aria-label="User profile"
        >
          <span className="text-sm font-medium text-muted-foreground">U</span>
        </button>

      </div>
    </aside>
  )
}
