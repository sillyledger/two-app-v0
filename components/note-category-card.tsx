"use client"

import { MoreVertical, Trash2 } from "lucide-react"
import { formatRelative } from "@/components/folder-card"

export interface NoteCategoryData {
  id: number
  name: string
  color: string
  parent_id: number | null
}

export function NoteCategoryIcon({ color, compact }: { color: string; compact?: boolean }) {
  if (compact) {
    return (
      <div style={{ position: "relative", height: "30px", width: "30px", marginBottom: "8px" }}>
        <div style={{ position: "absolute", left: "6px", top: 0, width: "18px", height: "30px", borderRadius: "4px", backgroundColor: color }} />
        <div style={{ position: "absolute", left: "6px", top: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "0 7px 7px 0", borderColor: "transparent var(--surface) transparent transparent", borderTopRightRadius: "4px" }} />
        <div style={{ position: "absolute", left: "6px", top: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "0 7px 7px 0", borderColor: "transparent rgba(0,0,0,0.18) transparent transparent", borderTopRightRadius: "4px" }} />
      </div>
    )
  }
  return (
    <div style={{ position: "relative", height: "54px", width: "54px", marginBottom: "14px" }}>
      <div style={{ position: "absolute", left: "9px", top: 0, width: "36px", height: "54px", borderRadius: "6px", backgroundColor: color }} />
      <div style={{ position: "absolute", left: "9px", top: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "0 12px 12px 0", borderColor: "transparent var(--surface) transparent transparent", borderTopRightRadius: "6px" }} />
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
  compact,
}: {
  category: NoteCategoryData
  noteCount: number
  lastEdited: string | null
  isMenuOpen: boolean
  menuRef: React.RefObject<HTMLDivElement | null>
  onToggleMenu: (id: number, e: React.MouseEvent) => void
  onOpen: (category: NoteCategoryData) => void
  onDelete: (category: NoteCategoryData, e: React.MouseEvent) => void
  compact?: boolean
}) {
  const relative = formatRelative(lastEdited)
  const countLabel = `${noteCount} ${noteCount === 1 ? "note" : "notes"}`
  return (
    <div
      className="relative rounded-xl transition-colors cursor-pointer"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)", padding: compact ? "12px" : "18px", borderRadius: compact ? "10px" : "12px" }}
      onClick={() => onOpen(category)}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--surface-2)"; e.currentTarget.style.borderColor = "var(--text-3)" }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = "var(--surface)"; e.currentTarget.style.borderColor = "var(--border-subtle)" }}
    >
      <div className="absolute" style={{ top: compact ? 8 : 14, right: compact ? 8 : 14 }}>
        <div style={{ position: "relative" }} ref={isMenuOpen ? menuRef : undefined}>
          <button
            onClick={e => onToggleMenu(category.id, e)}
            title="More options"
            className="transition-opacity"
            style={{ color: "var(--text-3)", opacity: isMenuOpen ? 1 : 0.4 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={e => (e.currentTarget.style.opacity = isMenuOpen ? "1" : "0.4")}
          >
            <MoreVertical size={compact ? 12 : 14} />
          </button>
          {isMenuOpen && (
            <div
              style={{
                position: "absolute", right: 0, top: 20, zIndex: 50,
                borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                width: 130, padding: "4px 0", overflow: "hidden",
                background: "var(--menu-bg)", border: "1px solid var(--border-subtle)",
              }}
            >
              <button
                onClick={e => onDelete(category, e)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
                  fontSize: 13, color: "var(--danger)", background: "transparent", border: "none",
                  cursor: "pointer", textAlign: "left",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <NoteCategoryIcon color={category.color} compact={compact} />

      <p
        className="font-semibold mb-1"
        style={compact
          ? { color: "var(--text-1)", fontSize: "12.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
          : { color: "var(--text-1)", fontSize: "14px" }}
      >
        {category.name}
      </p>

      {compact ? (
        <p className="text-[10.5px]" style={{ color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {countLabel}{relative ? ` · ${relative}` : ""}
        </p>
      ) : (
        <>
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>{countLabel}</p>
          <p className="text-[11px] mt-2" style={{ color: "var(--text-3)" }}>
            {relative ? `Edited ${relative}` : "No notes yet"}
          </p>
        </>
      )}
    </div>
  )
}
