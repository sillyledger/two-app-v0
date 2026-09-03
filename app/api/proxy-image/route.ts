import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import dns from 'node:dns/promises'
import net from 'node:net'

export const runtime = 'nodejs'

function isPublicIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return false
  const [a, b, c] = parts
  if (a === 0) return false // "this" network
  if (a === 10) return false // private
  if (a === 127) return false // loopback
  if (a === 100 && b >= 64 && b <= 127) return false // carrier-grade NAT
  if (a === 169 && b === 254) return false // link-local, includes 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return false // private
  if (a === 192 && b === 168) return false // private
  if (a === 192 && b === 0 && c === 0) return false // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return false // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return false // benchmarking
  if (a === 198 && b === 51 && c === 100) return false // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false // TEST-NET-3
  if (a >= 224) return false // multicast, reserved, broadcast
  return true
}

function isPublicIp(ip: string): boolean {
  const version = net.isIP(ip)
  if (version === 4) return isPublicIpv4(ip)
  if (version === 6) {
    const normalized = ip.toLowerCase()
    if (normalized === '::1' || normalized === '::') return false // loopback / unspecified
    if (/^fe[89ab][0-9a-f]:/.test(normalized)) return false // link-local fe80::/10
    if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return false // unique local fc00::/7
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPublicIpv4(mapped[1])
    return true
  }
  return false // not a valid IP
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = request.nextUrl.searchParams.get('url')
  if (!url) return new NextResponse('Missing url', { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return new NextResponse('Invalid url', { status: 400 })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new NextResponse('Invalid url', { status: 400 })
  }

  try {
    const addresses = await dns.lookup(parsed.hostname, { all: true })
    if (addresses.length === 0 || !addresses.every(a => isPublicIp(a.address))) {
      return new NextResponse('URL not allowed', { status: 400 })
    }
  } catch {
    return new NextResponse('URL not allowed', { status: 400 })
  }

  try {
    const res = await fetch(url)
    if (!res.ok) return new NextResponse('Failed to fetch image', { status: 502 })

    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'image/jpeg'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    })
  } catch {
    return new NextResponse('Error fetching image', { status: 500 })
  }
}
