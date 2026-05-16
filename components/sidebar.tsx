'use client'

import { Search, Home, FolderClosed, Clock, Plus, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/auth/client'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
}

interface SidebarProps {
  onNewNote: () => void
  user?: User | null
}

export function Sidebar({ onNewNote, user }: SidebarProps) {
  const router = useRouter()
  
  const navItems = [
    { icon: Search, label: 'Search', active: false },
    { icon: Home, label: 'Home', active: true },
    { icon: FolderClosed, label: 'Folders', active: false },
    { icon: Clock, label: 'History', active: false },
  ]

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  const userInitial = user?.name?.charAt(0) || user?.email?.charAt(0) || '?'

  return (
    <aside className="flex h-screen w-20 flex-col items-center bg-sidebar py-8">
      <button
        onClick={onNewNote}
        className="mb-12 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105"
        aria-label="Create new note"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <nav className="flex flex-1 flex-col gap-6">
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

      {user && (
        <div className="mt-auto flex flex-col items-center gap-4 pt-6">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background"
            title={user.email || user.name || 'User'}
          >
            {userInitial.toUpperCase()}
          </div>
          <button
            onClick={handleSignOut}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      )}
    </aside>
  )
}
