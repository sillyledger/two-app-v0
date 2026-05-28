"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { X, Plus, Search, FileText, FilePlus } from "lucide-react"
import { useTabStore } from "@/hooks/use-tab-store"

interface DocItem {
  uuid: string
  title: string
  folder_name?: string | null
}

interface TabBarProps {
  sidebarWidth?: string
}

export default function TabBar({ sidebarWidth = "0px" }: TabBarProps) {
  const router = useRouter()
  const { tabs, activeId, openTab, switchTab, closeTab } = useTabStore()
  const activeRef = useRef<HTMLButtonElement>(null)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [docs, setDocs] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
  }, [activeId])

  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false); setQuery("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [pickerOpen])

  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPickerOpen(false); setQuery("") }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [pickerOpen])

  useEffect(() => {
    if (!pickerOpen) return
    setLoading(true)
    fetch("/api/docs")
      .then(r => r.json())
      .then(data => setDocs(Array.isArray(data) ? data : []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [pickerOpen])

  const filteredDocs = docs.filter(d =>
    (d.title || "Untitled").toLowerCase().includes(query.toLowerCase())
  )

  const handleOpenDoc = useCallback((doc: DocItem) => {
    openTab(doc.uuid, doc.title || "Untitled")
    router.push(`/docs/${doc.uuid}`)
    setPickerOpen(false); setQuery("")
  }, [openTab, router])

  const handleNewDoc = useCallback(async () => {
    setCreating(true)
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled", content: "", color: "yellow", type: "doc" }),
      })
      const doc = await res.json()
      openTab(doc.uuid, "Untitled")
      router.push(`/docs/${doc.uuid}`)
      setPickerOpen(false); setQuery("")
    } finally {
      setCreating(false)
    }
  }, [openTab, router])

  const handleSwitch = (id: string) => {
    switchTab(id)
    router.push(`/docs/${id}`)
  }

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const wasActive = id === activeId
    closeTab(id)
    if (wasActive) {
      setTimeout(() => {
        const raw = localStorage.getItem("two-open-tabs")
        const remaining: { id: string }[] = raw ? JSON.parse(raw) : []
        const newActiveRaw = localStorage.getItem("two-active-tab")
        const newActive: string | null = newActiveRaw ? JSON.parse(newActiveRaw) : null
        if (newActive && remaining.find(t => t.id === newActive)) {
          router.push(`/docs/${newActive}`)
        } else if (remaining.length > 0) {
          router.push(`/docs/${remaining[remaining.length - 1].id}`)
        } else {
          router.push("/")
        }
      }, 30)
    }
  }

  if (tabs.length === 0) return null

  return (
    <>
      <style>{`
        .tabbar-wrap::-webkit-scrollbar { display: none; }
        .tab-close { opacity: 0; transition: opacity 0.12s; }
        .tab-btn:hover .tab-close,
        .tab-btn-active .tab-close { opacity: 1; }
        .tab-btn { border-top: 2px solid transparent !important; border-right: 1px solid var(--border) !important; border-left: none !important; border-bottom: none !important; }
        .tab-btn-active { border-top: 2px solid #6b5ce7 !important; background-color: var(--bg-secondary) !important; color: var(--text-primary) !important; }
        .tab-btn:not(.tab-btn-active):hover { background-color: var(--bg-tertiary) !important; color: var(--text-secondary) !important; }
      `}</style>

      {/* ── Tab bar ── */}
      <div
        className="tabbar-wrap fixed z-30 flex items-end overflow-x-auto"
        style={{
          top: "44px",
          left: sidebarWidth,
          right: 0,
          height: "36px",
          backgroundColor: "var(--bg)",
          borderBottom: "1px solid var(--border)",
          scrollbarWidth: "none",
          transition: "left 0.2s",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId
          return (
            <button
              key={tab.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => handleSwitch(tab.id)}
              className={`tab-btn${isActive ? " tab-btn-active" : ""} relative flex items-center gap-1.5 px-3 shrink-0 h-full text-[12px] font-medium transition-colors`}
              style={{
                maxWidth: "180px",
                minWidth: "80px",
                cursor: "pointer",
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              <span className="truncate flex-1 text-left">{tab.title || "Untitled"}</span>
              <span
                className="tab-close flex items-center justify-center w-4 h-4 rounded shrink-0"
                onClick={(e) => handleClose(e, tab.id)}
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(107,92,231,0.2)"; e.currentTarget.style.color = "#c4b8ff" }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)" }}
              >
                <X size={10} />
              </span>
            </button>
          )
        })}

        {/* + button */}
        <button
          onClick={() => setPickerOpen(true)}
          title="Open another doc"
          className="flex items-center justify-center w-8 h-full shrink-0 transition-colors"
          style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.backgroundColor = "var(--bg-secondary)" }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.backgroundColor = "transparent" }}
        >
          <Plus size={13} />
        </button>
      </div>

      {/* ── Doc picker modal ── */}
      {pickerOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "120px", backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div ref={pickerRef} style={{ width: "520px", maxWidth: "calc(100vw - 32px)", borderRadius: "12px", overflow: "hidden", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search docs..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "var(--text-primary)" }}
              />
              {query && (
                <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, display: "flex" }}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* New doc button — always at top */}
            <button
              onClick={handleNewDoc}
              disabled={creating}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", background: "transparent", border: "none", borderBottom: "1px solid var(--border)", cursor: creating ? "wait" : "pointer", transition: "background 0.1s" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <div style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: "rgba(107,92,231,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FilePlus size={14} style={{ color: "#a89cf7" }} />
              </div>
              <div style={{ textAlign: "left" }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                  {creating ? "Creating…" : "New blank doc"}
                </p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Open a fresh doc in this tab</p>
              </div>
            </button>

            {/* Doc list */}
            <div style={{ maxHeight: "320px", overflowY: "auto", padding: "6px 0" }}>
              {loading && <p style={{ padding: "16px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>Loading...</p>}
              {!loading && filteredDocs.length === 0 && (
                <p style={{ padding: "16px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
                  {query ? `No docs matching "${query}"` : "No docs found"}
                </p>
              )}
              {!loading && filteredDocs.map(doc => {
                const isAlreadyOpen = tabs.some(t => t.id === doc.uuid)
                return (
                  <button
                    key={doc.uuid}
                    onClick={() => handleOpenDoc(doc)}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <FileText size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.title || "Untitled"}
                    </span>
                    {doc.folder_name && <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{doc.folder_name}</span>}
                    {isAlreadyOpen && <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0, opacity: 0.5, marginLeft: 4 }}>open</span>}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Press</span>
              <kbd style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "monospace" }}>Esc</kbd>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
