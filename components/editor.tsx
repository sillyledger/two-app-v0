"use client"

import { useEditor, EditorContent, Extension } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Typography from "@tiptap/extension-typography"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import Placeholder from "@tiptap/extension-placeholder"
import { Table as TableExtension } from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import TableCell from "@tiptap/extension-table-cell"
import Image from "@tiptap/extension-image"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import { SlashCommands } from "./slash-commands"
import { common, createLowlight } from "lowlight"
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code2,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  ExternalLink,
  Pencil,
  FileText,
  Plus,
  Trash2,
  ArrowLeftRight,
  Rows,
  Columns,
} from "lucide-react"
import { useCallback, useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"

const lowlight = createLowlight(common)

const LinkKeyboardFix = Extension.create({
  name: "linkKeyboardFix",
  addKeyboardShortcuts() {
    return {
      Space: ({ editor }) => {
        if (editor.isActive("link")) {
          editor.commands.unsetMark("link")
          editor.commands.insertContent(" ")
          return true
        }
        return false
      },
      Backspace: ({ editor }) => {
        const { selection } = editor.state
        const { empty, anchor } = selection
        if (!empty || anchor === 0) return false
        if (editor.isActive("link")) {
          const { from } = selection
          editor.chain()
            .setTextSelection({ from: from - 1, to: from })
            .unsetMark("link")
            .setTextSelection(from)
            .run()
          return false
        }
        return false
      },
    }
  },
})

interface EditorProps {
  content: string
  onChange: (content: string) => void
  onReady?: (focusFn: () => void) => void
  onImageUpload?: (file: File) => Promise<string | null>
  onInsertImageReady?: (fn: (url: string) => void) => void
  editable?: boolean
}

interface Doc {
  uuid: string
  title: string
}

export default function Editor({ content, onChange, onReady, onImageUpload, onInsertImageReady, editable = true }: EditorProps) {
  const router = useRouter()
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const [bubblePos, setBubblePos] = useState({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [allDocs, setAllDocs] = useState<Doc[]>([])
  const [docResults, setDocResults] = useState<Doc[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const linkInputRef = useRef<HTMLInputElement>(null)

  const [linkPopup, setLinkPopup] = useState<{ url: string; top: number; left: number } | null>(null)
  const linkPopupRef = useRef<HTMLDivElement>(null)
  const hidePopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editorReady, setEditorReady] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [tableToolbar, setTableToolbar] = useState<{ top: number; left: number } | null>(null)
  const [tableAddRow, setTableAddRow] = useState<{ top: number; left: number; width: number } | null>(null)
  const [tableFitWidth, setTableFitWidth] = useState(false)
  const tableToolbarRef = useRef<HTMLDivElement>(null)

  const onImageUploadRef = useRef(onImageUpload)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)
  const uploadingRef = useRef(false)

  useEffect(() => {
    onImageUploadRef.current = onImageUpload
  }, [onImageUpload])

  const doImageUpload = useCallback(async (file: File) => {
    if (uploadingRef.current) return
    if (!onImageUploadRef.current) return
    uploadingRef.current = true
    setUploading(true)

    const blobUrl = URL.createObjectURL(file)
    editorRef.current?.chain().focus().setImage({ src: blobUrl }).run()

    try {
      const realUrl = await onImageUploadRef.current(file)
      if (realUrl && editorRef.current) {
        const { state, dispatch } = editorRef.current.view
        const { tr, doc } = state
        doc.descendants((node, pos) => {
          if (node.type.name === 'image' && node.attrs.src === blobUrl) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: realUrl })
          }
        })
        dispatch(tr)
      }
    } finally {
      URL.revokeObjectURL(blobUrl)
      uploadingRef.current = false
      setUploading(false)
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem("font-size-px")
    const size = saved ? Number(saved) : 17
    document.documentElement.style.setProperty("--editor-font-size", `${size}px`)
  }, [])

  useEffect(() => {
    if (!linkModalOpen) return
    fetch("/api/docs")
      .then((r) => r.json())
      .then((data) => setAllDocs(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [linkModalOpen])

  useEffect(() => {
    const isUrl = linkUrl.startsWith("http://") || linkUrl.startsWith("https://") || linkUrl.startsWith("www.")
    if (isUrl || linkUrl === "") {
      setDocResults([])
      setSelectedIndex(0)
      return
    }
    const q = linkUrl.toLowerCase()
    setDocResults(allDocs.filter((d) => (d.title || "Untitled").toLowerCase().includes(q)).slice(0, 6))
    setSelectedIndex(0)
  }, [linkUrl, allDocs])

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
      LinkKeyboardFix,
      Image.configure({
        HTMLAttributes: {
          class: "editor-image",
        },
      }),
      TableExtension.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true,
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
        setTableToolbar(null)
        return
      }

      const isInTable = editor.isActive("table") || editor.isActive("tableCell") || editor.isActive("tableHeader")

      if (isInTable) {
        setBubbleVisible(false)
        const { from } = editor.state.selection
        const domNode = editor.view.nodeDOM(from) as HTMLElement | null
        if (domNode) {
          let el: HTMLElement | null = domNode
          while (el && el.tagName !== "TABLE") {
            el = el.parentElement
          }
          if (el && containerRef.current) {
            const tableRect = el.getBoundingClientRect()
            const containerRect = containerRef.current.getBoundingClientRect()
            setTableToolbar({
              top: tableRect.top - containerRect.top - 44,
              left: 0,
            })
            setTableAddRow({
              top: tableRect.bottom - containerRect.top + 4,
              left: tableRect.left - containerRect.left,
              width: tableRect.width,
            })
            return
          }
        }
        setTableToolbar({ top: -44, left: 0 })
        return
      }

      setTableToolbar(null)
      setTableAddRow(null)

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
      handleClick: (view, pos, event) => {
        const target = event.target as HTMLElement
        const anchor = target.closest("a")
        if (!anchor) return false
        const href = anchor.getAttribute("href")
        if (!href) return false
        event.preventDefault()
        if (href.startsWith("/")) {
          router.push(href)
        } else {
          window.open(href, "_blank", "noopener,noreferrer")
        }
        return true
      },
      handleDrop: (view, event) => {
        if (!editable) return false
        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return false
        const imageFile = Array.from(files).find((f) => f.type.startsWith("image/"))
        if (!imageFile) return false
        event.preventDefault()
        doImageUpload(imageFile)
        return true
      },
      handlePaste: (view, event) => {
        if (!editable) return false
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile()
            if (file) {
              event.preventDefault()
              doImageUpload(file)
              return true
            }
          }
        }
        return false
      },
    },
    onCreate: ({ editor: e }) => {
      editorRef.current = e
      setEditorReady(true)
    },
  })

  useEffect(() => {
    if (editor && onInsertImageReady) {
      onInsertImageReady((url: string) => {
        editor.chain().focus().setImage({ src: url }).run()
      })
    }
  }, [editor, onInsertImageReady])

  useEffect(() => {
    if (editor) editorRef.current = editor
  }, [editor])

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

      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href") || ""
        if (!href) return
        e.preventDefault()
        e.stopPropagation()
        if (href.startsWith("/")) {
          router.push(href)
        } else {
          window.open(href, "_blank", "noopener,noreferrer")
        }
      })
    }

    container.querySelectorAll("a").forEach((a) => attachToLink(a as HTMLAnchorElement))

    const observer = new MutationObserver(() => {
      container.querySelectorAll("a").forEach((a) => attachToLink(a as HTMLAnchorElement))
    })
    observer.observe(container, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      attachedLinks.clear()
    }
  }, [editorReady, router])

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

  const confirmLink = useCallback((url?: string) => {
    if (!editor) return
    const href = url ?? linkUrl
    if (href === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
    }
    setLinkModalOpen(false)
    setLinkUrl("")
    setDocResults([])
  }, [editor, linkUrl])

  const cancelLink = useCallback(() => {
    setLinkModalOpen(false)
    setLinkUrl("")
    setDocResults([])
    editor?.commands.focus()
  }, [editor])

  const pickDoc = useCallback((doc: Doc) => {
    confirmLink(`/docs/${doc.uuid}`)
  }, [confirmLink])

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (docResults.length === 0) {
      if (e.key === "Enter") confirmLink()
      if (e.key === "Escape") cancelLink()
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, docResults.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      pickDoc(docResults[selectedIndex])
    } else if (e.key === "Escape") {
      cancelLink()
    }
  }

  if (!editor) return null

  return (
    <div ref={containerRef} className="relative">
      <style>{`
        .editor-content {
          font-size: var(--editor-font-size, 17px);
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
        .editor-image {
          max-width: 100%;
          border-radius: 8px;
          margin: 1em 0;
          display: block;
        }
        .editor-content ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0;
          margin: 0.5em 0;
        }
        .editor-content ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.6em;
          margin: 0.3em 0;
        }
        .editor-content ul[data-type="taskList"] li > label {
          margin-top: 0.2em;
          flex-shrink: 0;
          cursor: pointer;
        }
        .editor-content ul[data-type="taskList"] li > label input[type="checkbox"] {
          width: 15px;
          height: 15px;
          border-radius: 4px;
          border: 1.5px solid rgba(255,255,255,0.25);
          background: transparent;
          appearance: none;
          -webkit-appearance: none;
          cursor: pointer;
          position: relative;
          transition: background 0.15s, border-color 0.15s;
        }
        .editor-content ul[data-type="taskList"] li > label input[type="checkbox"]:checked {
          background: rgba(255,255,255,0.15);
          border-color: rgba(255,255,255,0.4);
        }
        .editor-content ul[data-type="taskList"] li > label input[type="checkbox"]:checked::after {
          content: "";
          position: absolute;
          left: 3px;
          top: 1px;
          width: 5px;
          height: 8px;
          border: 1.5px solid rgba(255,255,255,0.8);
          border-top: none;
          border-left: none;
          transform: rotate(45deg);
        }
        .editor-content ul[data-type="taskList"] li > div {
          flex: 1;
          min-width: 0;
        }
        .editor-content ul[data-type="taskList"] li[data-checked="true"] > div p {
          text-decoration: line-through;
          opacity: 0.45;
        }
        .tableWrapper {
          overflow-x: auto;
          margin: 1.25em 0;
          -webkit-overflow-scrolling: touch;
        }
        .tableWrapper.fit-width {
          overflow-x: visible;
          width: 100vw;
          position: relative;
          left: 50%;
          right: 50%;
          margin-left: -50vw;
          margin-right: -50vw;
          padding: 0 4rem;
          box-sizing: border-box;
        }
        .tableWrapper.fit-width table {
          width: 100%;
          min-width: 0;
        }
        .editor-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 0;
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid var(--border);
          display: table;
          min-width: 400px;
        }
        .editor-content td,
        .editor-content th {
          border: 1px solid var(--border);
          padding: 8px 12px;
          min-width: 120px;
          vertical-align: top;
          font-size: 0.9em;
          position: relative;
          box-sizing: border-box;
        }
        .editor-content th {
          background: var(--bg-tertiary);
          font-weight: 600;
          color: var(--text-primary);
          text-align: left;
        }
        .editor-content td {
          color: var(--text-primary);
          background: var(--bg-secondary);
        }
        .editor-content tr:hover td {
          background: var(--bg-tertiary);
        }
        .editor-content .selectedCell:after {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(99, 102, 241, 0.15);
          pointer-events: none;
        }
        .editor-content .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          background: #6366f1;
          cursor: col-resize;
          z-index: 20;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .editor-content td:hover .column-resize-handle,
        .editor-content th:hover .column-resize-handle {
          opacity: 1;
        }
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

      {uploading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-black/40">
          <div className="flex items-center gap-2 rounded-lg bg-[#2a2a2a] px-4 py-2.5 text-sm text-white/80 shadow-xl">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
            Uploading image…
          </div>
        </div>
      )}

      {tableToolbar && editable && (
        <div
          ref={tableToolbarRef}
          className="absolute z-50 flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#2a2a2a] px-1.5 py-1 shadow-xl"
          style={{ top: tableToolbar.top, left: tableToolbar.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <TableButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row below">
            <Rows size={13} /><Plus size={9} className="-ml-0.5 -mt-1" />
          </TableButton>
          <TableButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column right">
            <Columns size={13} /><Plus size={9} className="-ml-0.5 -mt-1" />
          </TableButton>
          <div className="mx-1 h-4 w-px bg-white/10" />
          <TableButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">
            <Rows size={13} className="opacity-60" /><Trash2 size={9} className="-ml-0.5 -mt-1 text-red-400" />
          </TableButton>
          <TableButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column">
            <Columns size={13} className="opacity-60" /><Trash2 size={9} className="-ml-0.5 -mt-1 text-red-400" />
          </TableButton>
          <div className="mx-1 h-4 w-px bg-white/10" />
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              setTableFitWidth((v) => !v)
              if (containerRef.current) {
                const wrapper = containerRef.current.querySelector(".tableWrapper")
                if (wrapper) wrapper.classList.toggle("fit-width")
              }
            }}
            title={tableFitWidth ? "Unset full width" : "Fit to width"}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
              tableFitWidth ? "bg-white/20 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <ArrowLeftRight size={13} />
            <span className="text-[11px]">Fit width</span>
          </button>
          <div className="mx-1 h-4 w-px bg-white/10" />
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              editor.chain().focus().deleteTable().run()
              setTableToolbar(null)
            }}
            title="Delete table"
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
            <span className="text-[11px]">Delete</span>
          </button>
        </div>
      )}

      {tableAddRow && editable && (
        <div
          className="absolute z-40 flex items-center justify-center"
          style={{ top: tableAddRow.top, left: tableAddRow.left, width: tableAddRow.width }}
        >
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              editor.chain().focus().addRowAfter().run()
            }}
            className="w-full flex items-center justify-center gap-1 py-0.5 rounded text-[11px] transition-colors opacity-0 hover:opacity-100"
            style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)" }}
            title="Add row"
          >
            <Plus size={11} />
          </button>
        </div>
      )}

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
            {linkPopup.url.startsWith("/docs/") ? "Internal doc" : linkPopup.url}
          </span>
          <div className="mx-1 h-3 w-px bg-white/10" />
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              const url = linkPopup.url
              setLinkPopup(null)
              if (url.startsWith("/")) {
                router.push(url)
              } else {
                window.open(url, "_blank", "noopener,noreferrer")
              }
            }}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            {linkPopup.url.startsWith("/") ? null : <ExternalLink size={11} />}
            Open
          </button>
          {editable && (
            <>
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
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  const urlToRemove = linkPopup?.url
                  setLinkPopup(null)
                  if (!urlToRemove) return
                  const { state } = editor
                  const { doc } = state
                  let found = false
                  doc.descendants((node, pos) => {
                    if (found) return false
                    node.marks.forEach((mark) => {
                      if (mark.type.name === "link" && mark.attrs.href === urlToRemove) {
                        const from = pos
                        const to = pos + node.nodeSize
                        editor.chain()
                          .focus()
                          .setTextSelection({ from, to })
                          .unsetLink()
                          .run()
                        found = true
                      }
                    })
                  })
                }}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              >
                <Trash2 size={11} />
                Remove
              </button>
            </>
          )}
        </div>
      )}

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
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Paste a URL or search your docs…"
              className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
            />
            {docResults.length > 0 && (
              <div className="mt-2 rounded-lg border border-white/10 bg-[#2a2a2a] overflow-hidden">
                {docResults.map((doc, i) => (
                  <button
                    key={doc.uuid}
                    onMouseDown={(e) => { e.preventDefault(); pickDoc(doc) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors"
                    style={{
                      backgroundColor: i === selectedIndex ? "rgba(255,255,255,0.08)" : "transparent",
                      color: "rgba(255,255,255,0.8)",
                    }}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <FileText size={13} style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
                    <span className="truncate">{doc.title || "Untitled"}</span>
                  </button>
                ))}
              </div>
            )}
            {linkUrl.length > 0 && docResults.length === 0 &&
              !linkUrl.startsWith("http") && !linkUrl.startsWith("www.") && (
              <p className="mt-2 text-xs text-white/30">No docs match &quot;{linkUrl}&quot;</p>
            )}
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
          <BubbleButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="Task List"><ListTodo size={14} /></BubbleButton>
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
  onClick, active, title, children,
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

function TableButton({
  onClick, title, children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className="relative flex items-end rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
    >
      {children}
    </button>
  )
}
