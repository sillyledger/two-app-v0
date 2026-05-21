"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, LayoutGrid, List } from "lucide-react"
import Sidebar from "@/components/sidebar"

const COLLECTIONS = [
  {
    id: "1",
    title: "Product Design System",
    description: "UI patterns, component notes, design tokens and decision logs.",
    icon: "📘",
    color: "#3b82f6",
    bgGradient: "linear-gradient(135deg, #192033 0%, #171726 100%)",
    borderColor: "#2a3a5e",
    noteCount: 18,
    updatedAt: "2h ago",
    pinned: true,
    size: "xl",
    previewNotes: ["Color palette decisions", "Typography scale notes", "Spacing system v2"],
  },
  {
    id: "2",
    title: "Launch Checklist",
    description: "Everything before shipping TWO to production.",
    icon: "🚀",
    color: "#8b5cf6",
    bgGradient: "linear-gradient(135deg, #1e1a30 0%, #171720 100%)",
    borderColor: "#3a2a5e",
    noteCount: 9,
    updatedAt: "Today",
    pinned: true,
    size: "lg",
    previewNotes: ["Auth edge cases", "Error states review"],
  },
  {
    id: "3",
    title: "Engineering Log",
    description: "Build notes, bugs found, decisions made.",
    icon: "⚙️",
    color: "#3b82f6",
    bgGradient: "var(--bg-secondary)",
    borderColor: "var(--border)",
    noteCount: 22,
    updatedAt: "Yesterday",
    pinned: false,
    size: "tall",
    previewNotes: ["Turbopack config", "Neon DB schema", "Auth flow notes", "Vercel deploy log"],
  },
  {
    id: "4",
    title: "Ideas & Drafts",
    description: "",
    icon: "💡",
    color: "#22c55e",
    bgGradient: "var(--bg-secondary)",
    borderColor: "var(--border)",
    noteCount: 6,
    updatedAt: "3d ago",
    pinned: false,
    size: "sm",
    previewNotes: [],
  },
  {
    id: "5",
    title: "Roadmap Notes",
    description: "",
    icon: "📊",
    color: "#f59e0b",
    bgGradient: "var(--bg-secondary)",
    borderColor: "var(--border)",
    noteCount: 11,
    updatedAt: "1w ago",
    pinned: false,
    size: "sm",
    previewNotes: [],
  },
  {
    id: "6",
    title: "Writing & Content",
    description: "Blog posts, docs, copy drafts",
    icon: "✍️",
    color: "#8b5cf6",
    bgGradient: "var(--bg-secondary)",
    borderColor: "var(--border)",
    noteCount: 8,
    updatedAt: "4d ago",
    pinned: false,
    size: "wide",
    previewNotes: [],
  },
  {
    id: "7",
    title: "Meeting Notes",
    description: "",
    icon: "🗓️",
    color: "#ec4899",
    bgGradient: "var(--bg-secondary)",
    borderColor: "var(--border)",
    noteCount: 5,
    updatedAt: "5d ago",
    pinned: false,
    size: "med",
    previewNotes: ["Investor call — May 2", "Design review", "Team sync"],
  },
]

const STATS = { totalNotes: 47, collections: 12, shared: 3 }

const ACCENT_BORDER: Record<string, string> = {
  "#3b82f6": "2px solid #3b82f6",
  "#8b5cf6": "2px solid #8b5cf6",
  "#22c55e": "2px solid #22c55e",
  "#f59e0b": "2px solid #f59e0b",
  "#ec4899": "2px solid #ec4899",
}

const ICON_BG: Record<string, string> = {
  "#3b82f6": "rgba(59,130,246,0.15)",
  "#8b5cf6": "rgba(139,92,246,0.15)",
  "#22c55e": "rgba(34,197,94,0.15)",
  "#f59e0b": "rgba(245,158,11,0.15)",
  "#ec4899": "rgba(236,72,153,0.15)",
}

