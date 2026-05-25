import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json(null, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json(null, { status: 401 })
    const { id } = await params
    const result = await sql`
      SELECT * FROM folders WHERE id::text = ${id}
    `
    if (!result[0]) return NextResponse.json(null, { status: 404 })
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Folder fetch error:', error)
    return NextResponse.json(null, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json(null, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json(null, { status: 401 })
    const { id } = await params
    const { name } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    const result = await sql`
      UPDATE folders SET name = ${name.trim()} WHERE id::text = ${id} RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Folder rename error:', error)
    return NextResponse.json(null, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json(null, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json(null, { status: 401 })
    const { id } = await params

    // Move all docs in this folder to trash instead of deleting them
    await sql`
      UPDATE docs
      SET deleted_at = NOW(), folder_id = NULL
      WHERE folder_id::text = ${id}
    `

    // Now delete the folder
    await sql`DELETE FROM folders WHERE id::text = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Folder delete error:', error)
    return NextResponse.json(null, { status: 500 })
  }
}
