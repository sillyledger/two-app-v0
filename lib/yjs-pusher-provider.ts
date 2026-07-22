import PusherJS, { type PresenceChannel } from "pusher-js"
import * as Y from "yjs"
import * as awarenessProtocol from "y-protocols/awareness"

const DOC_UPDATE_INTERVAL_MS = 100
const AWARENESS_UPDATE_INTERVAL_MS = 200
const PEER_SYNC_TIMEOUT_MS = 2000
// Absolute ceiling from construction, independent of whether the presence
// channel subscription ever succeeds at all (bad/missing Pusher env vars,
// auth endpoint failing, network issues, etc). Without this, a broken Pusher
// connection would leave the editor waiting — and therefore blank — forever,
// which looks exactly like data loss even though the DB content is untouched.
const HARD_SYNC_CEILING_MS = 6000

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
 * Custom Yjs transport over a Pusher presence channel.
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
  private channel: PresenceChannel
  private subscribed = false
  private destroyed = false

  private pendingDocUpdates: Uint8Array[] = []
  private docUpdateTimer: ReturnType<typeof setTimeout> | null = null
  private pendingAwarenessClients: Set<number> = new Set()
  private awarenessTimer: ReturnType<typeof setTimeout> | null = null

  // Presence channels dedupe by user_id — one logged-in user with two tabs
  // open is a single Pusher member but two separate Y.Doc/awareness client
  // ids, so this maps one-to-many when reconciling member_removed.
  private pusherMemberToClientIds = new Map<string, Set<number>>()

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

    // Guards every path below (peer sync, peer timeout, subscription failure,
    // hard ceiling) so seed()/resolveSynced() each fire exactly once no
    // matter which one wins the race.
    let settled = false
    let peerSyncTimeout: ReturnType<typeof setTimeout> | null = null

    this.synced = new Promise((resolve) => {
      this.resolveSynced = resolve
    })

    const settleWithSeed = (reason: string) => {
      if (settled) return
      settled = true
      if (peerSyncTimeout) clearTimeout(peerSyncTimeout)
      clearTimeout(hardCeiling)
      console.warn(`[PusherYjsProvider] Falling back to DB-seeded content (${reason}).`)
      seed()
      this.resolveSynced()
    }

    // Absolute last resort: if we haven't settled by any other path within
    // this window (subscription never succeeding at all, auth endpoint down,
    // missing/misconfigured Pusher env vars, etc), seed from DB anyway rather
    // than leaving the editor waiting — and therefore blank — indefinitely.
    const hardCeiling = setTimeout(() => settleWithSeed("subscription never completed in time"), HARD_SYNC_CEILING_MS)

    this.pusher = new PusherJS(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher-auth",
    })

    this.pusher.connection.bind("error", (err: unknown) => {
      console.error("[PusherYjsProvider] Pusher connection error:", err)
      settleWithSeed("pusher connection error")
    })

    this.channel = this.pusher.subscribe(`presence-doc-${docId}`) as PresenceChannel

    this.channel.bind("pusher:subscription_error", (err: unknown) => {
      console.error("[PusherYjsProvider] Presence channel subscription failed:", err)
      settleWithSeed("subscription_error")
    })

    this.channel.bind("pusher:subscription_succeeded", (members: { count: number }) => {
      const isReconnect = settled
      this.subscribed = true

      if (isReconnect) {
        // We already have a valid doc state from the first connection, but
        // may have missed updates while offline (Pusher doesn't replay
        // client events to a resubscribing client any more than to a new
        // one). Unlike seed(), applying a peer's full state here via
        // Y.applyUpdate is safe/idempotent regardless of what we already
        // have — it's a real Yjs update, not a diff-write derived from HTML.
        if (members.count > 1) this.requestResync()
        return
      }

      // Client events only start working after subscription_succeeded — this
      // is also where we decide how to get the doc into a valid starting state.
      if (members.count <= 1) {
        settleWithSeed("alone in room")
        return
      }

      const onSyncResponse = (payload: { update: string }) => {
        if (settled) return
        settled = true
        if (peerSyncTimeout) clearTimeout(peerSyncTimeout)
        clearTimeout(hardCeiling)
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

      peerSyncTimeout = setTimeout(() => {
        this.channel.unbind("client-yjs-sync-response", onSyncResponse)
        // Nobody answered in time — fall back to DB content so we don't get
        // stuck forever rather than risk starting from a wrong base state.
        settleWithSeed("no peer responded to sync request")
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

    this.channel.bind(
      "client-awareness-update",
      (payload: { update: string; clientIds: number[]; pusherMemberId: string }) => {
        awarenessProtocol.applyAwarenessUpdate(this.awareness, base64ToBytes(payload.update), "pusher-remote")
        if (payload.pusherMemberId && Array.isArray(payload.clientIds)) {
          let clientIds = this.pusherMemberToClientIds.get(payload.pusherMemberId)
          if (!clientIds) {
            clientIds = new Set()
            this.pusherMemberToClientIds.set(payload.pusherMemberId, clientIds)
          }
          for (const id of payload.clientIds) clientIds.add(id)
        }
      }
    )

    // A peer who's already in the room only broadcasts on its own local
    // awareness changes — a newly-joining client has no way to learn about
    // them otherwise, since Pusher doesn't replay past client events to new
    // subscribers. So every already-connected client re-announces its
    // current presence whenever someone new joins.
    this.channel.bind("pusher:member_added", () => {
      if (this.awareness.getLocalState()) {
        this.sendAwarenessUpdate([this.doc.clientID])
      }
    })

    // Presence channels dedupe by user_id, so member_removed only fires once
    // that user's last connection (tab) actually drops — remove whichever
    // Y.Doc client ids we'd previously associated with them so their avatar
    // disappears promptly instead of waiting on the ~30s built-in Awareness
    // staleness GC.
    this.channel.bind("pusher:member_removed", (member: { id: string }) => {
      const clientIds = this.pusherMemberToClientIds.get(member.id)
      this.pusherMemberToClientIds.delete(member.id)
      if (clientIds && clientIds.size > 0) {
        awarenessProtocol.removeAwarenessStates(this.awareness, Array.from(clientIds), "pusher-member-removed")
      }
    })

    this.doc.on("update", this.handleDocUpdate)
    this.awareness.on("update", this.handleAwarenessUpdate)
  }

  // Best-effort catch-up after a reconnect: ask an existing peer for their
  // full current state and merge it in. Multiple peers may all respond to
  // the same broadcast request — only the first response is applied, the
  // rest are harmless no-ops via the unbind below, and Y.applyUpdate is
  // idempotent regardless of how much of it we've already seen.
  private requestResync() {
    let handled = false
    const onResyncResponse = (payload: { update: string }) => {
      if (handled) return
      handled = true
      this.channel.unbind("client-yjs-sync-response", onResyncResponse)
      Y.applyUpdate(this.doc, base64ToBytes(payload.update), "pusher-sync")
    }
    this.channel.bind("client-yjs-sync-response", onResyncResponse)

    const ok = this.channel.trigger("client-yjs-sync-request", {})
    if (!ok) {
      console.error("[PusherYjsProvider] Failed to trigger resync request after reconnect.")
    }

    setTimeout(() => {
      if (handled) return
      handled = true
      this.channel.unbind("client-yjs-sync-response", onResyncResponse)
    }, PEER_SYNC_TIMEOUT_MS)
  }

  private sendAwarenessUpdate(clientIds: number[]) {
    if (this.destroyed || !this.subscribed || clientIds.length === 0) return
    const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, clientIds)
    this.channel.trigger("client-awareness-update", {
      update: bytesToBase64(update),
      clientIds,
      pusherMemberId: this.channel.members.myID,
    })
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
    this.sendAwarenessUpdate(clientIds)
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
