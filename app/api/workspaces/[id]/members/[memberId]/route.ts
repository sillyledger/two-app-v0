import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'
import { isWorkspaceOwner, getUserRoleInWorkspace } from '@/lib/workspaces'

const MANAGEABLE_ROLES = ['editor', 'commenter', 'viewer']

async function authorizeMemberAction(userId: string, workspaceId: string, memberId: string) {
  const memberRows = await sql`
    SELECT * FROM workspace_members WHERE id::text = ${memberId} AND workspace_id::text = ${workspaceId}
  `
  const member = memberRows[0]
  if (!member) return { error: 'Member not found', status: 404 as const }

  const workspaceRows = await sql`SELECT user_id FROM workspaces WHERE id::text = ${workspaceId}`
  const ownerId = workspaceRows[0]?.user_id
  if (member.user_id && member.user_id === ownerId) {
    return { error: 'Cannot manage the workspace owner', status: 403 as const }
  }

  const owner = await isWorkspaceOwner(userId, workspaceId)
  if (owner) return { member, isOwner: true as const }

  const role = await getUserRoleInWorkspace(userId, workspaceId)
  if (role === 'admin') {
    if (!MANAGEABLE_ROLES.includes(member.role)) {
      return { error: 'Admins cannot manage other admins', status: 403 as const }
    }
    return { member, isOwner: false as const }
  }

  return { error: 'Not authorized', status: 403 as const }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: workspaceId, memberId } = await params
    const result = await authorizeMemberAction(payload.userId, workspaceId, memberId)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    await sql`DELETE FROM workspace_members WHERE id::text = ${memberId}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove member error:', error)
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: workspaceId, memberId } = await params
    const { role } = await request.json()
    const validRoles = ['admin', 'editor', 'commenter', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const result = await authorizeMemberAction(payload.userId, workspaceId, memberId)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    if (!result.isOwner && role === 'admin') {
      return NextResponse.json({ error: 'Only the workspace owner can grant admin' }, { status: 403 })
    }

    const updated = await sql`
      UPDATE workspace_members SET role = ${role} WHERE id::text = ${memberId} RETURNING *
    `
    return NextResponse.json(updated[0])
  } catch (error) {
    console.error('Update member role error:', error)
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }
}
