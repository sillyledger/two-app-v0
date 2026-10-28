"use client"

import Link from "next/link"
import { MoreVertical, Copy, Download, Trash2, Globe, Lock, FolderInput, Star, FileText, PanelRight, Share2, Columns2, ArrowLeftRight, History } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import VersionHistoryModal from "./version-history-modal"
import MoveToFolderModal from "./move-to-folder-modal"

interface Folder {
  id: string
  name: string
  parent_id?: string | null
  pinned?: boolean
  path?: { id: string; name: string }[]
  [key: string]: unknown
}

interface PresenceMember {
  id: string
  name: string
}

interface DocTopbarProps {
  docTitle: string
  folder?: Folder | null
  saveStatus: "saved" | "saving"
  content?: string
  onDelete?: () => void
  onMoved?: () => Promise<void> | void
  docId?: string | string[]
  isPublic?: boolean
  sidebarWidth?: string
  wideMode?: boolean
  onToggleWide?: () => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
  detailOpen?: boolean
  onToggleDetail?: () => void
  currentUserName?: string
  splitViewActive?: boolean
  onToggleSplitView?: () => void
  presenceMembers?: PresenceMember[]
  onRestore?: (title: string, content: string) => void
}

// Inline content, headings, paragraphs, links and images
function basicHtmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>/gi, '\n').replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n').replace(/<\/ol>/gi, '\n')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>|<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>|<img[^>]*src="([^"]*)"[^>]*>/gi, (_,src1,alt1,alt2,src2,src3) => `![${alt1||alt2||''}](${src1||src2||src3||''})\n\n`)
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Lists, checklists, code blocks, tables and quotes nest, so they are
// converted from a parsed tree. Everything else goes through basicHtmlToMarkdown.
interface HtmlNode {
  tag: string
  attrs: string
  start: number
  innerStart: number
  innerEnd: number
  end: number
  children: HtmlNode[]
}

const VOID_TAGS = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'wbr'])
const MD_BLOCK_TAGS = new Set(['ul', 'ol', 'pre', 'table', 'blockquote'])

function parseHtml(html: string): HtmlNode {
  const root: HtmlNode = { tag: '', attrs: '', start: 0, innerStart: 0, innerEnd: html.length, end: html.length, children: [] }
  const stack = [root]
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    if (!m[2]) continue
    const tag = m[2].toLowerCase()
    if (m[1]) {
      const i = stack.map(n => n.tag).lastIndexOf(tag)
      if (i < 1) continue
      for (let j = stack.length - 1; j >= i; j--) {
        stack[j].innerEnd = m.index
        stack[j].end = j === i ? re.lastIndex : m.index
      }
      stack.length = i
    } else {
      const node: HtmlNode = { tag, attrs: m[3], start: m.index, innerStart: re.lastIndex, innerEnd: re.lastIndex, end: re.lastIndex, children: [] }
      stack[stack.length - 1].children.push(node)
      if (!VOID_TAGS.has(tag) && !m[3].endsWith('/')) stack.push(node)
    }
  }
  for (let j = stack.length - 1; j >= 1; j--) {
    stack[j].innerEnd = html.length
    stack[j].end = html.length
  }
  return root
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

// Converts a node's contents. Nested lists inside a list item sit directly
// under the item's text (tight), elsewhere they get a blank line before them.
function nodeToMarkdown(html: string, node: HtmlNode, tightLists = false): string {
  const blocks: string[] = []
  let out = ''
  let pos = node.innerStart
  const visit = (n: HtmlNode) => {
    for (const c of n.children) {
      if (MD_BLOCK_TAGS.has(c.tag)) {
        const kind = c.tag === 'ul' || c.tag === 'ol' ? 'L' : 'B'
        out += html.slice(pos, c.start) + `\n\n\u0000${kind}${blocks.length}\u0000\n\n`
        blocks.push(blockToMarkdown(html, c))
        pos = c.end
      } else {
        visit(c)
      }
    }
  }
  visit(node)
  out += html.slice(pos, node.innerEnd)
  let md = basicHtmlToMarkdown(out)
  if (tightLists) md = md.replace(/\n+(?=\u0000L)/g, '\n')
  return md.replace(/\u0000[LB](\d+)\u0000/g, (_, i) => blocks[Number(i)])
}

