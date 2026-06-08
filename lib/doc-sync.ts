// Shared in-memory store for SSE connections
// Lives in lib/ so both the sync endpoint and the PUT handler can import it

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
  const encoded = new TextEncoder().encode(`data: updated\n\n`)
  for (const controller of docListeners) {
    try {
      controller.enqueue(encoded)
    } catch {
      docListeners.delete(controller)
    }
  }
}