export default function LibraryPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [filter, setFilter] = useState<"all" | "pinned">("all")
  const [view, setView] = useState<"grid" | "list">("grid")

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved === "true") setCollapsed(true)
  }, [])

  const pinned = COLLECTIONS.filter((c) => c.pinned)
  const all = COLLECTIONS.filter((c) => !c.pinned)
  const filtered = filter === "pinned" ? pinned : COLLECTIONS

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <main className="flex-1 overflow-y-auto">
        {/* Topbar */}
        <div
          className="flex items-center justify-between px-8 py-4 sticky top-0 z-10"
          style={{
            backgroundColor: "var(--bg)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Library
          </span>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div
              className="flex rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}
            >
              <button
                onClick={() => setView("grid")}
                className="px-2.5 py-1.5 flex items-center transition-colors"
                style={{
                  backgroundColor: view === "grid" ? "var(--bg-tertiary)" : "transparent",
                  color: view === "grid" ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setView("list")}
                className="px-2.5 py-1.5 flex items-center transition-colors"
                style={{
                  backgroundColor: view === "list" ? "var(--bg-tertiary)" : "transparent",
                  color: view === "list" ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                <List size={13} />
              </button>
            </div>
            {/* New collection button */}
            <button
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
              style={{ backgroundColor: "var(--text-primary)", color: "var(--bg)" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              <Plus size={13} />
              New Collection
            </button>
          </div>
        </div>

        <div className="px-8 py-6">
          {/* Filter bar */}
          <div className="flex items-center gap-3 mb-8">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", width: 220 }}
            >
              <svg width="12" height="12" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Search collections...</span>
            </div>
            {(["all", "pinned"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors capitalize"
                style={{
                  border: "1px solid var(--border)",
                  backgroundColor: filter === f ? "rgba(59,130,246,0.08)" : "var(--bg-secondary)",
                  color: filter === f ? "#60a5fa" : "var(--text-muted)",
                  borderColor: filter === f ? "#3b82f6" : "var(--border)",
                }}
              >
                {f === "all" ? "All" : "Pinned"}
              </button>
            ))}
          </div>

          {view === "grid" ? (
            <>
              {/* Pinned section */}
              {filter !== "pinned" && (
                <>
                  <SectionLabel>Pinned</SectionLabel>
                  <div
                    className="grid gap-3 mb-4"
                    style={{ gridTemplateColumns: "repeat(12, 1fr)", gridAutoRows: "72px" }}
                  >
                    {/* Stats card */}
                    <div
                      className="rounded-2xl p-5 flex flex-col justify-between"
                      style={{
                        gridColumn: "span 3",
                        gridRow: "span 4",
                        backgroundColor: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>This month</p>
                      <div>
                        <p className="text-[38px] font-black leading-none" style={{ color: "var(--text-primary)" }}>{STATS.totalNotes}</p>
                        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Total notes</p>
                      </div>
                      <div>
                        <p className="text-[30px] font-black leading-none" style={{ color: "#4ade80" }}>{STATS.collections}</p>
                        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Collections</p>
                      </div>
                      <div>
                        <p className="text-[30px] font-black leading-none" style={{ color: "#a78bfa" }}>{STATS.shared}</p>
                        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Shared</p>
                      </div>
                    </div>

                    {/* XL pinned card */}
                    {pinned[0] && <BentoCard key={pinned[0].id} col={5} row={4} collection={pinned[0]} />}
                    {/* LG pinned card */}
                    {pinned[1] && <BentoCard key={pinned[1].id} col={4} row={4} collection={pinned[1]} />}
                  </div>
                </>
              )}

              {/* All collections section */}
              <SectionLabel>{filter === "pinned" ? "Pinned" : "All Collections"}</SectionLabel>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: "repeat(12, 1fr)", gridAutoRows: "72px" }}
              >
                {(filter === "pinned" ? pinned : all).map((c) => {
                  const colMap: Record<string, number> = { sm: 3, med: 4, wide: 5, tall: 3, lg: 4, xl: 5 }
                  const rowMap: Record<string, number> = { sm: 2, med: 3, wide: 2, tall: 4, lg: 4, xl: 4 }
                  return (
                    <BentoCard
                      key={c.id}
                      col={colMap[c.size] ?? 3}
                      row={rowMap[c.size] ?? 2}
                      collection={c}
                    />
                  )
                })}

                {/* New collection card */}
                <div
                  className="rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  style={{
                    gridColumn: "span 3",
                    gridRow: "span 2",
                    border: "1.5px dashed var(--border)",
                    backgroundColor: "transparent",
                    color: "var(--text-muted)",
                    fontSize: 12,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = "#3b82f6"
                    e.currentTarget.style.color = "#60a5fa"
                    e.currentTarget.style.backgroundColor = "rgba(59,130,246,0.03)"
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = "var(--border)"
                    e.currentTarget.style.color = "var(--text-muted)"
                    e.currentTarget.style.backgroundColor = "transparent"
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ border: "1.5px dashed var(--border)", fontSize: 18 }}
                  >
                    +
                  </div>
                  New Collection
                </div>
              </div>
            </>
          ) : (
            /* List view */
            <div className="flex flex-col gap-1">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-colors"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    borderLeft: ACCENT_BORDER[c.color] ?? "1px solid var(--border)",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--bg-secondary)")}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base"
                    style={{ backgroundColor: ICON_BG[c.color] ?? "var(--bg-tertiary)" }}
                  >
                    {c.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{c.title}</p>
                    {c.description && (
                      <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{c.description}</p>
                    )}
                  </div>
                  <div
                    className="text-[11px] px-2 py-1 rounded-md shrink-0"
                    style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}
                  >
                    {c.noteCount} notes
                  </div>
                  <p className="text-[11px] shrink-0" style={{ color: "var(--text-muted)", minWidth: 60, textAlign: "right" }}>
                    {c.updatedAt}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        {children}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
    </div>
  )
}

function BentoCard({ col, row, collection: c }: { col: number; row: number; collection: typeof COLLECTIONS[0] }) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col cursor-pointer overflow-hidden relative transition-colors"
      style={{
        gridColumn: `span ${col}`,
        gridRow: `span ${row}`,
        background: c.bgGradient,
        border: `1px solid ${c.borderColor}`,
        borderTop: ACCENT_BORDER[c.color] ?? `1px solid ${c.borderColor}`,
      }}
      onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.07)")}
      onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-base mb-3 shrink-0"
        style={{ backgroundColor: ICON_BG[c.color] ?? "var(--bg-tertiary)" }}
      >
        {c.icon}
      </div>

      {/* Title */}
      <p
        className={`font-bold leading-tight mb-1 ${row >= 4 ? "text-[18px]" : "text-[14px]"}`}
        style={{ color: "var(--text-primary)" }}
      >
        {c.title}
      </p>

      {/* Description */}
      {c.description && row >= 3 && (
        <p className="text-[12px] leading-relaxed mb-2" style={{ color: "var(--text-muted)" }}>
          {c.description}
        </p>
      )}

      {/* Preview notes */}
      {c.previewNotes.length > 0 && row >= 4 && (
        <div className="flex flex-col gap-1 mt-1 mb-2">
          {c.previewNotes.map((note, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px]"
              style={{
                backgroundColor: "rgba(0,0,0,0.15)",
                border: "1px solid rgba(255,255,255,0.04)",
                color: "var(--text-muted)",
              }}
            >
              <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: "var(--text-muted)", opacity: 0.4 }} />
              {note}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-2">
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]"
          style={{ backgroundColor: "rgba(0,0,0,0.2)", color: "var(--text-muted)" }}
        >
          📄 {c.noteCount} notes
        </div>
        <span className="text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
          {c.updatedAt}
        </span>
      </div>
    </div>
  )
}