function blockToMarkdown(html: string, node: HtmlNode): string {
  if (node.tag === 'pre') {
    const code = node.children.find(c => c.tag === 'code') ?? node
    const lang = /language-([\w+#.-]+)/i.exec(code.attrs)?.[1]
    const text = decodeEntities(html.slice(code.innerStart, code.innerEnd).replace(/<[^>]+>/g, '')).replace(/\n$/, '')
    let fence = '```'
    while (text.includes(fence)) fence += '`'
    return `${fence}${lang && lang !== 'plaintext' ? lang : ''}\n${text}\n${fence}`
  }

  if (node.tag === 'blockquote') {
    return nodeToMarkdown(html, node).split('\n').map(line => (line ? `> ${line}` : '>')).join('\n')
  }

  if (node.tag === 'table') {
    const rows: string[][] = []
    const collectRows = (n: HtmlNode) => {
      for (const c of n.children) {
        if (c.tag === 'tr') {
          rows.push(c.children
            .filter(cell => cell.tag === 'th' || cell.tag === 'td')
            .map(cell => nodeToMarkdown(html, cell).replace(/\s*\n+\s*/g, ' ').replace(/\|/g, '\\|')))
        } else if (c.tag !== 'table') {
          collectRows(c)
        }
      }
    }
    collectRows(node)
    if (rows.length === 0) return ''
    const cols = Math.max(1, ...rows.map(r => r.length))
    const toLine = (cells: string[]) => `| ${Array.from({ length: cols }, (_, i) => cells[i] ?? '').join(' | ')} |`
    return [toLine(rows[0]), toLine(Array(cols).fill('---')), ...rows.slice(1).map(toLine)].join('\n')
  }

  // ul / ol, including checklists (TipTap taskList)
  const isTask = /data-type="taskList"/i.test(node.attrs)
  const ordered = node.tag === 'ol'
  let n = Number(/start="(\d+)"/i.exec(node.attrs)?.[1] ?? 1)
  return node.children
    .filter(c => c.tag === 'li')
    .map(li => {
      const marker = isTask
        ? `- [${/data-checked="true"/i.test(li.attrs) ? 'x' : ' '}] `
        : ordered ? `${n++}. ` : '- '
      const indent = ' '.repeat(isTask ? 2 : marker.length)
      return nodeToMarkdown(html, li, true)
        .split('\n')
        .map((line, i) => (i === 0 ? marker + line : line ? indent + line : ''))
        .join('\n')
    })
    .join('\n')
}

function htmlToMarkdown(html: string): string {
  return nodeToMarkdown(html, parseHtml(html))
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function loadImageAsBase64(src: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        resolve({ dataUrl, width: canvas.width, height: canvas.height })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = `/api/proxy-image?url=${encodeURIComponent(src)}`
  })
}

async function exportAsPDF(docTitle: string, html: string) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const maxWidth = pageWidth - margin * 2
  let y = margin

  const checkY = (needed: number) => {
    if (y + needed > pageHeight - margin) { doc.addPage(); y = margin }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(0, 0, 0)
  const titleLines = doc.splitTextToSize(docTitle || 'Untitled', maxWidth)
  doc.text(titleLines, margin, y)
  y += titleLines.length * 10 + 4
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  const parser = new DOMParser()
  const domDoc = parser.parseFromString(html, 'text/html')
  const body = domDoc.body

  type RGB = [number, number, number]
  type InlineStyle = { bold: boolean; italic: boolean; code: boolean; link?: string }
  type Run = { text: string; style: InlineStyle } | { br: true }
  type Seg = { text: string; style: InlineStyle; x: number; width: number }
  type TextOpts = { size: number; bold?: boolean; italic?: boolean; color: RGB }
  type BlockCtx = { italic: boolean; color: RGB; after: number }

  const BODY_COLOR: RGB = [30, 30, 30]
  const LINK_COLOR: RGB = [37, 99, 235]
  const INLINE_SKIP = new Set(['label', 'input', 'colgroup', 'script', 'style'])
  const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'hr', 'img', 'div'])
  const lineHeight = (size: number) => size * 1.15 * 0.3528

  const setFont = (style: InlineStyle, size: number) => {
    const variant = style.bold && style.italic ? 'bolditalic' : style.bold ? 'bold' : style.italic ? 'italic' : 'normal'
    doc.setFont(style.code ? 'courier' : 'helvetica', variant)
    doc.setFontSize(size)
  }

  // Text, bold/italic/code/link and line breaks, in reading order
  function collectRuns(nodes: ArrayLike<Node>, style: InlineStyle, runs: Run[] = []): Run[] {
    for (const node of Array.from(nodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').replace(/\s+/g, ' ')
        if (text) runs.push({ text, style })
        continue
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue
      const el = node as Element
      const tag = el.tagName.toLowerCase()
      if (INLINE_SKIP.has(tag)) continue
      if (tag === 'br') { runs.push({ br: true }); continue }
      if (BLOCK_TAGS.has(tag) && runs.length > 0 && !('br' in runs[runs.length - 1])) runs.push({ br: true })
      collectRuns(el.childNodes, {
        bold: style.bold || tag === 'strong' || tag === 'b' || /^h[1-6]$/.test(tag) || tag === 'th',
        italic: style.italic || tag === 'em' || tag === 'i',
        code: style.code || tag === 'code',
        link: tag === 'a' ? el.getAttribute('href') || style.link : style.link,
      }, runs)
    }
    return runs
  }

  // Word-wraps runs into lines of positioned segments
  function layout(runs: Run[], width: number, size: number): Seg[][] {
    const lines: Seg[][] = []
    let line: Seg[] = []
    let x = 0
    const endLine = () => {
      while (line.length && line[line.length - 1].text === ' ') line.pop()
      lines.push(line)
      line = []
      x = 0
    }
    const push = (text: string, style: InlineStyle) => {
      setFont(style, size)
      const w = doc.getTextWidth(text)
      line.push({ text, style, x, width: w })
      x += w
    }
    for (const run of runs) {
      if ('br' in run) { endLine(); continue }
      for (const tok of run.text.split(/( )/)) {
        if (!tok) continue
        if (tok === ' ') { if (x > 0) push(' ', run.style); continue }
        setFont(run.style, size)
        const w = doc.getTextWidth(tok)
        if (x > 0 && x + w > width) endLine()
        if (w > width) {
          const pieces: string[] = doc.splitTextToSize(tok, width)
          pieces.forEach((piece, i) => { push(piece, run.style); if (i < pieces.length - 1) endLine() })
        } else {
          push(tok, run.style)
        }
      }
    }
    endLine()
    while (lines.length && lines[lines.length - 1].length === 0) lines.pop()
    return lines
  }

  function drawLine(line: Seg[], x: number, baseline: number, size: number, color: RGB) {
    for (const seg of line) {
      setFont(seg.style, size)
      doc.setTextColor(...(seg.style.link ? LINK_COLOR : color))
      doc.text(seg.text, x + seg.x, baseline)
      if (seg.style.link) {
        const h = size * 0.3528
        doc.link(x + seg.x, baseline - h * 0.8, seg.width, h, { url: seg.style.link })
        doc.setDrawColor(...LINK_COLOR)
        doc.setLineWidth(0.2)
        doc.line(x + seg.x, baseline + 0.6, x + seg.x + seg.width, baseline + 0.6)
      }
    }
  }

  // Draws wrapped text. Spacing matches the original export: lines are
  // drawn lineHeight apart, then y moves on by advance per line + after.
  function renderText(runs: Run[], x: number, width: number, opts: TextOpts, advance: number, after: number): boolean {
    const lines = layout(runs, width, opts.size)
    if (lines.length === 0 || lines.every(l => l.length === 0)) return false
    const lh = lineHeight(opts.size)
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        y += lh
        if (y > pageHeight - margin) { doc.addPage(); y = margin }
      }
      drawLine(lines[i], x, y, opts.size, opts.color)
    }
    y += lines.length * advance + after - lh * (lines.length - 1)
    return true
  }

  const baseStyle = (opts: { bold?: boolean; italic?: boolean }): InlineStyle => ({ bold: !!opts.bold, italic: !!opts.italic, code: false })

  // Block children of an element; loose inline content becomes a paragraph
  async function renderBlocks(parent: Element, x: number, width: number, ctx: BlockCtx) {
    let inline: Node[] = []
    const flush = () => {
      if (inline.length === 0) return
      const runs = collectRuns(inline, baseStyle(ctx))
      inline = []
      if (runs.some(r => 'br' in r || r.text.trim())) {
        checkY(6)
        renderText(runs, x, width, { size: 10, italic: ctx.italic, color: ctx.color }, 5.5, ctx.after)
      }
    }
    for (const child of Array.from(parent.childNodes)) {
      const tag = child.nodeType === Node.ELEMENT_NODE ? (child as Element).tagName.toLowerCase() : ''
      if (tag && BLOCK_TAGS.has(tag)) {
        flush()
        await renderBlock(child as Element, x, width, ctx)
      } else {
        inline.push(child)
      }
    }
    flush()
  }

  async function renderList(node: Element, x: number, width: number, ctx: BlockCtx) {
    const isTask = node.getAttribute('data-type') === 'taskList'
    const ordered = node.tagName.toLowerCase() === 'ol'
    const items = Array.from(node.children).filter(c => c.tagName.toLowerCase() === 'li')
    let n = parseInt(node.getAttribute('start') || '1', 10) || 1
    const lx = x + 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const markerW = isTask ? 5 : ordered ? Math.max(5, doc.getTextWidth(`${n + items.length - 1}.`) + 1.5) : 4
    for (const li of items) {
      checkY(6)
      const startY = y
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...ctx.color)
      if (isTask) {
        const checked = li.getAttribute('data-checked') === 'true'
        doc.setLineWidth(0.3)
        doc.setDrawColor(110, 110, 110)
        if (checked) {
          doc.setFillColor(60, 60, 60)
          doc.rect(lx, y - 2.9, 3.2, 3.2, 'FD')
          doc.setDrawColor(255, 255, 255)
          doc.setLineWidth(0.45)
          doc.line(lx + 0.7, y - 1.3, lx + 1.4, y - 0.6)
          doc.line(lx + 1.4, y - 0.6, lx + 2.6, y - 2.2)
        } else {
          doc.rect(lx, y - 2.9, 3.2, 3.2, 'S')
        }
        doc.setLineWidth(0.2)
      } else {
        doc.text(ordered ? `${n++}.` : '•', lx, y)
      }
      await renderBlocks(li, lx + markerW, width - 4 - markerW, { ...ctx, after: 1 })
      if (y === startY) y += 5.5 + 1
    }
  }

  function renderCode(node: Element, x: number, width: number) {
    const text = (node.textContent || '').replace(/\t/g, '  ').replace(/\n$/, '')
    const size = 9
    const lh = 4.2
    const pad = 3
    doc.setFont('courier', 'normal')
    doc.setFontSize(size)
    const maxChars = Math.max(1, Math.floor((width - pad * 2) / doc.getTextWidth('M')))
    const lines = text.split('\n').flatMap(l => {
      if (l.length <= maxChars) return [l]
      const parts: string[] = []
      for (let i = 0; i < l.length; i += maxChars) parts.push(l.slice(i, i + maxChars))
      return parts
    })
    checkY(lh + pad * 2)
    let top = y - 2
    let i = 0
    while (i < lines.length) {
      const fits = Math.floor((pageHeight - margin - top - pad * 2) / lh)
      const count = Math.max(1, Math.min(lines.length - i, fits))
      const boxH = count * lh + pad * 2
      doc.setFillColor(245, 245, 245)
      doc.rect(x, top, width, boxH, 'F')
      doc.setFont('courier', 'normal')
      doc.setFontSize(size)
      doc.setTextColor(...BODY_COLOR)
      for (let k = 0; k < count; k++) doc.text(lines[i + k], x + pad, top + pad + (k + 1) * lh - 1.2)
      top += boxH
      i += count
      if (i < lines.length) { doc.addPage(); top = margin }
    }
    y = top + 6.5
  }

  function renderTable(node: Element, x: number, width: number) {
    const rows = Array.from(node.querySelectorAll('tr'))
    const cols = Math.max(1, ...rows.map(r => r.querySelectorAll(':scope > th, :scope > td').length))
    const colW = width / cols
    const size = 9
    const lh = lineHeight(size)
    const pad = 2
    let top = y - 2
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll(':scope > th, :scope > td'))
      const isHeader = cells.some(c => c.tagName.toLowerCase() === 'th')
      const cellLines = cells.map(c => layout(collectRuns(c.childNodes, baseStyle({ bold: c.tagName.toLowerCase() === 'th' })), colW - pad * 2, size))
      const rowH = Math.max(1, ...cellLines.map(l => l.length)) * lh + pad * 2 + 1
      if (top + rowH > pageHeight - margin) { doc.addPage(); top = margin }
      doc.setDrawColor(200, 200, 200)
      doc.setFillColor(245, 245, 245)
      doc.setLineWidth(0.2)
      for (let c = 0; c < cols; c++) doc.rect(x + c * colW, top, colW, rowH, isHeader ? 'FD' : 'S')
      cellLines.forEach((lines, c) => {
        lines.forEach((line, k) => drawLine(line, x + c * colW + pad, top + pad + 2.6 + k * lh, size, BODY_COLOR))
      })
      top += rowH
    }
    y = top + 6.5
  }

  async function renderBlock(node: Element, x: number, width: number, ctx: BlockCtx) {
    const tag = node.tagName?.toLowerCase()

    if (tag === 'img') {
      const src = node.getAttribute('src') || ''
      if (src) {
        const imgData = await loadImageAsBase64(src)
        if (imgData) {
          const aspectRatio = imgData.height / imgData.width
          const imgW = Math.min(width, 120)
          const imgH = imgW * aspectRatio
          checkY(imgH + 4)
          try {
            doc.addImage(imgData.dataUrl, 'JPEG', x, y, imgW, imgH)
            y += imgH + 4
          } catch { }
        }
      }
      return
    }

    if (tag === 'ul' || tag === 'ol') {
      await renderList(node, x, width, ctx)
      return
    }

    if (tag === 'blockquote') {
      await renderBlocks(node, x + 6, width - 8, { italic: true, color: [100, 100, 100], after: 2 })
      return
    }

    if (tag === 'pre') {
      renderCode(node, x, width)
      return
    }

    if (tag === 'table') {
      renderTable(node, x, width)
      return
    }

    if (tag === 'hr') {
      checkY(6)
      doc.setDrawColor(200, 200, 200)
      doc.line(x, y, x + width, y)
      y += 6
      return
    }

    const heading = ({ h1: [16, 12, 8, 4], h2: [13, 10, 7, 3], h3: [11, 8, 6, 2] } as Record<string, number[]>)[tag]
    if (heading) {
      const [size, needed, advance, after] = heading
      checkY(needed)
      renderText(collectRuns(node.childNodes, baseStyle({ bold: true })), x, width, { size, bold: true, color: [0, 0, 0] }, advance, after)
      return
    }

    if (tag === 'p') {
      const imgs = node.querySelectorAll('img')
      if (imgs.length > 0) {
        for (const img of Array.from(imgs)) { await renderBlock(img, x, width, ctx) }
        return
      }
      const runs = collectRuns(node.childNodes, baseStyle(ctx))
      if (runs.some(r => 'br' in r || r.text.trim())) {
        checkY(6)
        renderText(runs, x, width, { size: 10, italic: ctx.italic, color: ctx.color }, 5.5, ctx.after)
      }
      return
    }

    await renderBlocks(node, x, width, ctx)
  }

  for (const child of Array.from(body.children)) {
    await renderBlock(child as Element, margin, maxWidth, { italic: false, color: BODY_COLOR, after: 2 })
  }

  doc.save(`${docTitle.trim() || 'untitled'}.pdf`)
}

