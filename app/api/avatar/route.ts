import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'

const MAX_AVATAR_SIZE = 2 * 1024 * 1024

function getAvatarPath(userId: string, filename: string, contentType: string) {
  const extension = filename.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  const safeExtension = extension || contentType.split('/')[1] || 'jpg'
  return `avatars/${userId}-${Date.now()}.${safeExtension}`
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const filename = searchParams.get('filename') || 'avatar'
  const contentType = searchParams.get('contentType') || request.headers.get('content-type') || ''
  const size = Number(searchParams.get('size') || '0')

  if (!request.body) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }

  if (size > MAX_AVATAR_SIZE) {
    return NextResponse.json({ error: 'Image must be under 2MB' }, { status: 400 })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Avatar storage is not configured.' }, { status: 500 })
  }

  let blob: Awaited<ReturnType<typeof put>>
  try {
    blob = await put(getAvatarPath(payload.userId, filename, contentType), request.body, {
      access: 'public',
      addRandomSuffix: true,
      contentType,
    })
  } catch (error) {
    console.error('Avatar blob upload failed:', error)
    return NextResponse.json({ error: 'Avatar storage upload failed.' }, { status: 500 })
  }

  try {
    await sql`
      UPDATE users SET avatar_url = ${blob.url} WHERE id = ${payload.userId}
    `
  } catch (error) {
    console.error('Avatar database update failed:', error)
    return NextResponse.json({ error: 'Avatar uploaded, but profile update failed.' }, { status: 500 })
  }

  return NextResponse.json({ url: blob.url })
}
