'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import TemplatePickerModal from '@/components/template-picker-modal'
import MoveToFolderModal from '@/components/move-to-folder-modal'
import { getDescendantIds } from '@/lib/folder-tree'
import { FolderCard, FolderData, getAccent, markFolderCardMounted } from '@/components/folder-card'
import { FileText, Search, Plus, Users } from 'lucide-react'

interface Label {
  id: number
  name: string
  color: string
}

interface Doc {
  id: number
  uuid: string
  title: string
  updated_at: string
  created_at: string
  labels: Label[]
}

interface Collection {
  label: Label
  docs: Doc[]
}

interface FolderDoc {
  uuid: string
  title: string
  folder_id?: string | null
  folder_name?: string | null
}

type LibraryPill = 'all' | 'other' | 'shared'
type GroupBy = 'folders' | 'labels'

function previewText(titles: string[]) {
  if (titles.length === 0) return 'Empty folder'
  const shown = titles.slice(0, 2).join(', ')
  return titles.length > 2 ? `${shown} +${titles.length - 2}` : shown
}

export default function LibraryPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [groupBy, setGroupBy] = useState<GroupBy>('folders')

  const [collections, setCollections] = useState<Collection[]>([])
  const [unlabeled, setUnlabeled] = useState<Doc[]>([])
  const [allDocs, setAllDocs] = useState<Doc[]>([])

  const [folders, setFolders] = useState<FolderData[]>([])
  const [folderDocs, setFolderDocs] = useState<FolderDoc[]>([])
  const [sharedWorkspaces, setSharedWorkspaces] = useState<{ id: string; name: string }[]>([])
  const [sharedData, setSharedData] = useState<Record<string, { folders: FolderData[]; docs: FolderDoc[] }>>({})

  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [activePill, setActivePill] = useState<LibraryPill>('all')
  const [hoveredPill, setHoveredPill] = useState<string | null>(null)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [movingFolder, setMovingFolder] = useState<FolderData | null>(null)
  const [moveCandidates, setMoveCandidates] = useState<FolderData[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
    const savedGroup = localStorage.getItem('library-group-by')
    if (savedGroup === 'folders' || savedGroup === 'labels') setGroupBy(savedGroup)
  }, [])

  useEffect(() => { markFolderCardMounted() }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null) }
    if (menuOpenId) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpenId])

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  useEffect(() => {
    localStorage.setItem('library-group-by', groupBy)
  }, [groupBy])

  useEffect(() => {
    fetch('/api/library')
      .then(r => r.json())
      .then(({ labels, docs }) => {
        if (!Array.isArray(labels) || !Array.isArray(docs)) return
        const built: Collection[] = labels.map((label: Label) => ({
          label,
          docs: docs.filter((d: Doc) => d.labels.some(l => l.id === label.id)),
        })).filter(c => c.docs.length > 0)
        const noLabel = docs.filter((d: Doc) => d.labels.length === 0)
        setCollections(built)
        setUnlabeled(noLabel)
        setAllDocs(docs)
        setLoading(false)
      })

    fetch('/api/folders')
      .then(r => r.json())
      .then(data => setFolders(Array.isArray(data) ? data : []))
      .catch(() => setFolders([]))

    fetch('/api/docs')
      .then(r => r.json())
      .then(data => setFolderDocs(Array.isArray(data) ? data : []))
      .catch(() => setFolderDocs([]))

    fetch('/api/workspace').then(r => r.json()).then(primary => {
      fetch('/api/workspaces')
        .then(r => r.json())
        .then(data => {
          const owned = Array.isArray(data?.owned) ? data.owned : []
          const shared = Array.isArray(data?.shared) ? data.shared : []
          const extra = [...owned, ...shared].filter((w: { id: string }) => w.id !== primary?.id)
          setSharedWorkspaces(extra)
          extra.forEach((ws: { id: string; name: string }) => {
            Promise.all([
              fetch(`/api/folders?workspace_id=${ws.id}`).then(r => r.json()),
              fetch(`/api/docs?workspace_id=${ws.id}`).then(r => r.json()),
            ]).then(([folders, docs]) => {
              setSharedData(prev => ({
                ...prev,
                [ws.id]: {
                  folders: Array.isArray(folders) ? folders : [],
                  docs: Array.isArray(docs) ? docs : [],
                },
              }))
            }).catch(() => {})
          })
        })
        .catch(() => setSharedWorkspaces([]))
    }).catch(() => {})
  }, [])

  const handleTogglePin = async (folder: FolderData, e: React.MouseEvent) => {
    e.stopPropagation()
    const newValue = !folder.pinned
    setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, pinned: newValue } : f))
    await fetch(`/api/folders/${folder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: newValue }),
    })
  }

  const startRenaming = (folder: FolderData, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(null)
    setRenameValue(folder.name)
    setRenamingId(folder.id)
  }

  const commitRename = async (folder: FolderData) => {
    const trimmed = renameValue.trim()
    setRenamingId(null)
    if (!trimmed || trimmed === folder.name) return
    setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, name: trimmed } : f))
    try {
      await fetch(`/api/folders/${folder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
    } catch {}
  }

  const handleOpenMoveFolder = async (folder: FolderData, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(null)
    setMovingFolder(folder)
    try {
      const res = await fetch('/api/folders?all=true')
      const data = await res.json()
      const allFolders: FolderData[] = Array.isArray(data) ? data : []
      const descendantIds = getDescendantIds(allFolders, folder.id)
      setMoveCandidates(
        allFolders.filter(f => f.workspace_id === folder.workspace_id && f.id !== folder.id && !descendantIds.has(f.id))
      )
    } catch {
      setMoveCandidates([])
    }
  }

  const handleMoveFolder = async (newParentId: string) => {
    if (!movingFolder) return
    const res = await fetch(`/api/folders/${movingFolder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_id: newParentId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to move folder.')
      return
    }
    setFolders(prev => prev.filter(f => f.id !== movingFolder.id))
    setMovingFolder(null)
  }

  const handleDeleteFolder = async (folder: FolderData, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(null)
    const confirmed = window.confirm(`Delete "${folder.name}"?\n\nAll docs inside will be moved to Trash and can be recovered within 30 days.`)
    if (!confirmed) return
    setFolders(prev => prev.filter(f => f.id !== folder.id))
    try { await fetch(`/api/folders/${folder.id}`, { method: 'DELETE' }) } catch {}
  }

  const handleToggleMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(prev => prev === id ? null : id)
  }

  const unfiledDocs = folderDocs.filter(d => !d.folder_id)

  const filteredLabelCollections = collections.filter(c =>
    c.label.name.toLowerCase().includes(search.toLowerCase()) ||
    c.docs.some(d => d.title.toLowerCase().includes(search.toLowerCase()))
  )

  const filteredFolders = folders.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    folderDocs.some(d => d.folder_id === f.id && (d.title || '').toLowerCase().includes(search.toLowerCase()))
  )

  const filteredUnfiledDocs = unfiledDocs.filter(d =>
    (d.title || '').toLowerCase().includes(search.toLowerCase())
  )

  const filteredUnlabeled = unlabeled.filter(d =>
    (d.title || '').toLowerCase().includes(search.toLowerCase())
  )

  const groupCount = groupBy === 'folders' ? folders.length : collections.length
  const totalDocs = folderDocs.length || allDocs.length

  const pills: { key: LibraryPill; label: string; soon?: boolean }[] = [
    { key: 'all', label: 'All' },
    { key: 'other', label: groupBy === 'folders' ? 'Unfiled' : 'Unlabeled' },
    { key: 'shared', label: 'Shared' },
  ]

  const btnBase: React.CSSProperties = {
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '0 16px',
    borderRadius: '8px',
    fontSize: '13.5px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.15s, background-color 0.15s, border-color 0.15s, color 0.15s',
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1180px] mx-auto px-10 py-10">

          <div className="flex items-center justify-between mb-6 gap-4">
            <div className="relative flex-1" style={{ maxWidth: 420 }}>
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search library..."
                className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none placeholder-[var(--text-muted)]"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={() => setTemplateModalOpen(true)}
                style={{ ...btnBase, backgroundColor: 'var(--text-primary)', color: 'var(--bg)', border: '1px solid transparent' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <Plus size={14} /> New Doc
              </button>
            </div>
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            {totalDocs} documents across {groupCount} {groupBy}
          </p>

          <div className="flex items-center justify-between mb-8">
            <div className="flex gap-2">
              {pills.map(pill => {
                const isActive = activePill === pill.key
                const isHovered = hoveredPill === pill.key
                return (
                  <div key={pill.key} style={{ position: 'relative' }}>
                    <button
                      onClick={() => !pill.soon && setActivePill(pill.key)}
                      onMouseEnter={() => setHoveredPill(pill.key)}
                      onMouseLeave={() => setHoveredPill(null)}
                      style={{
                        padding: '7px 16px', borderRadius: '99px', fontSize: '13px',
                        fontWeight: isActive ? 500 : 400,
                        border: '1px solid', borderColor: isActive ? 'var(--text-primary)' : 'var(--border)',
                        backgroundColor: isActive ? 'var(--text-primary)' : 'transparent',
                        color: isActive ? 'var(--bg)' : 'var(--text-muted)',
                        cursor: pill.soon ? 'default' : 'pointer', transition: 'all 0.15s',
                        opacity: pill.soon ? 0.6 : 1,
                      }}
                    >
                      {pill.label}
                    </button>
                    {pill.soon && isHovered && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 10px', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', zIndex: 50, pointerEvents: 'none' }}>
                        Coming soon
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Group by</span>
              <div className="flex p-[3px] rounded-full" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                {(['folders', 'labels'] as GroupBy[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setGroupBy(mode)}
                    style={{
                      padding: '6px 14px', borderRadius: '99px', fontSize: '12.5px',
                      fontWeight: groupBy === mode ? 500 : 400,
                      backgroundColor: groupBy === mode ? 'var(--text-primary)' : 'transparent',
                      color: groupBy === mode ? 'var(--bg)' : 'var(--text-muted)',
                      cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize',
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</span>
            </div>
          ) : (
            <>
              {activePill === 'all' && (
                <>
                  <div className="text-[11px] font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                    {groupBy === 'folders' ? 'Folders' : 'Labels'}
                  </div>

                  {groupBy === 'folders' ? (
                    filteredFolders.length === 0 ? (
                      <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>No folders yet.</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-4 mb-10">
                        {filteredFolders.map(folder => (
                          <FolderCard
                            key={folder.id}
                            folder={folder}
                            accentColor={getAccent(folders.findIndex(f => f.id === folder.id))}
                            isMenuOpen={menuOpenId === folder.id}
                            menuRef={menuRef}
                            onToggleMenu={handleToggleMenu}
                            onTogglePin={handleTogglePin}
                            onOpen={f => router.push(`/folders/${f.id}?name=${encodeURIComponent(f.name)}`)}
                            isRenaming={renamingId === folder.id}
                            renameValue={renameValue}
                            onRenameChange={setRenameValue}
                            renameInputRef={renameInputRef}
                            onCommitRename={commitRename}
                            onCancelRename={() => setRenamingId(null)}
                            onStartRename={startRenaming}
                            onMove={handleOpenMoveFolder}
                            onDelete={handleDeleteFolder}
                          />
                        ))}
                      </div>
                    )
                  ) : (
                    filteredLabelCollections.length === 0 ? (
                      <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>No labels yet.</p>
                    ) : (
                      <div className="grid gap-4 mb-10" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                        {filteredLabelCollections.map(({ label, docs }) => (
                          <div key={label.id} className="relative" style={{ height: '150px' }}>
                            {docs.length > 0 && (
                              <>
                                <div style={{ position: 'absolute', top: 14, left: 10, right: -10, bottom: 0, borderRadius: 12, backgroundColor: 'var(--bg-secondary)', opacity: 0.35 }} />
                                <div style={{ position: 'absolute', top: 7, left: 5, right: -5, bottom: 0, borderRadius: 12, backgroundColor: 'var(--bg-secondary)', opacity: 0.6 }} />
                              </>
                            )}
                            <div style={{ position: 'absolute', inset: 0, borderRadius: 12, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                              <div className="flex items-center gap-2">
                                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: label.color, flexShrink: 0 }} />
                                <span className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>{label.name}</span>
                              </div>
                              <p className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>{previewText(docs.map(d => d.title || 'Untitled'))}</p>
                              <button onClick={() => docs[0] && router.push(`/docs/${docs[0].uuid}`)} className="text-[12.5px] text-left" style={{ color: 'var(--text-secondary)' }}>{docs.length} {docs.length === 1 ? 'doc' : 'docs'}</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </>
              )}

              {(activePill === 'all' || activePill === 'other') && (
                <>
                  {groupBy === 'folders' ? (
                    filteredUnfiledDocs.length > 0 ? (
                      <>
                        <div className="text-[11px] font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Unfiled · {filteredUnfiledDocs.length}</div>
                        <div className="flex flex-wrap gap-2">
                          {filteredUnfiledDocs.map(doc => (
                            <button key={doc.uuid} onClick={() => router.push(`/docs/${doc.uuid}`)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                            >
                              <FileText size={11} style={{ color: 'var(--text-muted)' }} />
                              <span className="text-[12.5px]">{doc.title || 'Untitled'}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : search && activePill === 'other' ? (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No matching docs.</p>
                    ) : null
                  ) : (
                    filteredUnlabeled.length > 0 ? (
                      <>
                        <div className="text-[11px] font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Unlabeled · {filteredUnlabeled.length}</div>
                        <div className="flex flex-wrap gap-2">
                          {filteredUnlabeled.map(doc => (
                            <button key={doc.uuid} onClick={() => router.push(`/docs/${doc.uuid}`)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                            >
                              <FileText size={11} style={{ color: 'var(--text-muted)' }} />
                              <span className="text-[12.5px]">{doc.title || 'Untitled'}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : search && activePill === 'other' ? (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No matching docs.</p>
                    ) : null
                  )}
                </>
              )}

              {activePill === 'shared' && (
                <>
                  {sharedWorkspaces.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No shared workspaces yet.</p>
                  ) : (
                    sharedWorkspaces.map(ws => {
                      const data = sharedData[ws.id]
                      const wsFolders = (data?.folders ?? []).map((folder, index) => ({
                        folder, color: getAccent(index),
                        docs: (data?.docs ?? []).filter(d => d.folder_id === folder.id),
                      }))
                      const wsUnfiled = (data?.docs ?? []).filter(d => !d.folder_id)
                      const filteredWsFolders = wsFolders.filter(f =>
                        f.folder.name.toLowerCase().includes(search.toLowerCase()) ||
                        f.docs.some(d => (d.title || '').toLowerCase().includes(search.toLowerCase()))
                      )
                      const filteredWsUnfiled = wsUnfiled.filter(d => (d.title || '').toLowerCase().includes(search.toLowerCase()))
                      return (
                        <div key={ws.id} className="mb-10">
                          <div className="text-[11px] font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>{ws.name}</div>
                          {filteredWsFolders.length === 0 ? (
                            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No folders yet.</p>
                          ) : (
                            <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                              {filteredWsFolders.map(({ folder, color, docs }) => (
                                <div
                                  key={folder.id}
                                  onClick={() => router.push(`/folders/${folder.id}?name=${encodeURIComponent(folder.name)}`)}
                                  className="relative cursor-pointer"
                                  style={{ height: '150px' }}
                                >
                                  {docs.length > 0 && (
                                    <>
                                      <div style={{ position: 'absolute', top: 14, left: 10, right: -10, bottom: 0, borderRadius: 12, backgroundColor: 'var(--bg-secondary)', opacity: 0.35 }} />
                                      <div style={{ position: 'absolute', top: 7, left: 5, right: -5, bottom: 0, borderRadius: 12, backgroundColor: 'var(--bg-secondary)', opacity: 0.6 }} />
                                    </>
                                  )}
                                  <div style={{ position: 'absolute', inset: 0, borderRadius: 12, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div className="flex items-center gap-2">
                                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                                      <span className="text-[15px] font-medium" style={{ color: 'var(--text-primary)' }}>{folder.name}</span>
                                    </div>
                                    <p className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>{previewText(docs.map(d => d.title || 'Untitled'))}</p>
                                    <span className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>{docs.length} {docs.length === 1 ? 'doc' : 'docs'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {filteredWsUnfiled.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {filteredWsUnfiled.map(doc => (
                                <button key={doc.uuid} onClick={() => router.push(`/docs/${doc.uuid}`)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                                >
                                  <FileText size={11} style={{ color: 'var(--text-muted)' }} />
                                  <span className="text-[12.5px]">{doc.title || 'Untitled'}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      <TemplatePickerModal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} />

      {movingFolder && (
        <MoveToFolderModal
          folders={moveCandidates}
          onMove={handleMoveFolder}
          onClose={() => setMovingFolder(null)}
          currentFolderId={movingFolder?.parent_id ?? undefined}
        />
      )}
    </div>
  )
}