const PRESENCE_COLORS = [
  '#52e0b8', '#e05252', '#f5a623',
  '#a052e0', '#52b8e0', '#52e052', '#e052a0',
]

function PresenceAvatars({ currentUserName, members }: { currentUserName?: string; members?: PresenceMember[] }) {
  const others = members || []

  const selfName = currentUserName || 'You'
  const selfInitial = selfName[0]?.toUpperCase() ?? 'Y'

  const visible = others.slice(0, 3)
  const overflow = others.length - 3

  return (
    <div className="flex items-center mr-1">
      <div
        title={`${selfName} (you)`}
        style={{
          width: 24, height: 24, borderRadius: '50%',
          backgroundColor: '#5271e0',
          border: '2px solid var(--panel)',
          outline: '2px solid #5271e0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 600, color: '#fff',
          position: 'relative', flexShrink: 0, zIndex: 10,
        }}
      >
        {selfInitial}
      </div>

      {visible.map((other, i) => {
        const name = other.name || '?'
        const initial = name[0]?.toUpperCase() ?? '?'
        const color = PRESENCE_COLORS[i % PRESENCE_COLORS.length]
        return (
          <div
            key={other.id}
            title={name}
            style={{
              width: 24, height: 24, borderRadius: '50%',
              backgroundColor: color,
              border: '2px solid var(--panel)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 600, color: '#fff',
              marginLeft: -6, zIndex: 9 - i, position: 'relative', flexShrink: 0,
            }}
          >
            {initial}
          </div>
        )
      })}

      {overflow > 0 && (
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          backgroundColor: 'var(--surface-2)',
          border: '2px solid var(--panel)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 600, color: 'var(--text-2)',
          marginLeft: -6, position: 'relative', flexShrink: 0,
        }}>
          +{overflow}
        </div>
      )}
    </div>
  )
}

