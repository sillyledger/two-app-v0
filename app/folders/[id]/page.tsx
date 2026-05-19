"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation"
import { Plus, FileText, MoreHorizontal, Folder } from "lucide-react"
import Sidebar from "@/components/sidebar"

interface Doc {
  id: string
  uuid: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

interface FolderType {
  id: string
  name: string
}

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function stripHtml(html: string) {
  if (!html) return ""
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

export default function FolderPage() {
  const { id } = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const folderNameFromUrl = searchParams.get('name') ?? '...'
  const [folder, setFolder] = useState<FolderType | null>(null)
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (!res.ok) router.push("/login")
    })
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)

    fetch(`/api/folders/${id}`)
      .then((r) => r.json())
      .then((data: FolderType) => { if (data?.name) setFolder(data) })
      .catch(() => {})

    fetch(`/api/docs?folder_id=${id}`)
      .then((r) => r.json())
      .then((data: Doc[]) => {
        setDocs(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id, pathname])

  const handleCreateDoc = async () => {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled",
          content: "",
          color: "yellow",
          type: "doc",
          folder_id: id,
        }),
      })
      const doc = await res.json()
      router.push(`/docs/${doc.uuid}`)
    } catch {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-screen bg-[#1a1a1a] overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Folder size={22} className="text-[#555]" />
              <h1 className="text-2xl font-bold text-[#e8e8e8]">
                {folder?.name ?? folderNameFromUrl}
              </h1>
            </div>
            <button
              onClick={handleCreateDoc}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/20 text-[#e8e8e8] text-sm font-medium hover:bg-white/10 transition-colors"
            >
              <Plus size={15} />
              {creating ? "Creating..." : "New Doc"}
            </button>
          </div>

          {/* Doc list */}
          {loading ? (
            <div className="space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-[#2a2a2a] animate-pulse" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#444]">
              <Folder size={36} className="mb-3 text-[#333]" />
              <p className="text-[15px] font-medium text-[#666] mb-1">No docs in this folder</p>
              <p className="text-[13px] text-[#444]">Click New Doc to get started</p>
            </div>
          ) : (
            <div className="border border-[#2a2a2a] rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_140px_140px_36px] items-center px-4 py-2 border-b border-[#2a2a2a] bg-[#1f1f1f]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#444]">Name</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#444]">Created</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#444]">Updated</span>
                <span />
              </div>

              {docs.map((doc, i) => (
                <div
                  key={doc.uuid}
                  onClick={() => router.push(`/docs/${doc.uuid}`)}
                  className={`group grid grid-cols-[1fr_140px_140px_36px] items-center px-4 py-3 cursor-pointer transition-colors hover:bg-[#232323] ${
                    i !== docs.length - 1 ? "border-b border-[#222]" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={14} className="text-[#444] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#e8e8e8] truncate leading-snug">
                        {doc.title || "Untitled"}
                      </p>
                      <p className="text-[11px] text-[#555] truncate leading-snug mt-0.5">
                        {stripHtml(doc.content).slice(0, 80) || "No content"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[12px] text-[#555]">{formatDate(doc.created_at)}</span>
                  <span className="text-[12px] text-[#555]">{formatDate(doc.updated_at)}</span>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#2a2a2a] text-[#555] hover:text-[#e8e8e8] transition-all"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
