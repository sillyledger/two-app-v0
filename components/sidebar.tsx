'use client'

import { Search, Home, FolderClosed, Clock, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  onNewNote: () => void
}

export function Sidebar({ onNewNote }: SidebarProps) {
  const navItems = [
    { icon: Search, label: 'Search', active: false },
    { icon: Home, label: 'Home', active: true },
    { icon: FolderClosed, label: 'Folders', active: false },
    { icon: Clock, label: 'History', active: false },
  ]

  return (
    <aside className="flex h-screen w-20 flex-col items-center bg-sidebar py-8">
      <button
        onClick={onNewNote}
        className="mb-12 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105"
        aria-label="Create new note"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

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
    </aside>
  )
}
