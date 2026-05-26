"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, FileText, Users, BookOpen, Layers, Calendar, Target } from "lucide-react"

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
    content: `<h1>Meeting Notes</h1><div data-callout="info"><p>Fill in the date, attendees, and agenda before the meeting. Use the Action Items section to assign owners and due dates after.</p></div><p><strong>Date:</strong> </p><p><strong>Attendees:</strong> </p><p><strong>Location / Link:</strong> </p><h2>Agenda</h2><ul data-type="taskList"><li data-checked="false"><label><input type="checkbox" /></label><div><p>Topic 1 — replace with your agenda item</p></div></li><li data-checked="false"><label><input type="checkbox" /></label><div><p>Topic 2</p></div></li><li data-checked="false"><label><input type="checkbox" /></label><div><p>Topic 3</p></div></li></ul><h2>Notes</h2><p>Write your meeting notes here. What was discussed, what decisions were made?</p><h2>Decisions made</h2><ul><li><p>Decision 1 — replace with actual decisions</p></li></ul><h2>Action items</h2><ul data-type="taskList"><li data-checked="false"><label><input type="checkbox" /></label><div><p>Owner name — action description — due date</p></div></li><li data-checked="false"><label><input type="checkbox" /></label><div><p>Owner name — action description — due date</p></div></li></ul><div data-callout="tip"><p>Tip: Share these notes with attendees within 24 hours while context is fresh.</p></div>`,
  },
  {
    id: "blog-post",
    label: "Blog Post",
    description: "Structure your ideas into a compelling article.",
    icon: BookOpen,
    accentColor: "#5DCAA5",
    content: `<h1>Post title</h1><p><strong>Category:</strong> &nbsp; &nbsp;<strong>Read time:</strong> &nbsp;min</p><div data-callout="tip"><p>A great post makes one strong point and supports it three ways. Write your hook first — if it doesn't grab you, it won't grab anyone else either.</p></div><h2>Hook</h2><blockquote><p>Open with a question, a surprising fact, or a short story that pulls the reader in. Replace this with your actual opening.</p></blockquote><h2>Section 1 — the problem or context</h2><p>Set up the situation. What does the reader need to understand before your main argument lands?</p><h2>Section 2 — your main point</h2><p>This is the core of the post. Be direct. One strong idea, well explained, beats three vague ones.</p><h2>Section 3 — evidence, examples, or how-to</h2><p>Back up your point. Use a specific example, a story, data, or a step-by-step if this is a how-to post.</p><hr /><h2>Conclusion</h2><p>Restate the key takeaway in one sentence. Then add a call to action — what should the reader do, think, or feel next?</p><div data-callout="note"><p>Before publishing: check the title is under 60 characters, add a meta description, and confirm all links work.</p></div>`,
  },
  {
    id: "product-brief",
    label: "Product Brief",
    description: "Define the problem, solution, and scope.",
    icon: Layers,
    accentColor: "#AFA9EC",
    content: `<h1>Product Brief</h1><div data-callout="tip"><p>A product brief answers three questions: what problem are we solving, who is it for, and how will we know it worked? Fill in every section before starting design or development.</p></div><h2>Problem statement</h2><p>What problem are we solving, and for whom? Be specific — name the user and the pain.</p><h2>Target users</h2><ul data-type="taskList"><li data-checked="true"><label><input type="checkbox" checked /></label><div><p>Primary user — describe them here</p></div></li><li data-checked="false"><label><input type="checkbox" /></label><div><p>Secondary user — describe them here</p></div></li></ul><h2>Goals</h2><ul data-type="taskList"><li data-checked="false"><label><input type="checkbox" /></label><div><p>Goal 1 — make it measurable</p></div></li><li data-checked="false"><label><input type="checkbox" /></label><div><p>Goal 2</p></div></li><li data-checked="false"><label><input type="checkbox" /></label><div><p>Goal 3</p></div></li></ul><h2>Scope</h2><table><tbody><tr><th><p>In scope</p></th><th><p>Out of scope</p></th></tr><tr><td><p>Feature or capability to build</p></td><td><p>Something explicitly not included</p></td></tr><tr><td><p>Feature or capability to build</p></td><td><p>Something explicitly not included</p></td></tr><tr><td><p>Feature or capability to build</p></td><td><p>Something explicitly not included</p></td></tr></tbody></table><h2>Success metrics</h2><ul><li><p>Metric 1 — e.g. 80% of users complete onboarding</p></li><li><p>Metric 2</p></li></ul><h2>Open questions</h2><ul><li><p>Question that still needs an answer</p></li></ul><div data-callout="warning"><p>Assumptions &amp; risks: List anything this brief assumes to be true, and any risks that could block delivery.</p></div>`,
  },
  {
    id: "weekly-review",
    label: "Weekly Review",
    description: "Reflect on the week and plan what's next.",
    icon: Calendar,
    accentColor: "#EF9F27",
    content: `<h1>Weekly Review</h1><p><strong>Week of:</strong> </p><div data-callout="tip"><p>Block 30 minutes every Friday to fill this in. Honest reflection — not just what looked good — is what makes it useful.</p></div><h2>Wins this week</h2><ul data-type="taskList"><li data-checked="true"><label><input type="checkbox" checked /></label><div><p>Win 1 — what went well and why?</p></div></li><li data-checked="true"><label><input type="checkbox" checked /></label><div><p>Win 2</p></div></li></ul><h2>What didn't go well</h2><p>Be honest here. What slipped, what was blocked, what took longer than expected?</p><h2>What did I learn?</h2><p>One or two sentences on the most useful thing you figured out this week.</p><h2>Next week priorities</h2><ul data-type="taskList"><li data-checked="false"><label><input type="checkbox" /></label><div><p>Priority 1 — the most important thing</p></div></li><li data-checked="false"><label><input type="checkbox" /></label><div><p>Priority 2</p></div></li><li data-checked="false"><label><input type="checkbox" /></label><div><p>Priority 3</p></div></li></ul><h2>Metrics snapshot</h2><table><tbody><tr><th><p>Metric</p></th><th><p>Last week</p></th><th><p>This week</p></th></tr><tr><td><p>Metric 1</p></td><td><p></p></td><td><p></p></td></tr><tr><td><p>Metric 2</p></td><td><p></p></td><td><p></p></td></tr><tr><td><p>Metric 3</p></td><td><p></p></td><td><p></p></td></tr></tbody></table><div data-callout="note"><p>Reflection: Any broader thoughts on the week — energy levels, focus, blockers, or patterns you're noticing?</p></div>`,
  },
  {
    id: "okr-tracker",
    label: "OKR Tracker",
    description: "Set objectives, track key results, measure progress.",
    icon: Target,
    accentColor: "#1D9E75",
    content: `<h1>OKR Tracker</h1><p><strong>Quarter:</strong> &nbsp; &nbsp;<strong>Team / Owner:</strong> </p><div data-callout="info"><p>Objectives are qualitative goals that inspire. Key Results are measurable outcomes that prove you got there. Aim for 3 objectives, each with 2–4 key results. Update numbers weekly.</p></div><h2>Objective 1</h2><p><em>Write your objective here — make it ambitious and inspiring.</em></p><table><tbody><tr><th><p>Key result</p></th><th><p>Current</p></th><th><p>Target</p></th><th><p>% complete</p></th></tr><tr><td><p>Key result 1 — describe the measurable outcome</p></td><td><p>0</p></td><td><p>100</p></td><td><p>0%</p></td></tr><tr><td><p>Key result 2</p></td><td><p>0</p></td><td><p>100</p></td><td><p>0%</p></td></tr><tr><td><p>Key result 3</p></td><td><p>0</p></td><td><p>100</p></td><td><p>0%</p></td></tr></tbody></table><h2>Objective 2</h2><p><em>Write your second objective here.</em></p><table><tbody><tr><th><p>Key result</p></th><th><p>Current</p></th><th><p>Target</p></th><th><p>% complete</p></th></tr><tr><td><p>Key result 1 — describe the measurable outcome</p></td><td><p>0</p></td><td><p>100</p></td><td><p>0%</p></td></tr><tr><td><p>Key result 2</p></td><td><p>0</p></td><td><p>100</p></td><td><p>0%</p></td></tr><tr><td><p>Key result 3</p></td><td><p>0</p></td><td><p>100</p></td><td><p>0%</p></td></tr></tbody></table><h2>Objective 3</h2><p><em>Write your third objective here.</em></p><table><tbody><tr><th><p>Key result</p></th><th><p>Current</p></th><th><p>Target</p></th><th><p>% complete</p></th></tr><tr><td><p>Key result 1 — describe the measurable outcome</p></td><td><p>0</p></td><td><p>100</p></td><td><p>0%</p></td></tr><tr><td><p>Key result 2</p></td><td><p>0</p></td><td><p>100</p></td><td><p>0%</p></td></tr></tbody></table><div data-callout="tip"><p>Review OKRs every Monday. Update the Current column, recalculate % complete, and flag anything that's off track early — don't wait until end of quarter.</p></div>`,
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
