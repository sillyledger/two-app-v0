"use client"

import { Pin, MoreVertical, Trash2, Pencil, FolderInput } from "lucide-react"
import { formatDate, getUserDatePrefs } from "@/lib/format-date"

export interface FolderData {
  id: string
  name: string
  doc_count: number | string
  last_edited: string | null
  pinned: boolean
  workspace_id?: string | null
  parent_id?: string | null
  [key: string]: unknown
}

export const ACCENT_COLORS = [
  "#EF9F27", "#85B7EB", "#5DCAA5", "#F0997B",
  "#AFA9EC", "#97C459", "#ED93B1", "#B4B2A9", "#5DCAA5",
]

export function getAccent(index: number) {
  return ACCENT_COLORS[index % ACCENT_COLORS.length]
}

let hasMountedOnClient = false

export function markFolderCardMounted() {
  hasMountedOnClient = true
}

export function formatRelative(dateStr: string | null) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay >= 30) {
    const { timezone, dateFormat } = hasMountedOnClient
      ? getUserDatePrefs()
      : { timezone: "UTC+0", dateFormat: "MMM D, YYYY" }
    return formatDate(date, dateFormat, timezone)
  }
  if (diffDay >= 1) return `${diffDay}d ago`
  if (diffHr >= 1) return `${diffHr}h ago`
  if (diffMin >= 1) return `${diffMin}m ago`
  return "just now"
}

export function FolderIcon({ color, compact }: { color: string; compact?: boolean }) {
  if (compact) {
    return (
      <div style={{ position: "relative", height: "30px", width: "30px", marginBottom: "8px" }}>
        <div style={{ position: "absolute", left: 0, top: "2px", width: "28px", height: "20px", borderRadius: "5px", backgroundColor: color, opacity: 0.35 }} />
        <div style={{ position: "absolute", left: 0, top: "6px", width: "28px", height: "20px", borderRadius: "5px", backgroundColor: color }} />
      </div>
    )
  }
  return (
    <div style={{ position: "relative", height: "54px", width: "54px", marginBottom: "14px" }}>
      <div style={{ position: "absolute", left: 0, top: "4px", width: "50px", height: "36px", borderRadius: "7px", backgroundColor: color, opacity: 0.35 }} />
      <div style={{ position: "absolute", left: 0, top: "11px", width: "50px", height: "36px", borderRadius: "7px", backgroundColor: color }} />
    </div>
  )
}

export function FolderCard({
  folder,
  accentColor,
  isMenuOpen,
  menuRef,
  onToggleMenu,
  onTogglePin,
  onOpen,
  isRenaming,
  renameValue,
  onRenameChange,
  renameInputRef,
  onCommitRename,
  onCancelRename,
  onStartRename,
  onMove,
  onDelete,
  compact,
}: {
  folder: FolderData
  accentColor: string
  isMenuOpen: boolean
  menuRef: React.RefObject<HTMLDivElement | null>
  onToggleMenu: (id: string, e: React.MouseEvent) => void
  onTogglePin: (folder: FolderData, e: React.MouseEvent) => void
  onOpen: (folder: FolderData) => void
  isRenaming: boolean
  renameValue: string
  onRenameChange: (v: string) => void
  renameInputRef: React.RefObject<HTMLInputElement | null>
  onCommitRename: (folder: FolderData) => void
  onCancelRename: () => void
  onStartRename: (folder: FolderData, e: React.MouseEvent) => void
  onMove: (folder: FolderData, e: React.MouseEvent) => void
  onDelete: (folder: FolderData, e: React.MouseEvent) => void
  compact?: boolean
}) {
  const docCount = Number(folder.doc_count) || 0
  const relative = formatRelative(folder.last_edited)
  const countLabel = `${docCount} ${docCount === 1 ? "doc" : "docs"}`
  return (
    <div
      className="relative rounded-xl transition-colors cursor-pointer"
      style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", padding: compact ? "12px" : "18px", borderRadius: compact ? "10px" : "12px" }}
      onClick={() => { if (!isRenaming) onOpen(folder) }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; e.currentTarget.style.borderColor = "var(--text-muted)" }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = "var(--bg-secondary)"; e.currentTarget.style.borderColor = "var(--border)" }}
    >
      <div className="absolute flex items-center gap-1.5" style={{ top: compact ? 8 : 14, right: compact ? 8 : 14 }}>
        <div style={{ position: "relative" }} ref={isMenuOpen ? menuRef : undefined}>
          <button
            onClick={e => onToggleMenu(folder.id, e)}
            title="More options"
            className="transition-opacity"
            style={{ color: "var(--text-muted)", opacity: isMenuOpen ? 1 : 0.4 }}
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
                background: "#242428", border: "1px solid rgba(255,255,255,0.09)",
              }}
            >
              <button
                onClick={e => onStartRename(folder, e)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
                  fontSize: 13, color: "var(--text-muted)", background: "transparent", border: "none",
                  cursor: "pointer", textAlign: "left",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <Pencil size={12} /> Rename
              </button>
              <button
                onClick={e => onMove(folder, e)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
                  fontSize: 13, color: "var(--text-muted)", background: "transparent", border: "none",
                  cursor: "pointer", textAlign: "left",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <FolderInput size={12} /> Move
              </button>
              <button
                onClick={e => onDelete(folder, e)}
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
        {!compact && (
          <button
            onClick={e => onTogglePin(folder, e)}
            title={folder.pinned ? "Unpin from homepage" : "Pin to homepage"}
            className="transition-opacity"
            style={{
              color: folder.pinned ? "#EF9F27" : "var(--text-muted)",
              opacity: folder.pinned ? 1 : 0.4,
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={e => (e.currentTarget.style.opacity = folder.pinned ? "1" : "0.4")}
          >
            <Pin size={14} fill={folder.pinned ? "#EF9F27" : "none"} />
          </button>
        )}
      </div>

      <FolderIcon color={accentColor} compact={compact} />

      {isRenaming ? (
        <input
          ref={renameInputRef}
          value={renameValue}
          onChange={e => onRenameChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          onBlur={() => onCommitRename(folder)}
          onKeyDown={e => {
            if (e.key === "Enter") onCommitRename(folder)
            if (e.key === "Escape") onCancelRename()
          }}
          className="font-semibold mb-1 w-full rounded outline-none"
          style={{ fontSize: compact ? "12.5px" : "14px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "1px 4px" }}
        />
      ) : (
        <p
          className="font-semibold mb-1"
          style={compact
            ? { color: "var(--text-primary)", fontSize: "12.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
            : { color: "var(--text-primary)", fontSize: "14px" }}
        >
          {folder.name}
        </p>
      )}

      {compact ? (
        <p className="text-[10.5px]" style={{ color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {countLabel}{relative ? ` · ${relative}` : ""}
        </p>
      ) : (
        <>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{countLabel}</p>
          <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
            {relative ? `Edited ${relative}` : "No docs yet"}
          </p>
        </>
      )}
    </div>
  )
}
