import PusherJS, { type PresenceChannel } from "pusher-js"
import * as Y from "yjs"
import * as awarenessProtocol from "y-protocols/awareness"

const DOC_UPDATE_INTERVAL_MS = 100
const AWARENESS_UPDATE_INTERVAL_MS = 200
// How long to wait for an existing peer to answer a sync request before
// giving up and treating the room as effectively empty (caller then decides
// whether to seed from the DB). Short on purpose — the caller shows a
// read-only view of the DB content while this is pending, so there's no
// reason to make the user wait long for it.
const PEER_SYNC_TIMEOUT_MS = 1500
// Absolute ceiling from construction for the presence channel subscription
// itself to succeed at all (bad/missing Pusher env vars, auth endpoint
// failing, network issues, etc). If this fires, Pusher isn't working this
// session at all — resolves 'failed', not 'ready'.
const HARD_SYNC_CEILING_MS = 3000

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
}

/** How the initial connection attempt resolved. */
export type SyncOutcome =
  | "ready" // Subscribed (alone, peer responded, or peer-sync timed out) — the
  // Y.Doc may still be empty at this point; the caller checks and seeds
  // from the DB directly (not via this class) if so.
  | "failed" // Pusher never worked this session (connection/subscription error,
  // or the subscription never completed within the hard ceiling) — the
  // caller should not use Yjs/Collaboration at all for this session.

/**
 * Custom Yjs transport over a Pusher presence channel.
 * There's no persistent Yjs server here — Pusher just relays messages between
 * currently-connected clients — so a newly joining client must either find
 * out it's alone (and let the caller seed from the DB) or pull the live
 * document state from an existing peer, rather than ever seeding
 * independently through this class. Seeding is a caller-side concern
 * entirely: writing HTML into an empty Y.XmlFragment must happen through
 * Yjs's own conversion utilities (prosemirrorJSONToYXmlFragment), not
 * through a live editor — a live editor bound to both `content` and the
 * Collaboration extension at once can't reliably seed an empty fragment,
 * since the sync plugin force-rerenders the view from the (still empty)
 * fragment on mount before any write-back can happen. This class only ever
 * hands back a Y.Doc that's either already synced with a peer or is known
 * to be safe to seed — never one it seeded itself.
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
  private consecutiveFlushFailures = 0
  private pendingAwarenessClients: Set<number> = new Set()
  private awarenessTimer: ReturnType<typeof setTimeout> | null = null

  // Presence channels dedupe by user_id — one logged-in user with two tabs
  // open is a single Pusher member but two separate Y.Doc/awareness client
  // ids, so this maps one-to-many when reconciling member_removed.
  private pusherMemberToClientIds = new Map<string, Set<number>>()

  /** Resolves once the initial connection attempt has settled one way or the other. */
  public readonly synced: Promise<SyncOutcome>
  private resolveSynced!: (outcome: SyncOutcome) => void

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

  constructor({ docId, doc, awareness }: PusherYjsProviderOptions) {
    this.docId = docId
    this.doc = doc
    this.awareness = awareness

    // Guards every path below (peer sync, peer timeout, subscription failure,
    // hard ceiling) so the promise settles exactly once no matter which one
    // wins the race.
    let settled = false
    let peerSyncTimeout: ReturnType<typeof setTimeout> | null = null

    this.synced = new Promise((resolve) => {
      this.resolveSynced = resolve
    })

    const settle = (outcome: SyncOutcome, reason: string) => {
      if (settled) return
      settled = true
      if (peerSyncTimeout) clearTimeout(peerSyncTimeout)
      clearTimeout(hardCeiling)
      if (outcome === "failed") {
        console.error(`[PusherYjsProvider] doc=${this.docId} giving up on Yjs (${reason}) — falling back to plain content/autosave.`)
      } else {
        console.log(`[PusherYjsProvider] doc=${this.docId} ready (${reason})`)
      }
      this.resolveSynced(outcome)
    }

    // Absolute last resort: if the subscription hasn't even succeeded within
    // this window (auth endpoint down, missing/misconfigured Pusher env
    // vars, network issues), Pusher isn't working this session — resolve
    // 'failed' rather than leaving the caller waiting indefinitely.
    const hardCeiling = setTimeout(() => settle("failed", "subscription never completed in time"), HARD_SYNC_CEILING_MS)

    this.pusher = new PusherJS(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher-auth",
    })

    this.pusher.connection.bind("error", (err: unknown) => {
      console.error("[PusherYjsProvider] Pusher connection error:", err)
      settle("failed", "pusher connection error")
    })

    this.channel = this.pusher.subscribe(`presence-doc-${docId}`) as PresenceChannel

    this.channel.bind("pusher:subscription_error", (err: unknown) => {
      console.error("[PusherYjsProvider] Presence channel subscription failed:", err)
      settle("failed", "subscription_error")
    })

    this.channel.bind("pusher:subscription_succeeded", (members: { count: number }) => {
      const isReconnect = settled
      this.subscribed = true

      if (isReconnect) {
        // We already resolved once (ready or failed) — this is a later
        // resubscribe. Only meaningful if we're actually using Yjs; a real
        // Yjs update here is safe/idempotent regardless of what we already
        // have, unlike seeding.
        if (members.count > 1) this.requestResync()
        return
      }

      if (members.count <= 1) {
        settle("ready", "alone in room")
        return
      }

      const onSyncResponse = (payload: { update: string }) => {
        if (settled) return
        this.channel.unbind("client-yjs-sync-response", onSyncResponse)
        if (peerSyncTimeout) clearTimeout(peerSyncTimeout)
        Y.applyUpdate(this.doc, base64ToBytes(payload.update), "pusher-sync")
        settle("ready", "peer responded")
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
        // Nobody answered in time — resolve 'ready' anyway; the caller
        // checks whether the Y.Doc ended up empty and seeds from the DB if
        // so, rather than waiting any longer for a peer.
        settle("ready", "no peer responded to sync request")
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
    const ok = this.channel.trigger("client-yjs-update", { update: bytesToBase64(merged) })

    if (!ok) {
      // Pusher client events are capped at ~10KB and silently refuse to send
      // over that (or when rate-limited) — trigger() just returns false with
      // no error. Left unhandled, this client keeps its own (correct) local
      // state while every peer silently falls behind it, which is exactly
      // the kind of quiet divergence that later shows up as "content
      // disappeared" when a peer saves its now-stale view. Requeue and retry
      // a few times in case this was transient (rate limit); if it keeps
      // failing it's almost certainly a hard size cap we can't clear by
      // retrying, so give up loudly rather than looping forever.
      this.consecutiveFlushFailures++
      console.error(
        `[PusherYjsProvider] doc=${this.docId} FAILED to send Yjs update ` +
        `(~${merged.byteLength} bytes, attempt ${this.consecutiveFlushFailures}) — ` +
        `Pusher rejected the trigger (likely exceeds the 10KB client-event limit, ` +
        `or rate-limited). Peers may now be missing this change.`
      )
      if (this.consecutiveFlushFailures <= 5) {
        this.pendingDocUpdates.unshift(merged)
        this.docUpdateTimer = setTimeout(() => this.flushDocUpdates(), DOC_UPDATE_INTERVAL_MS * 4)
      } else {
        console.error(
          `[PusherYjsProvider] doc=${this.docId} giving up on this update after ` +
          `${this.consecutiveFlushFailures} failed attempts — this client's own content is fine, ` +
          `but peers will stay out of sync with it until they reload or another update reconciles them.`
        )
        this.consecutiveFlushFailures = 0
      }
      return
    }
    this.consecutiveFlushFailures = 0
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
