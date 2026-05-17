"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, FileText } from "lucide-react"
import Sidebar from "@/components/sidebar"

interface Doc {
  id: string
  title: string
  content: string
  type: string
  created_at: string
  updated_at: string
}

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function stripHtml(html: string) {
  if (!html) return ""
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

export default function LibraryPage() {
  const router = useRouter()
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((data) => {
        setDocs(Array.isArray(data) ? data : [])
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
      router.push(`/docs/${doc.id}`)
    } catch {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-screen bg-[#f5f5f5] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Library</h1>
            <button
              onClick={handleCreateDoc}
              disabled={creating}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-black text-white text-sm hover:bg-gray-800 transition-colors"
            >
              <Plus size={15} />
              New Doc
            </button>
          </div>

          {/* Column Headers */}
          <div className="grid grid-cols-[1fr_120px_120px] gap-4 px-3 mb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Name</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Type</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Updated</span>
          </div>

          <div className="border border-[#E0E0E0] rounded-xl overflow-hidden bg-white">
            {loading ? (
              <div className="divide-y divide-[#F0F0F0]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 px-3 flex items-center">
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-48" />
                  </div>
                ))}
              </div>
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <p className="text-sm font-medium mb-1">No docs yet</p>
                <p className="text-xs">Click New Doc to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F0F0F0]">
                {docs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => router.push(`/docs/${doc.id}`)}
                    className="w-full grid grid-cols-[1fr_120px_120px] gap-4 px-3 py-3 hover:bg-[#F8F8F8] transition-colors text-left items-center"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText size={15} className="text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-900 truncate font-medium">
                        {doc.title || "Untitled"}
                      </span>
                      {doc.content && (
                        <span className="text-xs text-gray-400 truncate hidden sm:block">
                          — {stripHtml(doc.content).slice(0, 60)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 capitalize">{doc.type}</span>
                    <span className="text-xs text-gray-400 text-right">{formatDate(doc.updated_at)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
