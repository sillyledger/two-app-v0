import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'
import Pusher from 'pusher'

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const body = await request.json()
    const result = await sql`
      UPDATE content_ideas SET
        title = COALESCE(${body.title ?? null}, title),
        type = COALESCE(${body.type ?? null}, type),
        status = COALESCE(${body.status ?? null}, status),
        platform = COALESCE(${body.platform ?? null}, platform),
        category = COALESCE(${body.category ?? null}, category),
        doc_uuid = COALESCE(${body.doc_uuid ?? null}, doc_uuid),
        updated_at = now()
      WHERE uuid = ${id} AND user_id = ${payload.userId}
      RETURNING *
    `
    if (!result[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (body.title !== undefined && result[0].doc_uuid) {
      await sql`
        UPDATE docs
        SET title = ${body.title.trim()}, updated_at = CURRENT_TIMESTAMP
        WHERE uuid = ${result[0].doc_uuid} AND user_id = ${payload.userId}
      `
      try {
        await pusher.trigger(`doc-${result[0].doc_uuid}`, 'updated', {})
      } catch (pusherError) {
        console.error('Pusher notification failed (save itself succeeded):', pusherError)
      }
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to update content idea:', error)
    return NextResponse.json({ error: 'Failed to update content idea' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    await sql`DELETE FROM content_ideas WHERE uuid = ${id} AND user_id = ${payload.userId}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete content idea:', error)
    return NextResponse.json({ error: 'Failed to delete content idea' }, { status: 500 })
  }
}
