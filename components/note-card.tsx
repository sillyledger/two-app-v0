'use client'

import { Star, Pencil } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Note } from '@/lib/db'

interface NoteCardProps {
  note: Note
  onEdit: (note: Note) => void
  onToggleStar: (note: Note) => void
}

const colorClasses: Record<string, string> = {
  yellow: 'bg-[#FFD966]',
  coral: 'bg-[#FF9B7A]',
  lime: 'bg-[#D4E157]',
  purple: 'bg-[#CE93D8]',
  cyan: 'bg-[#4DD0E1]',
}

export function NoteCard({ note, onEdit, onToggleStar }: NoteCardProps) {
  const bgColor = colorClasses[note.color] || colorClasses.yellow

  return (
    <article
      className={cn(
        'relative flex h-64 flex-col justify-between rounded-2xl p-6 transition-transform hover:scale-[1.02]',
        bgColor
      )}
    >
      {note.is_starred && (
        <button
          onClick={() => onToggleStar(note)}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-yellow-400"
          aria-label="Remove from favorites"
        >
          <Star className="h-4 w-4 fill-current" />
        </button>
      )}

      <h3 className="pr-10 text-lg font-semibold leading-tight text-foreground">
        {note.title}
      </h3>

      <div className="flex items-center justify-between">
        <time className="text-sm text-foreground/70">
          {format(new Date(note.created_at), 'MMM d, yyyy')}
        </time>
        <button
          onClick={() => onEdit(note)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-110"
          aria-label="Edit note"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    </article>
  )
}
