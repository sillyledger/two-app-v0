// Basic in-memory sliding-window rate limiter.
//
// LIMITATION: state lives in a module-level Map inside this one server
// process. It resets on every redeploy/cold start, and if this app ever
// scales to multiple instances each instance enforces its own limits
// independently (not shared/consistent across instances). That's fine for
// current traffic — revisit with a shared store like Upstash/Redis if
// horizontal scaling or stricter guarantees become necessary.

interface RateLimitResult {
  success: boolean
  remaining: number
}

const hits = new Map<string, number[]>()

// Keys unused for longer than this are dropped so the Map doesn't grow
// unbounded. Generous relative to the windows this is actually used with
// (minutes to a few hours), so it never interferes with real limits.
const MAX_ENTRY_AGE_MS = 24 * 60 * 60 * 1000
const PRUNE_INTERVAL_MS = 5 * 60 * 1000

let lastPrune = Date.now()

function pruneStaleKeys(now: number) {
  for (const [key, timestamps] of hits) {
    const recent = timestamps.filter(ts => now - ts < MAX_ENTRY_AGE_MS)
    if (recent.length === 0) {
      hits.delete(key)
    } else if (recent.length !== timestamps.length) {
      hits.set(key, recent)
    }
  }
  lastPrune = now
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()

  if (now - lastPrune > PRUNE_INTERVAL_MS) {
    pruneStaleKeys(now)
  }

  const windowStart = now - windowMs
  const recent = (hits.get(key) ?? []).filter(ts => ts > windowStart)

  if (recent.length >= limit) {
    hits.set(key, recent)
    return { success: false, remaining: 0 }
  }

  recent.push(now)
  hits.set(key, recent)
  return { success: true, remaining: limit - recent.length }
}

// Best-effort client IP from proxy headers. Falls back to a constant so
// callers still get a (shared) rate-limit bucket instead of throwing.
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}
