"use client"

import { MoreVertical, Trash2 } from "lucide-react"
import { formatRelative } from "@/components/folder-card"

export interface NoteCategoryData {
  id: number
  name: string
  color: string
  parent_id: number | null
}

export function NoteCategoryIcon({ color }: { color: string }) {
  return (
    <div style={{ position: "relative", height: "54px", width: "54px", marginBottom: "14px" }}>
      <div style={{ position: "absolute", left: "9px", top: 0, width: "36px", height: "54px", borderRadius: "6px", backgroundColor: color }} />
      <div style={{ position: "absolute", left: "9px", top: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "0 12px 12px 0", borderColor: "transparent var(--bg-secondary) transparent transparent", borderTopRightRadius: "6px" }} />
      <div style={{ position: "absolute", left: "9px", top: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "0 12px 12px 0", borderColor: "transparent rgba(0,0,0,0.18) transparent transparent", borderTopRightRadius: "6px" }} />
      <div style={{ position: "absolute", left: "15px", top: "24px", width: "24px" }}>
        <div style={{ height: "2.5px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.55)", marginBottom: "5px" }} />
        <div style={{ height: "2.5px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.55)", marginBottom: "5px" }} />
        <div style={{ height: "2.5px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.55)" }} />
      </div>
    </div>
  )
}

export function NoteCategoryCard({
  category,
  noteCount,
  lastEdited,
  isMenuOpen,
  menuRef,
  onToggleMenu,
  onOpen,
  onDelete,
}: {
  category: NoteCategoryData
  noteCount: number
  lastEdited: string | null
  isMenuOpen: boolean
  menuRef: React.RefObject<HTMLDivElement | null>
  onToggleMenu: (id: number, e: React.MouseEvent) => void
  onOpen: (category: NoteCategoryData) => void
  onDelete: (category: NoteCategoryData, e: React.MouseEvent) => void
}) {
  const relative = formatRelative(lastEdited)
  return (
    <div
      className="relative rounded-xl p-[18px] transition-colors cursor-pointer"
      style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      onClick={() => onOpen(category)}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.borderColor = "var(--text-muted)" }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; e.currentTarget.style.borderColor = "var(--border)" }}
    >
      <div className="absolute top-3.5 right-3.5">
        <div style={{ position: "relative" }} ref={isMenuOpen ? menuRef : undefined}>
          <button
            onClick={e => onToggleMenu(category.id, e)}
            title="More options"
            className="transition-opacity"
            style={{ color: "var(--text-muted)", opacity: isMenuOpen ? 1 : 0.4 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={e => (e.currentTarget.style.opacity = isMenuOpen ? "1" : "0.4")}
          >
            <MoreVertical size={14} />
          </button>
          {isMenuOpen && (
            <div
              style={{
                position: "absolute", right: 0, top: 20, zIndex: 50,
                borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                width: 130, padding: "4px 0", overflow: "hidden",
                background: "#242428", border: "1px solid rgba(255,255,255,0.09)",
              }}
            >
              <button
                onClick={e => onDelete(category, e)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
                  fontSize: 13, color: "#f87171", background: "transparent", border: "none",
                  cursor: "pointer", textAlign: "left",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <NoteCategoryIcon color={category.color} />

      <p className="font-semibold text-[14px] mb-1" style={{ color: "var(--text-primary)" }}>{category.name}</p>
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{noteCount} {noteCount === 1 ? "note" : "notes"}</p>
      <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
        {relative ? `Edited ${relative}` : "No notes yet"}
      </p>
    </div>
  )
}
