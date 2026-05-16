'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import type { Note } from '@/lib/db'

export default function NotePage() {
  const { id } = useParams()
  const router = useRouter()
  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    fetch('/api/auth/me').then((res) => {
      if (!res.ok) router.push('/login')
    })
  }, [])

  useEffect(() => {
    fetch(`/api/notes/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setNote(data)
        setTitle(data.title)
        setContent(data.content || '')
      })
  }, [id])

  const handleSave = async () => {
    await fetch(`/api/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, color: note?.color ?? 'yellow' }),
    })
  }

  const handleNewNote = async () => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', content: '', color: 'yellow' }),
    })
    const newNote = await res.json()
    router.push(`/notes/${newNote.id}`)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onNewNote={handleNewNote} />
      <main className="flex-1 flex justify-center py-16 px-6">
        <div className="w-full max-w-2xl">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            placeholder="Untitled"
            className="mb-6 w-full bg-transparent text-4xl font-bold text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleSave}
            placeholder="Start writing..."
            className="w-full min-h-[60vh] resize-none bg-transparent text-base leading-snug text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </main>
    </div>
  )
}
