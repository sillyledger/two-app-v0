'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Sidebar from '@/components/sidebar'

export default function CanvasBoardPage() {
  const params = useParams()
  const [collapsed, setCollapsed] = useState(false)
  const [board, setBoard] = useState<{ name: string } | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    fetch('/api/boards').then(r => r.json()).then((data: any[]) => setBoard(data.find(b => b.uuid === params.id) ?? null))
  }, [params.id])

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <main className="flex-1 flex flex-col items-center justify-center gap-2">
        <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{board?.name ?? 'Board'}</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>The infinite canvas is coming next.</p>
      </main>
    </div>
  )
}
