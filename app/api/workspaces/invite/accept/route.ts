import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // Find the invite
    const inviteRows = await sql`
      SELECT * FROM workspace_invites
      WHERE token = ${token}
      AND used = false
      AND expires_at > NOW()
    `

    if (inviteRows.length === 0) {
      return NextResponse.json({ error: 'Invite is invalid or has expired' }, { status: 400 })
    }

    const invite = inviteRows[0]

    // Make sure the logged in user's email matches the invite
    if (session.email !== invite.email) {
      return NextResponse.json({ error: 'This invite was sent to a different email address' }, { status: 403 })
    }

    // Update the member row to accepted
    await sql`
      UPDATE workspace_members
      SET status = 'accepted', user_id = ${session.userId}, accepted_at = NOW()
      WHERE workspace_id = ${invite.workspace_id}
      AND email = ${invite.email}
    `

    // Mark the invite as used
    await sql`
      UPDATE workspace_invites
      SET used = true
      WHERE token = ${token}
    `

    return NextResponse.json({ success: true, workspaceId: invite.workspace_id })
  } catch (error) {
    console.error('Accept invite error:', error)
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
  }
}
