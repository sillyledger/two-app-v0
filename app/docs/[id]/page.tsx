"use client"

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import Editor from '@/components/editor'
import DocTopbar from '@/components/doc-topbar'
import type { Doc } from '@/lib/db'

interface Folder {
  id: string
  name: string
}

function getWordCount(content: string): number {
  const text = content.replace(/<[^>]*>/g, ' ').trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

function getCharCount(content: string): number {
  return content.replace(/<[^>]*>/g, '').length
}

// Error boundary to capture runtime errors and show details in the UI.
class ErrorBoundary extends React.Component<{}, { error: Error | null; info: string | null }> {
  constructor(props: {}) {
    super(props)
    this.state = { error: null, info: null }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('DocPage render error', error, info)
    this.setState({ error, info: info.componentStack })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <h2 className="text-lg font-bold text-red-600">Error rendering document</h2>
          <pre className="mt-4 whitespace-pre-wrap text-sm text-[#222] bg-[#f8d7da] p-4 rounded">{String(this.state.error)}
{this.state.info}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

function DocPageContent() {
  const { id } = useParams()
  const router = useRouter()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [folder, setFolder] = useState<Folder | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const editorFocusRef = useRef<(() => void) | null>(null)

  const resizeTitle = () => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  useEffect(() => {
    fetch('/api/auth/me').then((res) => {
      setIsLoggedIn(res.ok)
      setAuthChecked(true)
    })
  }, [])

  useEffect(() => {
    if (!authChecked) return

    if (isLoggedIn) {
      fetch(`/api/docs/${id}`)
        .then((res) => res.json())
        .then((data: Doc) => {
          if ((data as any).error) {
            router.push('/')
            return
          }
          setDoc(data)
          setTitle(data.title)
          setContent(data.content || '')
          setIsPublic((data as any).is_public ?? false)

          if ((data as any).folder_id) {
            fetch(`/api/folders/${(data as any).folder_id}`)
              .then((r) => r.json())
              .then((f: Folder) => setFolder(f))
              .catch(() => {})
          }
        })
    } else {
      fetch(`/api/docs/public/${id}`)
        .then((res) => res.json())
        .then((data: Doc) => {
          if ((data as any).error) {
            router.push('/login')
            return
          }
          setDoc(data)
          setTitle(data.title)
          setContent(data.content || '')
          setIsPublic((data as any).is_public ?? false)
        })
    }
  }, [id, authChecked, isLoggedIn, router])

  useEffect(() => {
    resizeTitle()
  }, [title])

  const handleSave = useCallback(async (latestTitle: string, latestContent: string, latestDoc: Doc | null) => {
    if (!isLoggedIn) return
    setSaveStatus('saving')
    await fetch(`/api/docs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: latestTitle, content: latestContent, color: (latestDoc as any)?.color ?? 'yellow' }),
    })
    setSaveStatus('saved')
  }, [id, isLoggedIn])

  useEffect(() => {
    if (!doc) return
    if (!isLoggedIn) return
    setSaveStatus('unsaved')
    const timer = setTimeout(() => {
      handleSave(title, content, doc)
    }, 1000)
    return () => clearTimeout(timer)
  }, [title, content, doc, isLoggedIn, handleSave])

  const handleNewDoc = async () => {
    const res = await fetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', content: '', color: 'yellow', type: 'doc' }),
    })
    const newDoc = await res.json()
    router.push(`/docs/${(newDoc as any).id}`)
  }

  const handleDelete = async () => {
    await fetch(`/api/docs/${id}`, { method: 'DELETE' })
    router.push('/')
  }

  const wordCount = getWordCount(content)
  const charCount = getCharCount(content)

  if (!authChecked || !doc) return null

  return (
    <div className="flex min-h-screen bg-background">
      {isLoggedIn && <Sidebar onNewNote={handleNewDoc} />}

      <div className="flex-1 flex flex-col min-h-screen">
        <DocTopbar
          docTitle={title}
          folder={folder}
          saveStatus={saveStatus}
          onDelete={isLoggedIn ? handleDelete : undefined}
          docId={id}
          isPublic={isPublic}
        />

        <main className="flex-1 overflow-y-auto pt-[44px]">
          <div className="mx-auto w-full max-w-[780px] px-16 pt-16 pb-32">

            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => {
                if (!isLoggedIn) return
                setTitle(e.target.value)
                resizeTitle()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  editorFocusRef.current?.()
                }
              }}
              placeholder="Untitled"
              rows={1}
              readOnly={!isLoggedIn}
              className="mb-8 block w-full resize-none overflow-hidden bg-transparent text-[2.375rem] font-bold leading-[1.2] tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />

            {doc !== null && (
              <Editor
                content={content}
                onChange={(newContent) => {
                  if (!isLoggedIn) return
                  setContent(newContent)
                }}
                onReady={(focusFn) => { editorFocusRef.current = focusFn }}
              />
            )}

            {wordCount > 0 && (
              <div className="mt-16 flex items-center gap-2 text-[11px] text-[#383838] select-none">
                <span>{wordCount.toLocaleString()} words</span>
                <span>·</span>
                <span>{charCount.toLocaleString()} characters</span>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  )
}

export default function DocPage() {
  return (
    <ErrorBoundary>
      <DocPageContent />
    </ErrorBoundary>
  )
}
