'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import Editor from '@/components/editor'
import DocTopbar from '@/components/doc-topbar'
import type { Doc } from '@/lib/db'

interface Folder {
  id: string
  name: string
}

export default function DocPage() {
  const { id } = useParams()
  const router = useRouter()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [folder, setFolder] = useState<Folder | null>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  const resizeTitle = () => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  useEffect(() => {
    fetch('/api/auth/me').then((res) => {
      if (!res.ok) router.push('/login')
    })
  }, [])

  useEffect(() => {
    fetch(`/api/docs/${id}`)
      .then((res) => res.json())
      .then((data: Doc) => {
        setDoc(data)
        setTitle(data.title)
        setContent(data.content || '')

        // If doc belongs to a folder, fetch that folder's name
        if (data.folder_id) {
          fetch(`/api/folders/${data.folder_id}`)
            .then((r) => r.json())
            .then((f: Folder) => setFolder(f))
            .catch(() => {})
        }
      })
  }, [id])

  useEffect(() => {
    resizeTitle()
  }, [title])

  const handleSave = useCallback(async (latestTitle: string, latestContent: string, latestDoc: Doc | null) => {
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

  const handleDelete = async () => {
    if (!confirm('Delete this doc? This cannot be undone.')) return
    await fetch(`/api/docs/${id}`, { method: 'DELETE' })
    router.push('/')
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onNewNote={handleNewDoc} />

      <div className="flex-1 flex flex-col min-h-screen">
        <DocTopbar
          docTitle={title}
          folder={folder}
          saveStatus={saveStatus}
          onDelete={handleDelete}
        />

        <main className="flex-1 overflow-y-auto pt-[44px]">
          <div className="mx-auto w-full max-w-[780px] px-16 pt-16 pb-32">
            {/* Doc title */}
            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                resizeTitle()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault()
              }}
              placeholder="Untitled"
              rows={1}
              className="mb-8 block w-full resize-none overflow-hidden bg-transparent text-[2.375rem] font-bold leading-[1.2] tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
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
    </div>
  )
}
