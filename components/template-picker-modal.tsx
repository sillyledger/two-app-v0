"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, FileText, Users, BookOpen, Layers, Calendar } from "lucide-react"

interface Props {
  open: boolean
  onClose: () => void
}

const TEMPLATES = [
  {
    id: "blank",
    label: "Blank",
    description: "Start from scratch with an empty doc.",
    icon: FileText,
    accentColor: "#B4B2A9",
    content: "",
  },
  {
    id: "meeting-notes",
    label: "Meeting Notes",
    description: "Capture agenda, decisions, and action items.",
    icon: Users,
    accentColor: "#85B7EB",
    content: `<h1>Meeting Notes</h1><p><strong>Date:</strong> </p><p><strong>Attendees:</strong> </p><h2>Agenda</h2><ul><li><p></p></li></ul><h2>Discussion</h2><p></p><h2>Decisions</h2><ul><li><p></p></li></ul><h2>Action Items</h2><ul><li><p>[ ] &nbsp;</p></li></ul>`,
  },
  {
    id: "blog-post",
    label: "Blog Post",
    description: "Structure your ideas into a compelling article.",
    icon: BookOpen,
    accentColor: "#5DCAA5",
    content: `<h1>Blog Post Title</h1><p><em>A short one-line summary of what this post is about.</em></p><h2>Introduction</h2><p>Hook your reader here. What problem are you solving or what story are you telling?</p><h2>Main Point 1</h2><p></p><h2>Main Point 2</h2><p></p><h2>Main Point 3</h2><p></p><h2>Conclusion</h2><p>Wrap up your key takeaways and add a call to action.</p>`,
  },
  {
    id: "product-brief",
    label: "Product Brief",
    description: "Define the problem, solution, and scope.",
    icon: Layers,
    accentColor: "#AFA9EC",
    content: `<h1>Product Brief</h1><h2>Problem Statement</h2><p>What problem are we solving and for whom?</p><h2>Proposed Solution</h2><p>High-level description of what we're building.</p><h2>Goals</h2><ul><li><p></p></li></ul><h2>Non-Goals</h2><ul><li><p></p></li></ul><h2>Success Metrics</h2><ul><li><p></p></li></ul><h2>Timeline</h2><p></p><h2>Open Questions</h2><ul><li><p></p></li></ul>`,
  },
  {
    id: "weekly-review",
    label: "Weekly Review",
    description: "Reflect on the week and plan what's next.",
    icon: Calendar,
    accentColor: "#EF9F27",
    content: `<h1>Weekly Review</h1><p><strong>Week of:</strong> </p><h2>What went well?</h2><ul><li><p></p></li></ul><h2>What didn't go well?</h2><ul><li><p></p></li></ul><h2>What did I learn?</h2><ul><li><p></p></li></ul><h2>Top priorities for next week</h2><ul><li><p></p></li><li><p></p></li><li><p></p></li></ul><h2>Notes</h2><p></p>`,
  },
]

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
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative z-10 rounded-2xl shadow-2xl w-full max-w-2xl mx-4"
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header */}
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

        {/* Template grid */}
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
