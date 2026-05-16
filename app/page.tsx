'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Sidebar } from '@/components/sidebar'
import type { Note } from '@/lib/db'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function NotesPage() {
  const { data: notes, mutate } = useSWR<Note[]>('/api/notes', fetcher)
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<Note[]>([])
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me').then((res) => {
      if (!res.ok) {
        router.push('/login')
      }
    })
  }, [])

  const handleNewNote = async () => {
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled', content: '', color: 'yellow' }),
      })
      const note = await res.json()
      mutate()
      router.push(`/notes/${note.id}`)
    } catch (error) {
      console.error('Failed to create note:', error)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearch(value)
    if (!value.trim() || !notes) {
      setSuggestions([])
      return
    }
    const filtered = notes.filter((note) =>
      note.title.toLowerCase().includes(value.toLowerCase()) ||
      (note.content || '').toLowerCase().includes(value.toLowerCase())
    )
    setSuggestions(filtered.slice(0, 5))
  }

  const recentNotes = notes ? notes.slice(0, 4) : []

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onNewNote={handleNewNote} />

      <main className="flex-1 flex flex-col items-center justify-center px-8 py-16">
        <div className="w-full max-w-3xl">

          {/* Search bar */}
          <div className="relative mb-10">
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search your notes..."
              className="w-full rounded-2xl border border-input bg-background px-6 py-4 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-input bg-background shadow-lg z-50 overflow-hidden">
                {suggestions.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => router.push(`/notes/${note.id}`)}
                    className="w-full px-6 py-3 text-left text-sm hover:bg-muted transition-colors border-b border-input last:border-0"
                  >
                    <span className="font-medium text-foreground">{note.title}</span>
                    {note.content && (
                      <span className="ml-2 text-muted-foreground line-clamp-1">
                        — {note.content.slice(0, 60)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent notes grid */}
          {!notes ? (
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : recentNotes.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {recentNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => router.push(`/notes/${note.id}`)}
                  className="bg-muted rounded-2xl p-5 text-left transition-transform hover:scale-[1.02]"
                >
                  <p className="font-semibold text-foreground text-base mb-2 line-clamp-2">
                    {note.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(note.updated_at).toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric'
                    })}
                  </p>
                </button>
              ))}
            </div>
          ) : null}

        </div>
      </main>
    </div>
  )
}
