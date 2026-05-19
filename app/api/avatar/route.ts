import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'
import { put } from '@vercel/blob'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('avatar') as File
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Only allow images
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }

  // Max 2MB
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image must be under 2MB' }, { status: 400 })
  }

  const blob = await put(`avatars/${payload.userId}-${Date.now()}`, file, {
    access: 'public',
  })

  await sql`
    UPDATE users SET avatar_url = ${blob.url} WHERE id = ${payload.userId}
  `

  return NextResponse.json({ url: blob.url })
}
