'use client'

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { useEffect, useState, useRef } from 'react'

interface EditorProps {
  content: string
  onChange: (content: string) => void
}

export function Editor({ content, onChange }: EditorProps) {
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const linkInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline cursor-pointer',
        },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[60vh] text-base leading-snug',
      },
      handleClick(view, pos, event) {
        const target = event.target as HTMLElement
        const link = target.closest('a') as HTMLAnchorElement | null
        if (link && (event.metaKey || event.ctrlKey)) {
          window.open(link.href, '_blank')
          return true
        }
        return false
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowLinkInput(true)
        setTimeout(() => linkInputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleLinkSubmit = () => {
    if (!editor) return
    if (linkUrl) {
      const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`
      editor.chain().focus().setLink({ href: url }).run()
    }
    setLinkUrl('')
    setShowLinkInput(false)
  }

  const handleRemoveLink = () => {
    if (!editor) return
    editor.chain().focus().unsetLink().run()
  }

  if (!editor) return null

  const currentHref = editor.getAttributes('link').href

  return (
    <div>
      {/* Bubble menu — shows when cursor is inside a link */}
      <BubbleMenu
        editor={editor}
        shouldShow={({ editor }) => editor.isActive('link')}
        tippyOptions={{ duration: 100, placement: 'bottom' }}
      >
        <div className="flex items-center gap-2 bg-background border border-input rounded-lg shadow-lg px-3 py-2">
          
            href={currentHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 underline max-w-[200px] truncate"
          >
            {currentHref}
          </a>
          <span className="text-muted-foreground text-xs">·</span>
          <button
            onMouseDown={(e) => { e.preventDefault(); handleRemoveLink() }}
            className="text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Remove
          </button>
          <span className="text-muted-foreground text-xs">·</span>
          
            href={currentHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Open ↗
          </a>
        </div>
      </BubbleMenu>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 mb-4 pb-3 border-b border-input">
        <ToolbarButton onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} label="H1" />
        <ToolbarButton onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} label="H2" />
        <ToolbarButton onClick={() => editor.chain().focus().setHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} label="H3" />
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="B" bold />
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="I" italic />
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} label="S̶" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} label="`" />
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="• List" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="1. List" />
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} label="Quote" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} label="Code" />
        <Divider />

        {showLinkInput ? (
          <div className="flex items-center gap-1">
            <input
              ref={linkInputRef}
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLinkSubmit()
                if (e.key === 'Escape') setShowLinkInput(false)
              }}
              placeholder="https://..."
              autoFocus
              className="text-sm px-2 py-1 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring w-40"
            />
            <button onMouseDown={(e) => { e.preventDefault(); handleLinkSubmit() }} className="text-sm px-2 py-1 rounded-lg bg-foreground text-background">Add</button>
            <button onMouseDown={(e) => { e.preventDefault(); setShowLinkInput(false) }} className="text-sm px-2 py-1 rounded-lg text-muted-foreground hover:bg-muted">Cancel</button>
          </div>
        ) : (
          <ToolbarButton
            onClick={() => { setShowLinkInput(true); setTimeout(() => linkInputRef.current?.focus(), 50) }}
            active={editor.isActive('link')}
            label="🔗 Link"
          />
        )}
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarButton({ onClick, active, label, bold, italic }: { onClick: () => void; active: boolean; label: string; bold?: boolean; italic?: boolean }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={`px-3 py-1 rounded-lg text-sm transition-colors ${active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'} ${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''}`}
    >
      {label}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-input mx-1" />
}
