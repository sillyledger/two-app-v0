"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, FileText, RotateCcw, X } from "lucide-react"
import Sidebar from "@/components/sidebar"

interface Doc {
  id: string
  title: string
  content: string
  deleted_at: string
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

export default function TrashPage() {
  const router = useRouter()
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (!res.ok) router.push("/login")
    })
  }, [])

  useEffect(() => {
    fetch("/api/trash")
      .then((r) => r.json())
      .then((data: Doc[]) => {
        setDocs(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleRestore = async (id: string) => {
    await fetch(`/api/trash/${id}`, { method: "PUT" })
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  const handlePermanentDelete = async (id: string) => {
    await fetch(`/api/trash/${id}`, { method: "DELETE" })
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="flex h-screen bg-[#1a1a1a] overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">

          <div className="flex items-center gap-3 mb-8">
            <Trash2 size={22} className="text-[#555]" />
            <h1 className="text-2xl font-bold text-[#e8e8e8]">Trash</h1>
          </div>

          {loading ? (
            <div className="space-y-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-[#2a2a2a] animate-pulse" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Trash2 size={36} className="mb-3 text-[#333]" />
              <p className="text-[15px] font-medium text-[#666] mb-1">Trash is empty</p>
              <p className="text-[13px] text-[#444]">Deleted docs will appear here</p>
            </div>
          ) : (
            <div className="border border-[#2a2a2a] rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_140px_80px] items-center px-4 py-2 border-b border-[#2a2a2a] bg-[#1f1f1f]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#444]">Name</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#444]">Deleted</span>
                <span />
              </div>

              {docs.map((doc, i) => (
                <div
                  key={doc.id}
                  className={`group grid grid-cols-[1fr_140px_80px] items-center px-4 py-3 transition-colors hover:bg-[#232323] ${
                    i !== docs.length - 1 ? "border-b border-[#222]" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={14} className="text-[#444] shrink-0" />
                    <p className="text-[13px] font-medium text-[#888] truncate">
                      {doc.title || "Untitled"}
                    </p>
                  </div>

                  <span className="text-[12px] text-[#555]">
                    {formatDate(doc.deleted_at)}
                  </span>

                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => handleRestore(doc.id)}
                      title="Restore"
                      className="p-1.5 rounded hover:bg-[#2a2a2a] text-[#555] hover:text-[#e8e8e8] transition-colors"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(doc.id)}
                      title="Delete permanently"
                      className="p-1.5 rounded hover:bg-[#2a2a2a] text-[#555] hover:text-red-400 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
