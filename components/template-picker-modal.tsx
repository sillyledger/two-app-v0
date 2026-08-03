"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import { TEMPLATES } from "@/lib/templates"

interface Props {
  open: boolean
  onClose: () => void
}

export default function TemplatePickerModal({ open, onClose }: Props) {
  const router = useRouter()
  const [creating, setCreating] = useState<string | null>(null)

  if (!open) return null

  const handlePick = async (template: typeof TEMPLATES[0]) => {
    if (creating) return
    setCreating(template.id)
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: template.id === "blank" ? "Untitled" : template.label,
          content: template.content,
          color: "yellow",
          type: "doc",
        }),
      })
      const doc = await res.json()
      onClose()
      router.push(`/docs/${doc.uuid}`)
    } catch {
      setCreating(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="relative z-10 rounded-2xl shadow-2xl w-full max-w-2xl mx-4"
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h2
              className="text-[17px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              New Document
            </h2>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              Choose a template to get started
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"
              e.currentTarget.style.color = "var(--text-primary)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent"
              e.currentTarget.style.color = "var(--text-muted)"
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-3 gap-3">
          {TEMPLATES.map((template) => {
            const Icon = template.icon
            const isLoading = creating === template.id
            return (
              <button
                key={template.id}
                onClick={() => handlePick(template)}
                disabled={!!creating}
                className="text-left rounded-xl p-4 flex flex-col gap-3 transition-all"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  borderTop: `3px solid ${template.accentColor}`,
                  opacity: creating && !isLoading ? 0.5 : 1,
                  cursor: creating ? "default" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!creating) {
                    e.currentTarget.style.backgroundColor = "var(--bg)"
                    e.currentTarget.style.borderColor = "var(--text-muted)"
                    e.currentTarget.style.borderTopColor = template.accentColor
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"
                  e.currentTarget.style.borderColor = "var(--border)"
                  e.currentTarget.style.borderTopColor = template.accentColor
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: template.accentColor + "22" }}
                >
                  <Icon size={15} style={{ color: template.accentColor }} />
                </div>
                <div>
                  <p
                    className="text-[13px] font-semibold mb-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isLoading ? "Creating..." : template.label}
                  </p>
                  <p
                    className="text-[11.5px] leading-relaxed"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {template.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
