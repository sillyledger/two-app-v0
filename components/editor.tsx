"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Typography from "@tiptap/extension-typography"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import Placeholder from "@tiptap/extension-placeholder"
import { SlashCommands } from "./slash-commands"
import { common, createLowlight } from "lowlight"
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Code2,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  ExternalLink,
  Pencil,
} from "lucide-react"
import { useCallback, useState, useRef, useEffect } from "react"

const lowlight = createLowlight(common)

interface EditorProps {
  content: string
  onChange: (content: string) => void
  onReady?: (focusFn: () => void) => void
  editable?: boolean
}

export { Editor }
export default function Editor({ content, onChange, onReady, editable = true }: EditorProps) {
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const [bubblePos, setBubblePos] = useState({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const linkInputRef = useRef<HTMLInputElement>(null)

  const [linkPopup, setLinkPopup] = useState<{ url: string; top: number; left: number } | null>(null)
  const linkPopupRef = useRef<HTMLDivElement>(null)
  const hidePopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editorReady, setEditorReady] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: {},
        orderedList: {},
        blockquote: {},
        codeBlock: false,
        horizontalRule: {},
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "plaintext",
      }),
      Link.configure({
        openOnClick: false,
        inclusive: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ["http", "https"],
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: null,
        },
      }),
      Typography,
      Placeholder.configure({
        placeholder: "Start writing, or press / for commands…",
      }),
      SlashCommands,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      if (editable) onChange(editor.getHTML())
    },
    onSelectionUpdate: ({ editor }) => {
      if (!editable) {
        setBubbleVisible(false)
        return
      }
      const { from, to } = editor.state.selection
      const hasSelection = from !== to

      if (!hasSelection) {
        setBubbleVisible(false)
        return
      }

      const domSelection = window.getSelection()
      if (!domSelection || domSelection.rangeCount === 0) {
        setBubbleVisible(false)
        return
      }

      const range = domSelection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return

      setBubblePos({
        top: rect.top - containerRect.top - 48,
        left: Math.max(0, rect.left - containerRect.left + rect.width / 2 - 160),
      })
      setBubbleVisible(true)
    },
    editorProps: {
      attributes: {
        class: `prose prose-invert max-w-none focus:outline-none min-h-[60vh] editor-content ${
          !editable ? "cursor-default select-text" : ""
        }`,
      },
      handleKeyDown: (view, event) => {
        if (!editable) return false
        if ((event.metaKey || event.ctrlKey) && event.key === "k") {
          event.preventDefault()
          openLinkModal()
          return true
        }
        return false
      },
    },
    onCreate: () => setEditorReady(true),
  })

 // ── Hover-based link popup — runs after editor is ready ──────────────────
  useEffect(() => {
    if (!editorReady) return
    const container = containerRef.current
    if (!container) return

    const attachedLinks = new Set<HTMLAnchorElement>()

    const attachToLink = (a: HTMLAnchorElement) => {
      if (attachedLinks.has(a)) return
      attachedLinks.add(a)

      a.addEventListener("mouseenter", () => {
        if (hidePopupTimer.current) clearTimeout(hidePopupTimer.current)
        const href = a.getAttribute("href") || ""
        const rect = a.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        setLinkPopup({
          url: href,
          top: rect.bottom - containerRect.top + 6,
          left: Math.max(0, rect.left - containerRect.left),
        })
      })

      a.addEventListener("mouseleave", (e) => {
        const related = e.relatedTarget as HTMLElement | null
        if (linkPopupRef.current && related && linkPopupRef.current.contains(related)) return
        hidePopupTimer.current = setTimeout(() => setLinkPopup(null), 600)
      })
    }

    // Attach to all existing links
    container.querySelectorAll("a").forEach((a) => attachToLink(a as HTMLAnchorElement))

    // Watch for new links added as user types
    const observer = new MutationObserver(() => {
      container.querySelectorAll("a").forEach((a) => attachToLink(a as HTMLAnchorElement))
    })
    observer.observe(container, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      attachedLinks.clear()
    }
  }, [editorReady])

  const handlePopupMouseEnter = () => {
    if (hidePopupTimer.current) clearTimeout(hidePopupTimer.current)
  }
  const handlePopupMouseLeave = () => {
    hidePopupTimer.current = setTimeout(() => setLinkPopup(null), 300)
  }

  useEffect(() => {
    if (editor && onReady) {
      onReady(() => editor.commands.focus("end"))
    }
  }, [editor])

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  useEffect(() => {
    if (linkModalOpen) {
      setTimeout(() => linkInputRef.current?.focus(), 50)
    }
  }, [linkModalOpen])

  const openLinkModal = useCallback(() => {
    if (!editor || !editable) return
    const previousUrl = editor.getAttributes("link").href || ""
    setLinkUrl(previousUrl)
    setLinkModalOpen(true)
  }, [editor, editable])

  const confirmLink = useCallback(() => {
    if (!editor) return
    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run()
    }
    setLinkModalOpen(false)
    setLinkUrl("")
  }, [editor, linkUrl])

  const cancelLink = useCallback(() => {
    setLinkModalOpen(false)
    setLinkUrl("")
    editor?.commands.focus()
  }, [editor])

  if (!editor) return null

  return (
    <div ref={containerRef} className="relative">
      <style>{`
        .editor-content {
          font-size: 17px;
          line-height: 1.5;
          text-underline-offset: 3px;
        }
        .editor-content p {
          margin-top: 0;
          margin-bottom: 1.25em;
        }
        .editor-content h1,
        .editor-content h2,
        .editor-content h3 {
          margin-top: 1.5em;
          margin-bottom: 0.4em;
        }

        /* ── Slash command menu ── */
        .slash-menu {
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 4px;
          min-width: 220px;
          max-height: 320px;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .slash-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 7px 10px;
          border-radius: 7px;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s;
        }
        .slash-menu-item:hover,
        .slash-menu-item.active {
          background: var(--border);
        }
        .slash-menu-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          flex-shrink: 0;
        }
        .slash-menu-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .slash-menu-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
        }
        .slash-menu-desc {
          font-size: 11px;
          color: var(--text-muted);
        }

        /* ── Syntax highlighting ── */
        .editor-content pre {
          background: #1e1e1e;
          border-radius: 8px;
          padding: 1em 1.25em;
          overflow-x: auto;
          margin: 1em 0;
        }
        .editor-content pre code {
          background: none;
          padding: 0;
          font-size: 0.875em;
          font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
          color: #d4d4d4;
        }
        .hljs-comment, .hljs-quote { color: #6a9955; }
        .hljs-keyword, .hljs-selector-tag, .hljs-built_in { color: #569cd6; }
        .hljs-string, .hljs-attr { color: #ce9178; }
        .hljs-number, .hljs-literal { color: #b5cea8; }
        .hljs-title, .hljs-section { color: #dcdcaa; }
        .hljs-type, .hljs-class { color: #4ec9b0; }
        .hljs-variable, .hljs-template-variable { color: #9cdcfe; }
        .hljs-tag { color: #569cd6; }
        .hljs-name { color: #4ec9b0; }
        .hljs-attribute { color: #9cdcfe; }
        .hljs-symbol, .hljs-bullet { color: #b5cea8; }
        .hljs-meta { color: #9b9b9b; }
        .hljs-deletion { color: #f44747; }
        .hljs-addition { color: #b5cea8; }
        .hljs-emphasis { font-style: italic; }
        .hljs-strong { font-weight: bold; }
      `}</style>

      {/* Link hover popup */}
      {linkPopup && (
        <div
          ref={linkPopupRef}
          className="absolute z-50 flex items-center gap-1 rounded-lg border border-white/10 bg-[#2a2a2a] px-2 py-1.5 shadow-xl"
          style={{ top: linkPopup.top, left: linkPopup.left }}
          onMouseEnter={handlePopupMouseEnter}
          onMouseLeave={handlePopupMouseLeave}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="max-w-[200px] truncate text-xs text-white/60">
            {linkPopup.url}
          </span>
          <div className="mx-1 h-3 w-px bg-white/10" />
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              window.open(linkPopup.url, "_blank", "noopener,noreferrer")
              setLinkPopup(null)
            }}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ExternalLink size={11} />
            Open
          </button>
        {editable && (
            <button
              onMouseDown={(e) => {
                e.preventDefault()
                const url = linkPopup.url
                setLinkPopup(null)
                setLinkUrl(url)
                setLinkModalOpen(true)
              }}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Pencil size={11} />
              Edit
            </button>
          )}
        </div>
      )}

      {/* Link modal — only shown when editable */}
      {linkModalOpen && editable && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) cancelLink() }}
        >
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#1e1e1e] p-5 shadow-2xl">
            <p className="mb-3 text-sm font-medium text-white/70">Insert link</p>
            <input
              ref={linkInputRef}
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmLink()
                if (e.key === "Escape") cancelLink()
              }}
              placeholder="https://"
              className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onMouseDown={(e) => { e.preventDefault(); cancelLink() }}
                className="rounded-lg px-4 py-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onMouseDown={(e) => { e.preventDefault(); confirmLink() }}
                className="rounded-lg bg-white/10 px-4 py-1.5 text-sm text-white hover:bg-white/20 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bubble toolbar — only shown when editable */}
      {bubbleVisible && editable && (
        <div
          className="absolute z-50 flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#2a2a2a] px-1.5 py-1 shadow-xl"
          style={{ top: bubblePos.top, left: bubblePos.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <BubbleButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="H1"><Heading1 size={14} /></BubbleButton>
          <BubbleButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="H2"><Heading2 size={14} /></BubbleButton>
          <BubbleButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="H3"><Heading3 size={14} /></BubbleButton>
          <div className="mx-1 h-4 w-px bg-white/10" />
          <BubbleButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold"><Bold size={14} /></BubbleButton>
          <BubbleButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic"><Italic size={14} /></BubbleButton>
          <BubbleButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough"><Strikethrough size={14} /></BubbleButton>
          <BubbleButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Code"><Code size={14} /></BubbleButton>
          <div className="mx-1 h-4 w-px bg-white/10" />
          <BubbleButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List"><List size={14} /></BubbleButton>
          <BubbleButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered List"><ListOrdered size={14} /></BubbleButton>
          <BubbleButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote"><Quote size={14} /></BubbleButton>
          <BubbleButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code Block"><Code2 size={14} /></BubbleButton>
          <div className="mx-1 h-4 w-px bg-white/10" />
          <BubbleButton onClick={openLinkModal} active={editor.isActive("link")} title="Link"><LinkIcon size={14} /></BubbleButton>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}

function BubbleButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded p-1.5 transition-colors ${
        active ? "bg-white/20 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  )
}
