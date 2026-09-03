"use client"

import { useMemo, useState } from "react"
import { Search, Pin } from "lucide-react"
import { FolderIcon } from "./folder-icon"
import { folderColor } from "@/lib/folder-colors"
import { sortFoldersForMoveModal } from "@/lib/folder-tree"

interface MoveFolder {
  id: string
  name: string
  parent_id?: string | null
  pinned?: boolean
  [key: string]: unknown
}

interface MoveToFolderModalProps {
  folders: MoveFolder[]
  onMove: (folderId: string) => void
  onClose: () => void
}

function highlightMatch(name: string, query: string) {
  if (!query) return name
  const i = name.toLowerCase().indexOf(query.toLowerCase())
  if (i === -1) return name
  return (
    <>
      {name.slice(0, i)}
      <mark style={{ background: "none", color: "var(--text-primary)", fontWeight: 600, padding: 0, margin: 0 }}>
        {name.slice(i, i + query.length)}
      </mark>
      {name.slice(i + query.length)}
    </>
  )
}

export default function MoveToFolderModal({ folders, onMove, onClose }: MoveToFolderModalProps) {
  const [query, setQuery] = useState("")

  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    folders.forEach(f => map.set(f.id, f.name))
    return map
  }, [folders])

  // Depth-first tree order, with pinned root subtrees bubbled to the front
  const ordered = useMemo(() => {
    const flat = sortFoldersForMoveModal(folders)
    const chunks: (typeof flat)[] = []
    let current: typeof flat = []
    flat.forEach(f => {
      if (f.depth === 0) {
        if (current.length) chunks.push(current)
        current = [f]
      } else {
        current.push(f)
      }
    })
    if (current.length) chunks.push(current)
    chunks.sort((a, b) => (b[0]?.pinned ? 1 : 0) - (a[0]?.pinned ? 1 : 0))
    return chunks.flat()
  }, [folders])

  const trimmed = query.trim()
  const matches = trimmed
    ? ordered.filter(f => f.name.toLowerCase().includes(trimmed.toLowerCase()))
    : null

  const onRowEnter = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.backgroundColor = "var(--bg-tertiary)" }
  const onRowLeave = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.backgroundColor = "transparent" }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="rounded-2xl p-4 w-80 shadow-2xl" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold text-base mb-3 px-1" style={{ color: "var(--text-primary)" }}>Move to folder</h2>

        {folders.length > 0 && (
          <div className="flex items-center gap-2 px-2.5 py-2 mb-2 rounded-lg" style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}>
            <Search size={13} style={{ color: "var(--text-muted)" }} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search folders..."
              className="w-full bg-transparent outline-none text-[13px]"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
        )}

        {folders.length === 0 ? (
          <p className="text-sm mb-4 px-1" style={{ color: "var(--text-muted)" }}>No folders yet. Create one in the sidebar first.</p>
        ) : matches !== null && matches.length === 0 ? (
          <p className="text-sm mb-2 px-1 py-4 text-center" style={{ color: "var(--text-muted)" }}>No folders match &quot;{trimmed}&quot;</p>
        ) : (
          <div className="flex flex-col gap-[1px] mb-2 max-h-64 overflow-y-auto">
            {(matches ?? ordered).map(f => {
              const isChild = !matches && f.depth > 0
              const parentName = f.parent_id ? nameById.get(f.parent_id) : null
              return (
                <button
                  key={f.id}
                  onClick={() => onMove(f.id)}
                  className="relative text-left flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ color: "var(--text-secondary)", ...(isChild ? { paddingLeft: 34 } : {}) }}
                  onMouseEnter={onRowEnter}
                  onMouseLeave={onRowLeave}
                >
                  {isChild && (
                    <span
                      className="absolute"
                      style={{ left: 20, top: 0, bottom: "50%", width: 12, borderLeft: "1px solid var(--border)", borderBottom: "1px solid var(--border)", borderRadius: "0 0 0 5px" }}
                    />
                  )}
                  <FolderIcon color={folderColor(f.id)} size={isChild ? 17 : 20} />
                  <span className="flex flex-col min-w-0">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="truncate">{matches ? highlightMatch(f.name, trimmed) : f.name}</span>
                      {f.pinned && <Pin size={10} style={{ color: "var(--text-muted)", opacity: 0.6, flexShrink: 0 }} />}
                    </span>
                    {matches && parentName && (
                      <span className="text-[10.5px] truncate" style={{ color: "var(--text-muted)" }}>{parentName}</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: "var(--text-muted)" }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