export default function DocTopbar({
  docTitle,
  folder,
  saveStatus,
  content = '',
  onDelete,
  onMoved,
  docId,
  isPublic = false,
  sidebarWidth = '0px',
  wideMode = false,
  onToggleWide,
  isFavorite = false,
  onToggleFavorite,
  detailOpen = false,
  onToggleDetail,
  currentUserName,
  splitViewActive = false,
  onToggleSplitView,
  presenceMembers,
  onRestore,
}: DocTopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [copyToast, setCopyToast] = useState(false)
  const [publicEnabled, setPublicEnabled] = useState(isPublic)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [moveToast, setMoveToast] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const shareRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setPublicEnabled(isPublic) }, [isPublic])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false)
    }
    if (menuOpen || shareOpen) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen, shareOpen])

  const handleExportMarkdown = () => {
    setMenuOpen(false)
    const md = `# ${docTitle}\n\n${htmlToMarkdown(content)}`
    downloadFile(`${docTitle.trim() || 'untitled'}.md`, md, 'text/markdown')
  }

  const handleExportPDF = () => {
    setMenuOpen(false)
    exportAsPDF(docTitle, content)
  }

  const handleCopyDoc = () => {
    setMenuOpen(false)
    const md = `# ${docTitle}\n\n${htmlToMarkdown(content)}`
    navigator.clipboard.writeText(md).then(() => {
      setCopyToast(true)
      setTimeout(() => setCopyToast(false), 2000)
    })
  }

  const handleTogglePublic = async () => {
    const newValue = !publicEnabled
    setPublicEnabled(newValue)
    await fetch(`/api/docs/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: newValue }),
    })
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/p/${docId}`
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  const openMoveModal = async () => {
    setMenuOpen(false)
    const res = await fetch("/api/folders?all=true")
    const data = await res.json()
    setFolders(Array.isArray(data) ? data : [])
    setShowMoveModal(true)
  }

  const handleMove = async (folderId: string) => {
    const res = await fetch(`/api/docs/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId }),
    })
    setShowMoveModal(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to move doc.')
      return
    }
    await onMoved?.()
    setMoveToast(true)
    setTimeout(() => setMoveToast(false), 2000)
  }

  const handleWideMode = () => {
    setMenuOpen(false)
    onToggleWide?.()
  }

  const handleOpenShare = () => {
    setMenuOpen(false)
    setShareOpen(true)
  }

  return (
    <>
      <header
        className="fixed top-0 z-40 h-[44px] flex items-center px-4 transition-all duration-200"
        style={{ left: "var(--sidebar-width, 0px)", right: 0, backgroundColor: "var(--panel)" }}
      >
        {/* LEFT — breadcrumb */}
        <div className="flex items-center gap-0.5 min-w-0 flex-1">
          <Link href="/" className="text-[12px] font-medium truncate transition-colors" style={{ color: "var(--text-3)" }}>
            Home
          </Link>
          {folder ? (
            <>
              <span className="mx-1 text-[12px]" style={{ color: "var(--text-3)" }}>/</span>
              {(folder.path && folder.path.length > 0 ? folder.path : [{ id: folder.id, name: folder.name }]).flatMap((crumb) => [
                <Link key={`${crumb.id}-link`} href={`/folders/${crumb.id}`} className="text-[12px] font-medium truncate transition-colors hover:underline" style={{ color: "var(--text-3)" }}>
                  {crumb.name}
                </Link>,
                <span key={`${crumb.id}-sep`} className="mx-1 text-[12px]" style={{ color: "var(--text-3)" }}>/</span>,
              ])}
            </>
          ) : (
            <span className="mx-1 text-[12px]" style={{ color: "var(--text-3)" }}>/</span>
          )}
          <span className="text-[12px] font-medium truncate max-w-[220px]" style={{ color: "var(--text-2)" }}>
            {docTitle || "Untitled"}
          </span>
        </div>

        {/* RIGHT — actions */}
        <div className="flex items-center gap-1 shrink-0 ml-2">

          {/* Save status */}
          <div className="flex items-center gap-1.5 h-5 mr-1">
            {saveStatus === "saving" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/80 animate-pulse" />
                <span className="text-[11px]" style={{ color: "var(--text-3)" }}>Saving...</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                <span className="text-[11px]" style={{ color: "var(--text-3)" }}>Saved</span>
              </>
            )}
          </div>

          {/* Presence avatars */}
          <PresenceAvatars currentUserName={currentUserName} members={presenceMembers} />

          {/* Favorite */}
          {onToggleFavorite && (
            <button onClick={onToggleFavorite} title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: isFavorite ? "#EF9F27" : "var(--text-3)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#EF9F27")}
              onMouseLeave={e => (e.currentTarget.style.color = isFavorite ? "#EF9F27" : "var(--text-3)")}
            ><Star size={14} fill={isFavorite ? "#EF9F27" : "none"} /></button>
          )}

          {/* Move to folder */}
          {onDelete && (
            <button onClick={openMoveModal} title="Move to folder"
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: "var(--text-3)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-1)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-3)" }}
            ><FolderInput size={14} /></button>
          )}

          {/* Split View button */}
          {onToggleSplitView && (
            <button
              onClick={onToggleSplitView}
              title={splitViewActive ? "Close split view" : "Open split view"}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors"
              style={{
                color: splitViewActive ? "var(--nav-active-text)" : "var(--text-3)",
                backgroundColor: splitViewActive ? "var(--nav-active-bg)" : "transparent",
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-1)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = splitViewActive ? "var(--nav-active-bg)" : "transparent"; e.currentTarget.style.color = splitViewActive ? "var(--nav-active-text)" : "var(--text-3)" }}
            >
              <Columns2 size={13} /> Split View
            </button>
          )}

          {/* Details panel toggle */}
          {onToggleDetail && (
            <button onClick={onToggleDetail} title={detailOpen ? "Close details" : "Open details"}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: detailOpen ? "var(--text-1)" : "var(--text-3)", backgroundColor: detailOpen ? "var(--surface-2)" : "transparent" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-1)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = detailOpen ? "var(--surface-2)" : "transparent"; e.currentTarget.style.color = detailOpen ? "var(--text-1)" : "var(--text-3)" }}
            ><PanelRight size={14} /></button>
          )}

          {/* ··· menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(v => !v)}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: "var(--text-3)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-1)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-3)" }}
            ><MoreVertical size={15} /></button>

            {menuOpen && (
              <div className="absolute right-0 top-9 z-50 rounded-lg shadow-xl w-[210px] py-1 overflow-hidden" style={{ backgroundColor: "var(--menu-bg)", border: "1px solid var(--border-subtle)" }}>

                {/* VIEW */}
                <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-3)" }}>View</p>
                {onToggleWide && (
                  <button onClick={handleWideMode} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors" style={{ color: "var(--text-2)" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--surface-2)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  ><ArrowLeftRight size={12} style={{ color: "var(--text-3)" }} /> {wideMode ? "Narrow view" : "Wide view"}</button>
                )}

                <div className="my-1 mx-2" style={{ borderTop: "1px solid var(--border-subtle)" }} />

                {/* SHARE */}
                <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Share</p>
                <div className="relative" ref={shareRef}>
                  <button onClick={handleOpenShare} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors" style={{ color: "var(--text-2)" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--surface-2)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  ><Share2 size={12} style={{ color: "var(--text-3)" }} /> Share doc…</button>
                </div>

                <div className="my-1 mx-2" style={{ borderTop: "1px solid var(--border-subtle)" }} />

                {/* HISTORY */}
                <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-3)" }}>History</p>
                <button onClick={() => { setMenuOpen(false); setShowVersionHistory(true) }} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors" style={{ color: "var(--text-2)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--surface-2)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                ><History size={12} style={{ color: "var(--text-3)" }} /> Version history</button>
                <div className="my-1 mx-2" style={{ borderTop: "1px solid var(--border-subtle)" }} />

                {/* EXPORT */}
                <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Export</p>
                <button onClick={handleCopyDoc} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors" style={{ color: "var(--text-2)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--surface-2)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                ><Copy size={12} style={{ color: "var(--text-3)" }} /> Copy as Markdown</button>
                <button onClick={handleExportMarkdown} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors" style={{ color: "var(--text-2)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--surface-2)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                ><Download size={12} style={{ color: "var(--text-3)" }} /> Export as Markdown</button>
                <button onClick={handleExportPDF} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors" style={{ color: "var(--text-2)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--surface-2)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                ><FileText size={12} style={{ color: "var(--text-3)" }} /> Export as PDF</button>

                <div className="my-1 mx-2" style={{ borderTop: "1px solid var(--border-subtle)" }} />

                {/* DELETE */}
                <button onClick={() => { setMenuOpen(false); setShowDeleteModal(true) }} className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] transition-colors" style={{ color: "var(--danger)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.08)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                ><Trash2 size={12} /> Delete doc</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Share dropdown — now rendered outside the menu so it can be opened from the menu item */}
      {shareOpen && (
        <div ref={shareRef} className="fixed z-50 rounded-xl shadow-2xl w-[300px] p-4" style={{ top: 52, right: 16, backgroundColor: "var(--menu-bg)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-[13px] font-semibold mb-1" style={{ color: "var(--text-1)" }}>Share this doc</p>
          <p className="text-[11px] mb-4" style={{ color: "var(--text-3)" }}>Anyone with the link can view this doc when enabled.</p>
          <div className="flex items-center justify-between rounded-lg px-3 py-2.5 mb-3" style={{ backgroundColor: "var(--surface-2)" }}>
            <div className="flex items-center gap-2">
              {publicEnabled ? <Globe size={13} className="text-emerald-400 shrink-0" /> : <Lock size={13} style={{ color: "var(--text-3)" }} className="shrink-0" />}
              <div>
                <p className="text-[12px] font-medium" style={{ color: "var(--text-2)" }}>{publicEnabled ? "Anyone with the link" : "Private"}</p>
                <p className="text-[10px]" style={{ color: "var(--text-3)" }}>{publicEnabled ? "Link sharing is on" : "Only you can access"}</p>
              </div>
            </div>
            <button onClick={handleTogglePublic} className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${publicEnabled ? 'bg-emerald-500' : 'bg-[var(--toggle-off)]'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${publicEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
          <button onClick={handleCopyLink} disabled={!publicEnabled}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-[12px] font-medium transition-colors"
            style={{ backgroundColor: publicEnabled ? "var(--surface-2)" : "var(--surface)", color: publicEnabled ? "var(--text-2)" : "var(--text-3)", cursor: publicEnabled ? "pointer" : "not-allowed" }}
          ><Copy size={12} />{linkCopied ? "Copied!" : "Copy link"}</button>
          <button onClick={() => setShareOpen(false)} className="flex items-center justify-center w-full mt-2 py-1.5 text-[11px] rounded-lg transition-colors" style={{ color: "var(--text-3)" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--surface-2)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >Close</button>
        </div>
      )}

      {/* Toasts */}
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2 text-[12px] shadow-xl" style={{ backgroundColor: "var(--menu-bg-2)", border: "1px solid var(--border-subtle)", color: "var(--text-1)" }}>
          Copied to clipboard
        </div>
      )}
      {moveToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2 text-[12px] shadow-xl" style={{ backgroundColor: "var(--menu-bg-2)", border: "1px solid var(--border-subtle)", color: "var(--text-1)" }}>
          Doc moved
        </div>
      )}

      {/* Move to folder modal */}
      {showMoveModal && (
        <MoveToFolderModal folders={folders} onMove={handleMove} onClose={() => setShowMoveModal(false)} />
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 backdrop-blur-[2px]" style={{ backgroundColor: "var(--overlay-soft)" }} onClick={() => setShowDeleteModal(false)} />
          <div className="relative rounded-xl shadow-2xl w-[320px] p-5 z-10" style={{ backgroundColor: "var(--menu-bg)", border: "1px solid var(--border-subtle)" }}>
            <h2 className="text-[14px] font-semibold mb-1" style={{ color: "var(--text-1)" }}>Delete doc</h2>
            <p className="text-[12px] mb-5" style={{ color: "var(--text-3)" }}>This doc will move to Trash. You can restore it from there.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors" style={{ color: "var(--text-3)" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--surface-2)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >Cancel</button>
              <button onClick={() => { setShowDeleteModal(false); onDelete?.() }} className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-red-500/90 text-white hover:bg-red-500 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version history modal */}
      {showVersionHistory && docId && (
        <VersionHistoryModal
          docId={String(docId)}
          docTitle={docTitle}
          onClose={() => setShowVersionHistory(false)}
          onRestore={(title, content) => {
            setShowVersionHistory(false)
            onRestore?.(title, content)
          }}
        />
      )}
    </>
  )
}
