"use client"

import { useEffect, useState } from "react"
import { X, RotateCcw } from "lucide-react"

interface Version {
  id: number
  title: string | null
  content: string | null
  editor_name: string | null
  created_at: string
}

interface VersionHistoryModalProps {
  docId: string
  docTitle: string
  onClose: () => void
  onRestore: (title: string, content: string) => void
}

// Same per-editor color set used for presence avatars elsewhere in the doc topbar.
const AVATAR_COLORS = ['#52e0b8', '#e05252', '#f5a623', '#a052e0', '#52b8e0', '#52e052', '#e052a0']

function avatarColor(name: string | null): string {
  const key = name || '?'
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

// Same day-bucketing key format used by app/activity/page.tsx's groupByDay.
function groupByDay(versions: Version[]): Record<string, Version[]> {
  const groups: Record<string, Version[]> = {}
  for (const v of versions) {
    const date = new Date(v.created_at)
    const key = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(v)
  }
  return groups
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function stripHtml(html: string | null): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function VersionHistoryModal({ docId, docTitle, onClose, onRestore }: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    fetch(`/api/docs/${docId}/versions`)
      .then(r => r.json())
      .then((data: Version[]) => {
        const list = Array.isArray(data) ? data : []
        setVersions(list)
        if (list.length > 0) setSelectedId(list[0].id)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [docId])

  const selected = versions.find(v => v.id === selectedId) ?? null
  const grouped = groupByDay(versions)
  const days = Object.keys(grouped)

  const handleRestore = async () => {
    if (!selected) return
    setRestoring(true)
    try {
      const res = await fetch(`/api/docs/${docId}/versions/${selected.id}/restore`, { method: 'POST' })
      if (res.ok) {
        const doc = await res.json()
        onRestore(doc.title || '', doc.content || '')
      }
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative rounded-xl shadow-2xl w-full max-w-[560px] max-h-[70vh] flex flex-col z-10" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            Version history · <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{docTitle || "Untitled"}</span>
          </h2>
          <button onClick={onClose} className="flex items-center justify-center w-6 h-6 rounded-md transition-colors shrink-0" style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          ><X size={14} /></button>
        </div>

        <div className="flex flex-1 min-h-0">

          {/* Left column — version list, grouped by day */}
          <div className="overflow-y-auto shrink-0" style={{ width: 180, borderRight: "1px solid var(--border)" }}>
            {loading && <p className="text-[12px] px-3 py-4" style={{ color: "var(--text-muted)" }}>Loading...</p>}
            {!loading && versions.length === 0 && (
              <p className="text-[12px] px-3 py-4" style={{ color: "var(--text-muted)" }}>No versions yet</p>
            )}
            {!loading && days.map(day => (
              <div key={day}>
                <p className="px-3 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{day}</p>
                {grouped[day].map(v => {
                  const isSelected = v.id === selectedId
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedId(v.id)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors"
                      style={{ backgroundColor: isSelected ? "var(--bg-tertiary)" : "transparent" }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)" }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent" }}
                    >
                      <span
                        className="flex items-center justify-center rounded-full shrink-0"
                        style={{ width: 18, height: 18, fontSize: 9, fontWeight: 600, color: "#fff", backgroundColor: avatarColor(v.editor_name) }}
                      >
                        {initials(v.editor_name)}
                      </span>
                      <span className="text-[12px] truncate" style={{ color: isSelected ? "var(--text-primary)" : "var(--text-secondary)" }}>
                        {formatTime(v.created_at)}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Right column — preview + restore */}
          <div className="flex-1 min-w-0 flex flex-col">
            {selected ? (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
                  <p className="text-[15px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{selected.title || "Untitled"}</p>
                  <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                    {stripHtml(selected.content).slice(0, 4000) || "No content"}
                  </p>
                </div>
                <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
                  <button
                    onClick={handleRestore}
                    disabled={restoring}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-[12.5px] font-medium transition-colors"
                    style={{ backgroundColor: "#6b5ce7", color: "#fff", cursor: restoring ? "wait" : "pointer" }}
                    onMouseEnter={e => { if (!restoring) e.currentTarget.style.backgroundColor = "#7c6ef0" }}
                    onMouseLeave={e => { if (!restoring) e.currentTarget.style.backgroundColor = "#6b5ce7" }}
                  >
                    <RotateCcw size={13} /> {restoring ? "Restoring..." : "Restore this version"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{loading ? "" : "No version selected"}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
