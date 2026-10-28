import { NextResponse, type NextRequest } from 'next/server'

const DOC_PATH = /^\/docs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

// Logged-out visitors on a doc link get the public page in place, so the URL
// stays the same and the app layout never renders. Logged-in users go through
// the normal doc page, which hands non-owners over to /p/<uuid> itself.
export function proxy(request: NextRequest) {
  if (request.cookies.has('auth-token')) return NextResponse.next()
  const match = request.nextUrl.pathname.match(DOC_PATH)
  if (!match) return NextResponse.next()
  return NextResponse.rewrite(new URL(`/p/${match[1]}`, request.url))
}

export const config = {
  matcher: '/docs/:id',
}
