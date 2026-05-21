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

  // Read font size from localStorage and apply the CSS variable on mount
  useEffect(() => {
    const saved = localStorage.getItem("font-size-px")
    const size = saved ? Number(saved) : 17
    document.documentElement.style.setProperty("--editor-font-size", `${size}px`)
  }, [])

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

    container.querySelectorAll("a").forEach((a) => attachToLink(a as HTMLAnchorElement))

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
          margin-bottom
