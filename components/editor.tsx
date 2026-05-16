'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useState } from 'react'

interface EditorProps {
  content: string
  onChange: (content: string) => void
}

export function Editor({ content, onChange }: EditorProps) {
  const [slashMenu, setSlashMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write something, or type '/' for commands...",
      }),
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
      const text = editor.getText()
      const lastChar = text[text.length - 1]
      if (lastChar === '/') {
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          const rect = range.getBoundingClientRect()
          setMenuPos({ top: rect.bottom + window.scrollY + 8, left: rect.left })
          setSlashMenu(true)
        }
      } else {
        setSlashMenu(false)
      }
    },
  })

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== content) {
      editor.commands.setContent(content)
    }
  }, [])

  const runCommand = (command: string) => {
    if (!editor) return
    // Delete the slash character first
    editor.commands.deleteRange({
      from: editor.state.selection.from - 1,
      to: editor.state.selection.from,
    })
    switch (command) {
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
      <EditorContent
        editor={editor}
        className="prose prose-lg max-w-none focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[60vh]"
      />

      {slashMenu && (
        <div
          style={{ top: menuPos.top, left: menuPos.left }}
          className="fixed z-50 w-64 rounded-xl border border-input bg-background shadow-lg overflow-hidden"
        >
          {[
            { label: 'Heading 1', sub: 'Main heading', cmd: 'h1' },
            { label: 'Heading 2', sub: 'Sub heading', cmd: 'h2' },
            { label: 'Heading 3', sub: 'Sub-sub heading', cmd: 'h3' },
            { label: 'Bullet List', sub: 'Simple bullet points', cmd: 'bullet' },
            { label: 'Numbered List', sub: 'Ordered list', cmd: 'ordered' },
            { label: 'Quote', sub: 'Blockquote', cmd: 'quote' },
            { label: 'Code', sub: 'Code block', cmd: 'code' },
          ].map((item) => (
            <button
              key={item.cmd}
              onMouseDown={(e) => {
                e.preventDefault()
                runCommand(item.cmd)
              }}
              className="w-full flex flex-col px-4 py-2 text-left hover:bg-muted transition-colors"
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
