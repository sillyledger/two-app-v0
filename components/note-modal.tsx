'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Note } from '@/lib/db'

interface NoteModalProps {
  note?: Note | null
  isOpen: boolean
  onClose: () => void
  onSave: (data: { title: string; content: string; color: string }) => void
}

const colors = [
  { name: 'yellow', class: 'bg-[#FFD966]' },
  { name: 'coral', class: 'bg-[#FF9B7A]' },
  { name: 'lime', class: 'bg-[#D4E157]' },
  { name: 'purple', class: 'bg-[#CE93D8]' },
  { name: 'cyan', class: 'bg-[#4DD0E1]' },
]

export function NoteModal({ note, isOpen, onClose, onSave }: NoteModalProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [color, setColor] = useState('yellow')

  useEffect(() => {
    if (note) {
      setTitle(note.title)
      setContent(note.content || '')
      setColor(note.color)
    } else {
      setTitle('')
      setContent('')
      setColor('yellow')
    }
  }, [note, isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSave({ title, content, color })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {note ? 'Edit Note' : 'New Note'}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className="w-full rounded-lg border border-input bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label htmlFor="content" className="mb-1 block text-sm font-medium">
              Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note..."
              rows={4}
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium">Color</span>
            <div className="flex gap-2">
              {colors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColor(c.name)}
                  className={cn(
                    'h-8 w-8 rounded-full transition-transform',
                    c.class,
                    color === c.name && 'ring-2 ring-foreground ring-offset-2'
                  )}
                  aria-label={`Select ${c.name} color`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
            >
              {note ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
