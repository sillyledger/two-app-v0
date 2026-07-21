import PusherJS, { type Channel } from "pusher-js"
import * as Y from "yjs"
import * as awarenessProtocol from "y-protocols/awareness"

const DOC_UPDATE_INTERVAL_MS = 100
const AWARENESS_UPDATE_INTERVAL_MS = 200
const PEER_SYNC_TIMEOUT_MS = 2000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

interface PusherYjsProviderOptions {
  docId: string
  doc: Y.Doc
  awareness: awarenessProtocol.Awareness
  /**
   * Called at most once, and only when it's safe to do so: either we're the
   * first client in the room (nothing to sync from), or no peer answered our
   * sync request in time. Must populate `doc` synchronously from the saved
   * DB content. Never called if a peer's live state was applied instead —
   * doing both would duplicate content, since Yjs merges independent seeds
   * as a union rather than deduping them.
   */
  seed: () => void
}

/**
 * Custom Yjs transport over a Pusher presence channel, replacing Liveblocks.
 * There's no persistent Yjs server here — Pusher just relays messages between
 * currently-connected clients — so a newly joining client must either seed
 * itself from the DB (if it's alone) or pull the live document state from an
 * existing peer (if not), rather than always seeding independently. Two
 * clients independently seeding the same DB content into two empty Y.Docs
 * would merge as duplicated content, not a no-op.
 */
export class PusherYjsProvider {
  private docId: string
  private doc: Y.Doc
  private awareness: awarenessProtocol.Awareness
  private pusher: PusherJS
  private channel: Channel
  private subscribed = false
  private destroyed = false

  private pendingDocUpdates: Uint8Array[] = []
  private docUpdateTimer: ReturnType<typeof setTimeout> | null = null
  private pendingAwarenessClients: Set<number> = new Set()
  private awarenessTimer: ReturnType<typeof setTimeout> | null = null

  /** Resolves once the doc is either seeded from DB or synced from a peer. */
  public readonly synced: Promise<void>
  private resolveSynced!: () => void

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === "pusher-remote" || origin === "pusher-sync") return
    this.pendingDocUpdates.push(update)
    if (!this.docUpdateTimer) {
      this.docUpdateTimer = setTimeout(() => this.flushDocUpdates(), DOC_UPDATE_INTERVAL_MS)
    }
  }

  private handleAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => {
    if (origin === "pusher-remote") return
    for (const clientId of [...added, ...updated, ...removed]) {
      this.pendingAwarenessClients.add(clientId)
    }
    if (!this.awarenessTimer) {
      this.awarenessTimer = setTimeout(() => this.flushAwareness(), AWARENESS_UPDATE_INTERVAL_MS)
    }
  }

  constructor({ docId, doc, awareness, seed }: PusherYjsProviderOptions) {
    this.docId = docId
    this.doc = doc
    this.awareness = awareness

    this.synced = new Promise((resolve) => {
      this.resolveSynced = resolve
    })

    this.pusher = new PusherJS(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher-auth",
    })

    this.channel = this.pusher.subscribe(`presence-doc-${docId}`)

    this.channel.bind("pusher:subscription_succeeded", (members: { count: number }) => {
      this.subscribed = true

      // Client events only start working after subscription_succeeded — this
      // is also where we decide how to get the doc into a valid starting state.
      if (members.count <= 1) {
        seed()
        this.resolveSynced()
        return
      }

      let settled = false
      const onSyncResponse = (payload: { update: string }) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        this.channel.unbind("client-yjs-sync-response", onSyncResponse)
        Y.applyUpdate(this.doc, base64ToBytes(payload.update), "pusher-sync")
        this.resolveSynced()
      }
      this.channel.bind("client-yjs-sync-response", onSyncResponse)

      const ok = this.channel.trigger("client-yjs-sync-request", {})
      if (!ok) {
        // Client Events not enabled on this Pusher app yet — surface this
        // rather than silently falling back, since it means realtime sync
        // is entirely non-functional, not just this one request.
        console.error(
          "[PusherYjsProvider] Failed to trigger client-yjs-sync-request — Pusher Client Events are probably not enabled for this app."
        )
      }

      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        this.channel.unbind("client-yjs-sync-response", onSyncResponse)
        // Nobody answered in time — fall back to DB content so we don't get
        // stuck forever rather than risk starting from a wrong base state.
        seed()
        this.resolveSynced()
      }, PEER_SYNC_TIMEOUT_MS)
    })

    this.channel.bind("client-yjs-sync-request", () => {
      this.channel.trigger("client-yjs-sync-response", {
        update: bytesToBase64(Y.encodeStateAsUpdate(this.doc)),
      })
    })

    this.channel.bind("client-yjs-update", (payload: { update: string }) => {
      Y.applyUpdate(this.doc, base64ToBytes(payload.update), "pusher-remote")
    })

    this.channel.bind("client-awareness-update", (payload: { update: string }) => {
      awarenessProtocol.applyAwarenessUpdate(this.awareness, base64ToBytes(payload.update), "pusher-remote")
    })

    this.doc.on("update", this.handleDocUpdate)
    this.awareness.on("update", this.handleAwarenessUpdate)
  }

  private flushDocUpdates() {
    this.docUpdateTimer = null
    if (this.destroyed || this.pendingDocUpdates.length === 0) return
    if (!this.subscribed) {
      // Not subscribed yet — re-queue for the next tick rather than dropping.
      this.docUpdateTimer = setTimeout(() => this.flushDocUpdates(), DOC_UPDATE_INTERVAL_MS)
      return
    }
    const merged = Y.mergeUpdates(this.pendingDocUpdates)
    this.pendingDocUpdates = []
    this.channel.trigger("client-yjs-update", { update: bytesToBase64(merged) })
  }

  private flushAwareness() {
    this.awarenessTimer = null
    if (this.destroyed || this.pendingAwarenessClients.size === 0) return
    if (!this.subscribed) {
      this.awarenessTimer = setTimeout(() => this.flushAwareness(), AWARENESS_UPDATE_INTERVAL_MS)
      return
    }
    const clientIds = Array.from(this.pendingAwarenessClients)
    this.pendingAwarenessClients.clear()
    const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, clientIds)
    this.channel.trigger("client-awareness-update", { update: bytesToBase64(update) })
  }

  destroy() {
    this.destroyed = true
    if (this.docUpdateTimer) clearTimeout(this.docUpdateTimer)
    if (this.awarenessTimer) clearTimeout(this.awarenessTimer)
    this.doc.off("update", this.handleDocUpdate)
    this.awareness.off("update", this.handleAwarenessUpdate)
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], "provider-destroy")
    this.channel.unbind_all()
    this.pusher.unsubscribe(`presence-doc-${this.docId}`)
    this.pusher.disconnect()
  }
}
