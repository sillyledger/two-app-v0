import { NextResponse } from 'next/server'
import { getOrCreateWorkspace } from '@/lib/workspaces'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json(null, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json(null, { status: 401 })
    const workspace = await getOrCreateWorkspace(payload.userId)
    return NextResponse.json(workspace)
  } catch (error) {
    console.error('Workspace fetch error:', error)
    return NextResponse.json(null, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json(null, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json(null, { status: 401 })

    const { name } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const workspace = await getOrCreateWorkspace(payload.userId)
    const result = await sql`
      UPDATE workspaces
      SET name = ${name.trim()}
      WHERE id = ${workspace.id}
      RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Workspace update error:', error)
    return NextResponse.json(null, { status: 500 })
  }
}
