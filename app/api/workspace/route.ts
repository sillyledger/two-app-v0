import { NextResponse } from 'next/server'
import { getOrCreateWorkspace } from '@/lib/workspaces'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

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
