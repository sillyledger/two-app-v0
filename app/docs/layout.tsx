'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/sidebar'
import TabBar from '@/components/tab-bar'
import { useTabStore } from '@/hooks/use-tab-store'
import { useRouter } from 'next/navigation'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { openTab } = useTabStore()

  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  const sidebarWidth = collapsed ? '56px' : '256px'

  const handleNewDoc = async () => {
    const res = await fetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', content: '', color: 'yellow', type: 'doc' }),
    })
    const doc = await res.json()
    openTab(doc.uuid, 'Untitled')
    router.push(`/docs/${doc.uuid}`)
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        onNewNote={handleNewDoc}
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
      />
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out"
        style={{ marginLeft: sidebarWidth }}
      >
        <TabBar sidebarWidth={sidebarWidth} />
        {children}
      </div>
    </div>
  )
}
