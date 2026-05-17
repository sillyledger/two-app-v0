'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import Editor from '@/components/editor'
import type { Doc } from '@/lib/db'

export default function DocPage() {
  const { id } = useParams()
  const router = useRouter()
  const [doc, setDoc] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')

  useEffect(() => {
    fetch('/api/auth/me').then((res) => {
      if (!res.ok) router.push('/login')
    })
  }, [])

  useEffect(() => {
    fetch(`/api/docs/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setDoc(data)
        setTitle(data.title)
        setContent(data.content || '')
      })
  }, [id])

  const handleSave = useCallback(async (latestTitle: string, latestContent: string, latestDoc: Note | null) => {
    setSaveStatus('saving')
    await fetch(`/api/docs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: latestTitle, content: latestContent, color: latestDoc?.color ?? 'yellow' }),
    })
    setSaveStatus('saved')
  }, [id])

  useEffect(() => {
    if (!doc) return
    setSaveStatus('unsaved')
    const timer = setTimeout(() => {
      handleSave(title, content, doc)
    }, 1000)
    return () => clearTimeout(timer)
  }, [title, content])

  const handleNewDoc = async () => {
    const res = await fetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', content: '', color: 'yellow', type: 'doc' }),
    })
    const newDoc = await res.json()
    router.push(`/docs/${newDoc.id}`)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onNewNote={handleNewDoc} />
      <main className="flex-1 flex justify-center py-16 px-6">
        <div className="w-full max-w-2xl">
          {/* Save status */}
          <div className="mb-4 flex justify-end h-5">
            <span className="text-sm text-muted-foreground">
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'saved' && 'Saved'}
            </span>
          </div>
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="mb-6 w-full bg-transparent text-4xl font-bold text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {/* Rich text editor */}
          {doc !== null && (
            <Editor
              content={content}
              onChange={(newContent) => setContent(newContent)}
            />
          )}
        </div>
      </main>
    </div>
  )
}
