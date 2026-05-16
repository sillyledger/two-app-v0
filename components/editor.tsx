'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const menuItems = [
  { label: 'Heading 1', sub: 'Main heading', cmd: 'h1' },
  { label: 'Heading 2', sub: 'Sub heading', cmd: 'h2' },
  { label: 'Heading 3', sub: 'Sub-sub heading', cmd: 'h3' },
  { label: 'Bullet List', sub: 'Simple bullet points', cmd: 'bullet' },
  { label: 'Numbered List', sub: 'Ordered list', cmd: 'ordered' },
  { label: 'Quote', sub: 'Blockquote', cmd: 'quote' },
  { label: 'Code', sub: 'Code block', cmd: 'code' },
]

interface EditorProps {
  content: string
  onChange: (content: string) => void
}

export function Editor({ content, onChange }: EditorProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const commandRef = useRef<((cmd: string) => void) | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const SlashCommands = Extension.create({
    name: 'slashCommands',
    addOptions() {
      return {
        suggestion: {
          char: '/',
          command: ({ editor, range, props }: any) => {
            props.command({ editor, range })
          },
          items: () => menuItems,
          render: () => {
            return {
              onStart: (props: any) => {
                const { clientRect } = props
                if (clientRect) {
                  const rect = clientRect()
                  setMenuPos({ top: rect.bottom + window.scrollY + 4, left: rect.left })
                }
                commandRef.current = (cmd: string) => {
                  const { editor, range } = props
                  editor.chain().focus().deleteRange(range).run()
                  switch (cmd) {
                    case 'h1': editor.chain().focus().toggleHeading({ level: 1 }).run(); break
                    case 'h2': editor.chain().focus().toggleHeading({ level: 2 }).run(); break
                    case 'h3': editor.chain().focus().toggleHeading({ level: 3 }).run(); break
                    case 'bullet': editor.chain().focus().toggleBulletList().run(); break
                    case 'ordered': editor.chain().focus().toggleOrderedList().run(); break
                    case 'quote': editor.chain().focus().toggleBlockquote().run(); break
                    case 'code': editor.chain().focus().toggleCodeBlock().run(); break
                  }
                  setMenuOpen(false)
                }
                setMenuOpen(true)
              },
              onUpdate: (props: any) => {
                const { clientRect } = props
                if (clientRect) {
                  const rect = clientRect()
                  setMenuPos({ top: rect.bottom + window.scrollY + 4, left: rect.left })
                }
                commandRef.current = (cmd: string) => {
                  const { editor, range } = props
                  editor.chain().focus().deleteRange(range).run()
                  switch (cmd) {
                    case 'h1': editor.chain().focus().toggleHeading({ level: 1 }).run(); break
                    case 'h2': editor.chain().focus().toggleHeading({ level: 2 }).run(); break
                    case 'h3': editor.chain().focus().toggleHeading({ level: 3 }).run(); break
                    case 'bullet': editor.chain().focus().toggleBulletList().run(); break
                    case 'ordered': editor.chain().focus().toggleOrderedList().run(); break
                    case 'quote': editor.chain().focus().toggleBlockquote().run(); break
                    case 'code': editor.chain().focus().toggleCodeBlock().run(); break
                  }
                  setMenuOpen(false)
                }
              },
              onExit: () => {
                setMenuOpen(false)
              },
            }
          },
        },
      }
    },
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
        }),
      ]
    },
  })

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write something, or type '/' for commands...",
      }),
      SlashCommands,
    ],
    content,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[60vh] text-base leading-snug',
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor || !content) return
    editor.commands.setContent(content)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative">
      <EditorContent editor={editor} />

      {menuOpen && typeof window !== 'undefined' && createPortal(
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
                commandRef.current?.(item.cmd)
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
