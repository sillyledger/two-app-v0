"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw, Trash2 } from "lucide-react"
import Sidebar from "@/components/sidebar"

interface Doc {
  id: string
  title: string
  content: string
  deleted_at: string
}

const FONT = "'DM Sans', system-ui, sans-serif"
const MUTED = "#6a6a74"

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function TrashPage() {
  const router = useRouter()
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") setCollapsed(true)
  }, [])

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (!res.ok) router.push("/login")
    })
  }, [])

  useEffect(() => {
    fetch("/api/trash")
      .then((r) => r.json())
      .then((data: Doc[]) => {
        setDocs(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleRestore = async (id: string) => {
    await fetch(`/api/trash/${id}`, { method: "PUT" })
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  const handlePermanentDelete = async (id: string) => {
    await fetch(`/api/trash/${id}`, { method: "DELETE" })
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  const handleEmptyTrash = async () => {
    if (!window.confirm("Permanently delete all items in Trash? This cannot be undone.")) return
    await Promise.all(docs.map((d) => fetch(`/api/trash/${d.id}`, { method: "DELETE" })))
    setDocs([])
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#111113", fontFamily: FONT }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => {
          const next = !collapsed
          setCollapsed(next)
          localStorage.setItem("sidebar-collapsed", String(next))
        }}
      />

      <main style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 40px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: "#eeede7", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Trash</h1>
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Deleted docs are removed permanently after 30 days</p>
            </div>
            {docs.length > 0 && (
              <button
                onClick={handleEmptyTrash}
                style={{ fontSize: 12, fontWeight: 500, color: "#e05252", background: "rgba(224,82,82,0.08)", border: "1px solid rgba(224,82,82,0.18)", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontFamily: FONT, marginTop: 4 }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(224,82,82,0.14)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(224,82,82,0.08)")}
              >
                Empty Trash
              </button>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)" }} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && docs.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 240 }}>
              <Trash2 size={32} style={{ color: "#2a2a32", marginBottom: 12 }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: "#4a4a52", margin: "0 0 4px" }}>Trash is empty</p>
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Deleted docs will appear here</p>
            </div>
          )}

          {/* Doc list */}
          {!loading && docs.length > 0 && (
            <>
              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 80px", padding: "6px 12px", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#4a4a52" }}>Name</span>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#4a4a52" }}>Deleted</span>
                <span />
              </div>

              {/* Rows */}
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  style={{ display: "grid", gridTemplateColumns: "1fr 140px 80px", alignItems: "center", padding: "11px 12px", borderRadius: 10, background: "transparent", transition: "background 0.12s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 13, opacity: 0.4, flexShrink: 0, lineHeight: 1 }}>▣</span>
                    <span style={{ fontSize: 13.5, color: "#b0afb8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.title || "Untitled"}
                    </span>
                  </div>

                  <span style={{ fontSize: 12, color: "#4a4a52" }}>{formatDate(doc.deleted_at)}</span>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => handleRestore(doc.id)}
                      title="Restore"
                      style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 4, borderRadius: 6, display: "flex" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#e8e7e1")}
                      onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(doc.id)}
                      title="Delete permanently"
                      style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 4, borderRadius: 6, display: "flex" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#e05252")}
                      onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

        </div>
      </main>
    </div>
  )
}
