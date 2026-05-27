import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) return new NextResponse('Missing url', { status: 400 })

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
