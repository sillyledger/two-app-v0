"use client"

import { useState, useEffect, useCallback } from "react"

export interface Tab {
  id: string    // the doc's uuid
  title: string // the doc's title, shown in the tab
}

const STORAGE_KEY = "two-open-tabs"
const ACTIVE_KEY  = "two-active-tab"
const MAX_TABS    = 10

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export function useTabStore() {
  const [tabs, setTabs]         = useState<Tab[]>(() => load<Tab[]>(STORAGE_KEY, []))
  const [activeId, setActiveId] = useState<string | null>(() => load<string | null>(ACTIVE_KEY, null))

  // Keep localStorage in sync whenever tabs or activeId change
  useEffect(() => { save(STORAGE_KEY, tabs) }, [tabs])
  useEffect(() => { save(ACTIVE_KEY, activeId) }, [activeId])

  // Open a doc in a new tab (or switch to it if already open)
  const openTab = useCallback((id: string, title: string) => {
    setTabs(prev => {
      const exists = prev.find(t => t.id === id)
      if (exists) {
        // Tab already open — just update title in case it changed
        return prev.map(t => t.id === id ? { ...t, title } : t)
      }
      const next = [...prev, { id, title }]
      return next.length > MAX_TABS ? next.slice(next.length - MAX_TABS) : next
    })
    setActiveId(id)
  }, [])

  // Update the title of an already-open tab (called when doc title changes)
  const updateTabTitle = useCallback((id: string, title: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, title } : t))
  }, [])

  // Close a tab — if it was active, switch to the nearest remaining tab
  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const idx  = prev.findIndex(t => t.id === id)
      const next = prev.filter(t => t.id !== id)
      setActiveId(current => {
        if (current !== id) return current
        if (next.length === 0) return null
        // Switch to the tab to the left, or the first one if none
        const newIdx = Math.max(0, idx - 1)
        return next[newIdx]?.id ?? null
      })
      return next
    })
  }, [])

  // Switch to a tab that's already open
  const switchTab = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  // Close every tab (e.g. on logout)
  const closeAll = useCallback(() => {
    setTabs([])
    setActiveId(null)
  }, [])

  return { tabs, activeId, openTab, updateTabTitle, closeTab, switchTab, closeAll }
}
