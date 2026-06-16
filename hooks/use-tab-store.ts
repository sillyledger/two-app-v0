"use client"

import { useState, useEffect, useCallback } from "react"

export interface Tab {
  id: string
  title: string
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

// ── Singleton state shared across all hook instances ──────────────────────────
type Listener = () => void
let _tabs: Tab[]         = []
let _activeId: string | null = null
let _initialized         = false
const _listeners         = new Set<Listener>()

function notify() {
  _listeners.forEach(fn => fn())
}

function initOnce() {
  if (_initialized || typeof window === "undefined") return
  _initialized = true
  _tabs     = load<Tab[]>(STORAGE_KEY, [])
  _activeId = load<string | null>(ACTIVE_KEY, null)
}

// ── Shared mutators ───────────────────────────────────────────────────────────
function _openTab(id: string, title: string) {
  const exists = _tabs.find(t => t.id === id)
  if (exists) {
    _tabs = _tabs.map(t => t.id === id ? { ...t, title } : t)
  } else {
    const next = [..._tabs, { id, title }]
    _tabs = next.length > MAX_TABS ? next.slice(next.length - MAX_TABS) : next
  }
  _activeId = id
  save(STORAGE_KEY, _tabs)
  save(ACTIVE_KEY, _activeId)
  notify()
}

function _updateTabTitle(id: string, title: string) {
  _tabs = _tabs.map(t => t.id === id ? { ...t, title } : t)
  save(STORAGE_KEY, _tabs)
  notify()
}

function _closeTab(id: string) {
  const idx  = _tabs.findIndex(t => t.id === id)
  const next = _tabs.filter(t => t.id !== id)
  if (_activeId === id) {
    const newIdx = Math.max(0, idx - 1)
    _activeId = next[newIdx]?.id ?? null
    save(ACTIVE_KEY, _activeId)
  }
  _tabs = next
  save(STORAGE_KEY, _tabs)
  notify()
}

function _switchTab(id: string) {
  _activeId = id
  save(ACTIVE_KEY, _activeId)
  notify()
}

function _closeAll() {
  _tabs = []
  _activeId = null
  save(STORAGE_KEY, _tabs)
  save(ACTIVE_KEY, _activeId)
  notify()
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useTabStore() {
  initOnce()

  const [, rerender] = useState(0)

  useEffect(() => {
    const fn = () => rerender(n => n + 1)
    _listeners.add(fn)
    return () => { _listeners.delete(fn) }
  }, [])

  const openTab       = useCallback((id: string, title: string) => _openTab(id, title), [])
  const updateTabTitle = useCallback((id: string, title: string) => _updateTabTitle(id, title), [])
  const closeTab      = useCallback((id: string) => _closeTab(id), [])
  const switchTab     = useCallback((id: string) => _switchTab(id), [])
  const closeAll      = useCallback(() => _closeAll(), [])

  return { tabs: _tabs, activeId: _activeId, openTab, updateTabTitle, closeTab, switchTab, closeAll }
}
