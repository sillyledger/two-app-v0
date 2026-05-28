"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { X, Plus } from "lucide-react"
import { useTabStore } from "@/hooks/use-tab-store"

interface TabBarProps {
  sidebarWidth?: string
}

export default function TabBar({ sidebarWidth = "0px" }: TabBarProps) {
  const router = useRouter()
  const { tabs, activeId, switchTab, closeTab } = useTabStore()
  const activeRef = useRef<HTMLButtonElement>(null)

  // Scroll the active tab into view whenever it changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
  }, [activeId])

  // Don't render the bar at all if there are no tabs open
  if (tabs.length === 0) return null

  const handleSwitch = (id: string) => {
    switchTab(id)
    router.push(`/docs/${id}`)
  }

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const wasActive = id === activeId
    closeTab(id)

    // After closing, navigate to the new active tab (handled by the store)
    // We read the store state after the close via a small timeout
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

  return (
    <div
      className="fixed z-30 flex items-end overflow-x-auto"
      style={{
        top: "44px",
        left: sidebarWidth,
        right: 0,
        height: "36px",
        backgroundColor: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        transition: "left 0.2s",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId
        return (
          <button
            key={tab.id}
            ref={isActive ? activeRef : null}
            onClick={() => handleSwitch(tab.id)}
            className="group relative flex items-center gap-1.5 px-3 shrink-0 h-full text-[12px] font-medium transition-colors"
            style={{
              maxWidth: "180px",
              minWidth: "80px",
              color: isActive ? "var(--text-primary)" : "var(--text-muted)",
              backgroundColor: isActive ? "var(--bg-secondary)" : "transparent",
              borderRight: "1px solid var(--border)",
              borderTop: isActive ? "1px solid var(--accent, #6b5ce7)" : "1px solid transparent",
            }}
          >
            {/* Tab title — truncated */}
            <span className="truncate flex-1 text-left">
              {tab.title || "Untitled"}
            </span>

            {/* Close button — always visible on active, hover-only on inactive */}
            <span
              onClick={(e) => handleClose(e, tab.id)}
              className="flex items-center justify-center w-4 h-4 rounded shrink-0 transition-colors"
              style={{
                opacity: isActive ? 1 : 0,
                color: "var(--text-muted)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"
                e.currentTarget.style.color = "var(--text-primary)"
                e.currentTarget.style.opacity = "1"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = "transparent"
                e.currentTarget.style.color = "var(--text-muted)"
                e.currentTarget.style.opacity = isActive ? "1" : "0"
              }}
            >
              <X size={10} />
            </span>
          </button>
        )
      })}

      {/* + New tab button */}
      <button
        onClick={() => router.push("/")}
        title="Open a doc from the sidebar"
        className="flex items-center justify-center w-8 h-full shrink-0 transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={e => {
          e.currentTarget.style.color = "var(--text-primary)"
          e.currentTarget.style.backgroundColor = "var(--bg-secondary)"
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = "var(--text-muted)"
          e.currentTarget.style.backgroundColor = "transparent"
        }}
      >
        <Plus size={13} />
      </button>

      {/* Hide scrollbar in webkit browsers */}
      <style>{`.fixed::-webkit-scrollbar { display: none; }`}</style>
    </div>
  )
}
