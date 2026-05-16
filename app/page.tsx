"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import Sidebar from "@/components/sidebar"

interface Note {
  id: string
  title: string
  content: string
  created_at: string
}

const CARD_COLORS = [
  "#FFF0C2",
  "#FFD6D6",
  "#D6F0D6",
  "#E0D6FF",
  "#FFFBD6",
  "#D6EFFF",
]

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export default function HomePage() {
  const router = useRouter()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((data) => {
        setNotes(Array.isArray(data) ? data.slice(0, 6) : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleCreateNote = async () => {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled", content: "", color: "yellow" }),
      })
      const note = await res.json()
      router.push(`/notes/${note.id}`)
    } catch {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-screen bg-[#f5f5f5] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-10 py-8">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={handleCreateNote}
            disabled={creating}
            className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors shrink-0"
            title="New Note"
          >
            <Plus size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Personal</h1>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <p className="text-lg font-medium mb-2">No notes yet</p>
            <p className="text-sm">Click the + button to create your first note</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {notes.map((note, i) => (
              <button
                key={note.id}
                onClick={() => router.push(`/notes/${note.id}`)}
                className="text-left p-5 rounded-2xl transition-transform hover:scale-[1.02] active:scale-[0.98] flex flex-col justify-between min-h-[172px]"
                style={{ backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }}
              >
                <p className="font-semibold text-gray-900 text-[15px] leading-snug line-clamp-3">
                  {note.title || "Untitled"}
                </p>
                <p className="text-xs text-gray-500 mt-4">
                  {formatDate(note.created_at)}
                </p>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
