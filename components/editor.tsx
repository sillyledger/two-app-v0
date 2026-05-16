'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useState, useRef } from 'react'

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
  const [slashMenu, setSlashMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

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
      const html = editor.getHTML()
      onChange(html)

      const { from } = editor.state.selection
      const textBefore = editor.state.doc.textBetween(
        Math.max(0, from - 1),
        from
      )

      if (textBefore === '/') {
        // Use the DOM node at cursor position
        const { view } = editor
        const coords = view.coordsAtPos(from)
        setMenuPos({
          top: coords.bottom + window.scrollY + 4,
          left: coords.left,
        })
        setSlashMenu(true)
      } else {
        setSlashMenu(false)
      }
    },
  })

  useEffect(() => {
    if (!editor) return
    if (content) {
      editor.commands.setContent(content)
    }
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setSlashMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const runCommand = (cmd: string) => {
    if (!editor) return

    const { from } = editor.state.selection
    editor.chain().focus().deleteRange({ from: from - 1, to: from }).run()

    switch (cmd) {
      case 'h1':
        editor.chain().focus().toggleHeading({ level: 1 }).run()
        break
      case 'h2':
        editor.chain().focus().toggleHeading({ level: 2 }).run()
        break
      case 'h3':
        editor.chain().focus().toggleHeading({ level: 3 }).run()
        break
      case 'bullet':
        editor.chain().focus().toggleBulletList().run()
        break
      case 'ordered':
        editor.chain().focus().toggleOrderedList().run()
        break
      case 'quote':
        editor.chain().focus().toggleBlockquote().run()
        break
      case 'code':
        editor.chain().focus().toggleCodeBlock().run()
        break
    }

    setSlashMenu(false)
  }

  return (
    <div className="relative">
      <EditorContent editor={editor} />

      {slashMenu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
            zIndex: 9999,
          }}
          className="w-64 rounded-xl border border-input bg-background shadow-xl overflow-hidden"
        >
          {menuItems.map((item) => (
            <button
              key={item.cmd}
              onMouseDown={(e) => {
                e.preventDefault()
                runCommand(item.cmd)
              }}
              className="w-full flex flex-col px-4 py-2 text-left hover:bg-muted transition-colors border-b border-input last:border-0"
            >
              <span className="text-sm font-medium text-foreground">{item.label}</span>
              <span className="text-xs text-muted-foreground">{item.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
