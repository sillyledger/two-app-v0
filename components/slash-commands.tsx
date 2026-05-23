"use client"

import { Extension } from "@tiptap/core"
import { ReactRenderer } from "@tiptap/react"
import Suggestion from "@tiptap/suggestion"
import {
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Code2,
  Minus,
  Table,
  ImageIcon,
} from "lucide-react"
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from "react"
import tippy from "tippy.js"

const COMMANDS = [
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: Heading1,
    command: (editor: any) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: Heading2,
    command: (editor: any) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: Heading3,
    command: (editor: any) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: "Bold",
    description: "Make text bold",
    icon: Bold,
    command: (editor: any) => editor.chain().focus().toggleBold().run(),
  },
  {
    title: "Italic",
    description: "Make text italic",
    icon: Italic,
    command: (editor: any) => editor.chain().focus().toggleItalic().run(),
  },
  {
    title: "Strikethrough",
    description: "Strike through text",
    icon: Strikethrough,
    command: (editor: any) => editor.chain().focus().toggleStrike().run(),
  },
  {
    title: "Bullet List",
    description: "Unordered list",
    icon: List,
    command: (editor: any) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: "Numbered List",
    description: "Ordered list",
    icon: ListOrdered,
    command: (editor: any) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: "Blockquote",
    description: "Indented quote block",
    icon: Quote,
    command: (editor: any) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: "Code",
    description: "Inline code snippet",
    icon: Code,
    command: (editor: any) => editor.chain().focus().toggleCode().run(),
  },
  {
    title: "Code Block",
    description: "Multi-line code block",
    icon: Code2,
    command: (editor: any) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: "Table",
    description: "Insert a table",
    icon: Table,
    command: (editor: any) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: "Divider",
    description: "Horizontal rule",
    icon: Minus,
    command: (editor: any) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: "Image",
    description: "Upload an image from your device",
    icon: ImageIcon,
    command: (_editor: any) => {
  const input = document.querySelector('input[accept="image/jpeg,image/png,image/gif,image/webp"]') as HTMLInputElement | null
  if (input) input.click()
},
  },
]

export const CommandList = forwardRef((props: any, ref: any) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = useCallback(
    (index: number) => {
      const item = props.items[index]
      if (item) props.command(item)
    },
    [props]
  )

  useEffect(() => setSelectedIndex(0), [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }: { event: KeyboardEvent }) {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i === 0 ? props.items.length - 1 : i - 1))
        return true
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i === props.items.length - 1 ? 0 : i + 1))
        return true
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  if (!props.items.length) return null

  return (
    <div className="slash-menu">
      {props.items.map((item: any, index: number) => {
        const Icon = item.icon
        return (
          <button
            key={item.title}
            className={`slash-menu-item ${index === selectedIndex ? "active" : ""}`}
            onMouseEnter={() => setSelectedIndex(index)}
            onMouseDown={(e) => {
              e.preventDefault()
              selectItem(index)
            }}
          >
            <span className="slash-menu-icon">
              <Icon size={15} />
            </span>
            <span className="slash-menu-text">
              <span className="slash-menu-title">{item.title}</span>
              <span className="slash-menu-desc">{item.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
})

CommandList.displayName = "CommandList"

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }: any) => {
          editor.chain().focus().deleteRange(range).run()
          props.command(editor)
        },
        items: ({ query }: { query: string }) => {
          if (!query) return COMMANDS
          return COMMANDS.filter(
            (item) =>
              item.title.toLowerCase().includes(query.toLowerCase()) ||
              item.description.toLowerCase().includes(query.toLowerCase())
          )
        },
        render: () => {
          let component: any
          let popup: any

          return {
            onStart(props: any) {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              })

              if (!props.clientRect) return

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                arrow: false,
                offset: [0, 8],
              })
            },

            onUpdate(props: any) {
              component.updateProps(props)
              if (!props.clientRect) return
              popup[0].setProps({
                getReferenceClientRect: props.clientRect,
              })
            },

            onKeyDown(props: any) {
              if (props.event.key === "Escape") {
                popup[0].hide()
                return true
              }
              return component.ref?.onKeyDown(props) ?? false
            },

            onExit() {
              popup[0].destroy()
              component.destroy()
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
