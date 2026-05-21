"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, FileText } from "lucide-react"
import Sidebar from "@/components/sidebar"

interface Doc {
  id: string
  uuid: string
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") setSidebarCollapsed(true)
  }, [])

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
      router.push(`/docs/${doc.uuid}`)
    } catch {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg)" }}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Library</h1>
            <button
              onClick={handleCreateDoc}
              disabled={creating}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
              style={{ backgroundColor: "var(--text-primary)", color: "var(--bg)" }}
            >
              <Plus size={15} />
              New Doc
            </button>
          </div>

          {/* Column Headers */}
          <div className="grid grid-cols-[1fr_120px_120px] gap-4 px-3 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Name</span>
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Type</span>
            <span className="text-xs font-medium uppercase tracking-wider text-right" style={{ color: "var(--text-muted)" }}>Updated</span>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}>
            {loading ? (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 px-3 flex items-center">
                    <div className="h-3 rounded animate-pulse w-48" style={{ backgroundColor: "var(--bg-tertiary)" }} />
                  </div>
                ))}
              </div>
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48" style={{ color: "var(--text-muted)" }}>
                <p className="text-sm font-medium mb-1">No docs yet</p>
                <p className="text-xs">Click New Doc to get started</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {docs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => router.push(`/docs/${doc.uuid}`)}
                    className="w-full grid grid-cols-[1fr_120px_120px] gap-4 px-3 py-3 transition-colors text-left items-center"
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText size={15} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {doc.title || "Untitled"}
                      </span>
                      {doc.content && (
                        <span className="text-xs truncate hidden sm:block" style={{ color: "var(--text-muted)" }}>
                          — {stripHtml(doc.content).slice(0, 60)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{doc.type}</span>
                    <span className="text-xs text-right" style={{ color: "var(--text-muted)" }}>{formatDate(doc.updated_at)}</span>
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
