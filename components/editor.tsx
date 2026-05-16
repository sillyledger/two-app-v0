'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface EditorProps {
  content: string
  onChange: (content: string) => void
}

const menuItems = [
  { label: 'Heading 1', sub: 'Main heading', cmd: 'h1' },
  { label: 'Heading 2', sub: 'Sub heading', cmd: 'h2' },
  { label: 'Heading 3', sub: 'Sub-sub heading', cmd: 'h3' },
  { label: 'Bullet List', sub: 'Simple bullet points', cmd: 'bullet' },
  { label: 'Numbered List', sub: 'Ordered list', cmd: 'ordered' },
  { label: 'Quote', sub: 'Blockquote', cmd: 'quote' },
  { label: 'Code', sub: 'Code block', cmd: 'code' },
]

export function Editor({ content, onChange }: EditorProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const slashFromRef = useRef<number>(0)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write something, or type '/' for commands...",
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[60vh] text-base leading-snug',
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML())
      const { from } = editor.state.selection
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from)
      if (textBefore === '/') {
        slashFromRef.current = from
        const coords = editor.view.coordsAtPos(from)
        setMenuPos({ top: coords.bottom + 8, left: coords.left })
        setMenuOpen(true)
      } else if (menuOpen) {
        setMenuOpen(false)
      }
    },
  })

  // Keep a ref to editor so we can use it in runCommand without closure issues
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    if (!editor || !content) return
    editor.commands.setContent(content)
  }, [])

  const runCommand = (cmd: string) => {
    const ed = editorRef.current
    if (!ed) return

    setMenuOpen(false)

    const from = slashFromRef.current

    // Re-focus the editor first, then run everything in one chain
    ed.view.focus()

    // Use a transaction to delete slash and apply formatting atomically
    const { state, dispatch } = ed.view
    const tr = state.tr.delete(from - 1, from)
    dispatch(tr)

    // Now apply the block type
    setTimeout(() => {
      const e = editorRef.current
      if (!e) return
      switch (cmd) {
        case 'h1': e.commands.setHeading({ level: 1 }); break
        case 'h2': e.commands.setHeading({ level: 2 }); break
        case 'h3': e.commands.setHeading({ level: 3 }); break
        case 'bullet': e.commands.toggleBulletList(); break
        case 'ordered': e.commands.toggleOrderedList(); break
        case 'quote': e.commands.toggleBlockquote(); break
        case 'code': e.commands.toggleCodeBlock(); break
      }
      onChange(e.getHTML())
    }, 50)
  }

  return (
    <div className="relative">
      <EditorContent editor={editor} />
      {menuOpen && typeof window !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-64 rounded-xl border border-input bg-background shadow-xl overflow-hidden"
        >
          {menuItems.map((item) => (
            <button
              key={item.cmd}
              onPointerDown={(e) => {
                e.preventDefault()
                runCommand(item.cmd)
              }}
              className="w-full flex flex-col px-4 py-2 text-left hover:bg-muted transition-colors border-b border-input last:border-0"
            >
              <span className="text-sm font-medium text-foreground">{item.label}</span>
              <span className="text-xs text-muted-foreground">{item.sub}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
