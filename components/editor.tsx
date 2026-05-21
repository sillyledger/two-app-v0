"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Typography from "@tiptap/extension-typography"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import Placeholder from "@tiptap/extension-placeholder"
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
      Link.configure({ openOnClick: !editable }),
      Typography,
      Placeholder.configure({
        placeholder: "Start writing, or press / for commands…",
      }),
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
        if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
          event.preventDefault()
          openLinkModal()
          return true
        }
        return false
      },
    },
  })

  useEffect(() => {
    if (editor && onReady) {
      onReady(() => editor.commands.focus('end'))
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

        /* ── Placeholder ── */
        .editor-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgba(255, 255, 255, 0.2);
          pointer-events: none;
          height: 0;
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
