"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import Sidebar from "@/components/sidebar"

interface Doc {
  id: string
  uuid: string
  title: string
  content: string
  type: string
  created_at: string
}

const CARD_COLORS = [
  "#2a2520",
  "#2a1f1f",
  "#1a2a1f",
  "#1f1a2a",
  "#2a2a1a",
  "#1a2228",
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

function stripHtml(html: string) {
  if (!html) return ""
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

export default function HomePage() {
  const router = useRouter()
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((data) => {
        setDocs(Array.isArray(data) ? data.slice(0, 9) : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleCreateDoc = async () => {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled", content: "", color: "yellow", type: "doc" }),
      })
      const doc = await res.json()
      router.push(`/docs/${doc.uuid}`)
    } catch {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-screen bg-[#1a1a1a] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-[#e8e8e8]">Recent Docs</h1>
            <button
              onClick={handleCreateDoc}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/20 text-[#e8e8e8] text-sm font-medium hover:bg-white/10 transition-colors"
            >
              <Plus size={15} />
              {creating ? "Creating..." : "Create Doc"}
            </button>
          </div>

          {/* Docs Grid */}
          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-44 rounded-2xl bg-[#2a2a2a] animate-pulse" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#666]">
              <p className="text-lg font-medium mb-2">No docs yet</p>
              <p className="text-sm">Click + Create Doc to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {docs.map((doc, i) => (
                <button
                  key={doc.uuid}
                  onClick={() => router.push(`/docs/${doc.uuid}`)}
                  className="text-left p-5 rounded-2xl transition-transform hover:scale-[1.02] active:scale-[0.98] flex flex-col justify-between min-h-[172px]"
                  style={{ backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }}
                >
                  <div>
                    <p className="font-semibold text-[#e8e8e8] text-[15px] leading-snug mb-2">
                      {doc.title || "Untitled"}
                    </p>
                    <p className="text-xs text-[#aaa] leading-relaxed line-clamp-3">
                      {stripHtml(doc.content)}
                    </p>
                  </div>
                  <p className="text-xs text-[#777] mt-4">
                    {formatDate(doc.created_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
