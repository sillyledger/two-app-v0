'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Sidebar } from '@/components/sidebar'
import { NoteCard } from '@/components/note-card'
import { NoteModal } from '@/components/note-modal'
import { useSession } from '@/lib/auth/client'
import type { Note } from '@/lib/db'

const fetcher = (url: string) => fetch(url).then((res) => {
  if (res.status === 401) {
    throw new Error('Unauthorized')
  }
  return res.json()
})

export default function NotesPage() {
  const router = useRouter()
  const session = useSession()
  const user = session.data?.user
  const authLoading = session.isPending
  
  const { data: notes, mutate, error } = useSWR<Note[]>(user ? '/api/notes' : null, fetcher)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (error?.message === 'Unauthorized') {
      router.push('/login')
    }
  }, [error, router])

  const handleNewNote = () => {
    setEditingNote(null)
    setIsModalOpen(true)
  }

  const handleEditNote = (note: Note) => {
    setEditingNote(note)
    setIsModalOpen(true)
  }

  const handleToggleStar = async (note: Note) => {
    try {
      await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: !note.is_starred }),
      })
      mutate()
    } catch (error) {
      console.error('Failed to toggle star:', error)
    }
  }

  const handleSaveNote = async (data: {
    title: string
    content: string
    color: string
  }) => {
    try {
      if (editingNote) {
        await fetch(`/api/notes/${editingNote.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      } else {
        await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      }
      mutate()
      setIsModalOpen(false)
    } catch (error) {
      console.error('Failed to save note:', error)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onNewNote={handleNewNote} user={user} />

      <main className="flex-1 p-8 lg:p-12">
        <h1 className="mb-8 text-4xl font-bold text-foreground">Notes</h1>

        {!notes ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="mb-4 text-lg text-muted-foreground">
              No notes yet. Create your first note!
            </p>
            <button
              onClick={handleNewNote}
              className="rounded-lg bg-foreground px-6 py-2 font-medium text-background hover:bg-foreground/90"
            >
              Create Note
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={handleEditNote}
                onToggleStar={handleToggleStar}
              />
            ))}
          </div>
        )}
      </main>

      <NoteModal
        note={editingNote}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveNote}
      />
    </div>
  )
}
