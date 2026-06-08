import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

// In-memory map of docId → Set of SSE response controllers
// Each connected device/tab gets one controller
const listeners = new Map<string, Set<ReadableStreamDefaultController>>()

export function addListener(docId: string, controller: ReadableStreamDefaultController) {
  if (!listeners.has(docId)) listeners.set(docId, new Set())
  listeners.get(docId)!.add(controller)
}

export function removeListener(docId: string, controller: ReadableStreamDefaultController) {
  listeners.get(docId)?.delete(controller)
  if (listeners.get(docId)?.size === 0) listeners.delete(docId)
}

export function broadcastDocUpdate(docId: string) {
  const docListeners = listeners.get(docId)
  if (!docListeners || docListeners.size === 0) return
  const message = `data: updated\n\n`
  const encoded = new TextEncoder().encode(message)
  for (const controller of docListeners) {
    try {
      controller.enqueue(encoded)
    } catch {
      // Controller is closed — remove it
      docListeners.delete(controller)
    }
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let controller: ReadableStreamDefaultController

  const stream = new ReadableStream({
    start(c) {
      controller = c
      addListener(id, controller)

      // Send an initial heartbeat so the connection is confirmed open
      const heartbeat = new TextEncoder().encode(`: heartbeat\n\n`)
      controller.enqueue(heartbeat)
    },
    cancel() {
      removeListener(id, controller)
    },
  })

  // Keep-alive ping every 25 seconds to prevent the connection dropping
  const keepAliveInterval = setInterval(() => {
    try {
      const ping = new TextEncoder().encode(`: ping\n\n`)
      controller.enqueue(ping)
    } catch {
      clearInterval(keepAliveInterval)
    }
  }, 25000)

  // Clean up interval when request is aborted (tab closed, navigation, etc.)
  request.signal.addEventListener('abort', () => {
    clearInterval(keepAliveInterval)
    removeListener(id, controller)
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disables Nginx buffering (important for Vercel)
    },
  })
}
