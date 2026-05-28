import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { getAllWorkspaces, createWorkspace } from '@/lib/workspaces'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json(null, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json(null, { status: 401 })

    const workspaces = await getAllWorkspaces(payload.userId)
    return NextResponse.json(workspaces)
  } catch (error) {
    console.error('Workspaces fetch error:', error)
    return NextResponse.json(null, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json(null, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json(null, { status: 401 })

    const { name } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    // Check plan and enforce workspace limit for free users
    const userRows = await sql`SELECT plan FROM users WHERE id = ${payload.userId}`
    const plan = userRows[0]?.plan || 'free'

    if (plan === 'free') {
      const existing = await getAllWorkspaces(payload.userId)
      if (existing.length >= 1) {
        return NextResponse.json(
          { error: 'Free plan is limited to 1 workspace. Upgrade to Pro for unlimited workspaces.' },
          { status: 403 }
        )
      }
    }

    const workspace = await createWorkspace(payload.userId, name.trim())
    return NextResponse.json(workspace, { status: 201 })
  } catch (error) {
    console.error('Workspace create error:', error)
    return NextResponse.json(null, { status: 500 })
  }
}
