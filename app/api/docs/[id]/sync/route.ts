import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { addListener, removeListener } from '@/lib/doc-sync'

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
      const heartbeat = new TextEncoder().encode(`: heartbeat\n\n`)
      controller.enqueue(heartbeat)
    },
    cancel() {
      removeListener(id, controller)
    },
  })

  const keepAliveInterval = setInterval(() => {
    try {
      const ping = new TextEncoder().encode(`: ping\n\n`)
      controller.enqueue(ping)
    } catch {
      clearInterval(keepAliveInterval)
    }
  }, 25000)

  request.signal.addEventListener('abort', () => {
    clearInterval(keepAliveInterval)
    removeListener(id, controller)
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
