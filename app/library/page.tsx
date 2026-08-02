'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import TemplatePickerModal from '@/components/template-picker-modal'
import { FileText, Search, Plus, ArrowRight, Users } from 'lucide-react'

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

interface FolderItem {
  id: string
  name: string
  doc_count: number | string
}

interface FolderDoc {
  uuid: string
  title: string
  folder_id?: string | null
  folder_name?: string | null
}

type LibraryPill = 'all' | 'other' | 'shared'
type GroupBy = 'folders' | 'labels'

const ACCENT_COLORS = ["#EF9F27", "#85B7EB", "#5DCAA5", "#F0997B", "#AFA9EC", "#97C459", "#ED93B1", "#B4B2A9", "#5DCAA5"]
function getAccent(index: number) {
  return ACCENT_COLORS[index % ACCENT_COLORS.length]
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

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

  const [folders, setFolders] = useState<FolderItem[]>([])
  const [folderDocs, setFolderDocs] = useState<FolderDoc[]>([])
  const [sharedWorkspaces, setSharedWorkspaces] = useState<{ id: string; name: string }[]>([])
  const [sharedData, setSharedData] = useState<Record<string, { folders: FolderItem[]; docs: FolderDoc[] }>>({})

  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [activePill, setActivePill] = useState<LibraryPill>('all')
  const [hoveredPill, setHoveredPill] = useState<string | null>(null)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
    const savedGroup = localStorage.getItem('library-group-by')
    if (savedGroup === 'folders' || savedGroup === 'labels') setGroupBy(savedGroup)
  }, [])

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

  const mostRecent = allDocs.length > 0
    ? [...allDocs].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
    : null

  const foldersWithDocs = folders.map((folder, index) => ({
    folder,
    color: getAccent(index),
    docs: folderDocs.filter(d => d.folder_id === folder.id),
  }))

  const unfiledDocs = folderDocs.filter(d => !d.folder_id)

  const filteredLabelCollections = collections.filter(c =>
    c.label.name.toLowerCase().includes(search.toLowerCase()) ||
    c.docs.some(d => d.title.toLowerCase().includes(search.toLowerCase()))
  )

  const filteredFolders = foldersWithDocs.filter(f =>
    f.folder.name.toLowerCase().includes(search.toLowerCase()) ||
    f.docs.some(d => d.title.toLowerCase().includes(search.toLowerCase()))
  )

  const groupCount = groupBy === 'folders' ? folders.length : collections.length
  const totalDocs = folderDocs.length || allDocs.length

  const pills: { key: LibraryPill; label: string; soon?: boolean }[] = [
    { key: 'all', label: 'All' },
    { key: 'other', label: groupBy === 'folders' ? 'Unfiled' : 'Unlabeled' },
    { key: 'shared', label: 'Shared' },
  ]

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-10 py-14">

          <div className="flex items-end justify-between mb-1.5">
            <h1 className="text-[34px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Library</h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <Search size={13} style={{ color: 'var(--text-muted)' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search library..."
                  className="bg-transparent text-[13px] focus:outline-none w-36"
                  style={{ color: 'var(--text-secondary)' }}
                />
              </div>
              <button
                onClick={() => setTemplateModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13.5px] font-medium"
                style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg)' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <Plus size={14} /> New Doc
              </button>
            </div>
          </div>
          <p className="text-[13.5px] mb-7" style={{ color: 'var(--text-muted)' }}>
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
                <div
                  onClick={() => mostRecent && router.push(`/docs/${mostRecent.uuid}`)}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl mb-10 cursor-pointer transition-colors"
                  style={{ border: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text-muted)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <span className="text-[11.5px] flex-shrink-0" style={{ color: '#1D9E75' }}>Continue writing</span>
                  <span className="text-[15px] font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
                    {mostRecent ? (mostRecent.title || 'Untitled') : 'No documents yet'}
                  </span>
                  {mostRecent && <span className="text-[12.5px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Updated {timeAgo(mostRecent.updated_at)}</span>}
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
              )}

              {activePill === 'all' && (
                <>
                  <div className="text-[11px] font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                    {groupBy === 'folders' ? 'Folders' : 'Labels'}
                  </div>

                  {groupBy === 'folders' ? (
                    filteredFolders.length === 0 ? (
                      <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>No folders yet.</p>
                    ) : (
                      <div className="grid gap-4 mb-10" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                        {filteredFolders.map(({ folder, color, docs }) => (
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

              {(activePill === 'all' || activePill === 'other') && !search && (
                <>
                  {groupBy === 'folders' ? (
                    unfiledDocs.length > 0 && (
                      <>
                        <div className="text-[11px] font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Unfiled · {unfiledDocs.length}</div>
                        <div className="flex flex-wrap gap-2">
                          {unfiledDocs.map(doc => (
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
                    )
                  ) : (
                    unlabeled.length > 0 && (
                      <>
                        <div className="text-[11px] font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Unlabeled · {unlabeled.length}</div>
                        <div className="flex flex-wrap gap-2">
                          {unlabeled.map(doc => (
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
                    )
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
                      return (
                        <div key={ws.id} className="mb-10">
                          <div className="text-[11px] font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>{ws.name}</div>
                          {wsFolders.length === 0 ? (
                            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No folders yet.</p>
                          ) : (
                            <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                              {wsFolders.map(({ folder, color, docs }) => (
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
                          {wsUnfiled.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {wsUnfiled.map(doc => (
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
    </div>
  )
}
