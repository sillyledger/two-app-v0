import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { isWorkspaceOwner, getMemberCount } from '@/lib/workspaces'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    const { workspaceId, email, role } = await request.json()

    if (!workspaceId || !email || !role) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const validRoles = ['admin', 'editor', 'commenter', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Only the workspace owner can invite
    const owner = await isWorkspaceOwner(session.userId, workspaceId)
    if (!owner) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Check the inviting user is on Pro plan
    const userRows = await sql`
      SELECT plan FROM users WHERE id = ${session.userId}
    `
    const user = userRows[0]
    if (!user || user.plan !== 'pro') {
      return NextResponse.json({ error: 'Pro plan required to invite members' }, { status: 403 })
    }

    // Free tier: max 2 accepted members
    const memberCount = await getMemberCount(workspaceId)
    if (memberCount >= 2) {
      return NextResponse.json({ error: 'Member limit reached. Upgrade for more seats.' }, { status: 403 })
    }

    // Don't invite someone already in the workspace
    const existing = await sql`
      SELECT id FROM workspace_members
      WHERE workspace_id = ${workspaceId} AND email = ${email}
    `
    if (existing.length > 0) {
      return NextResponse.json({ error: 'This person has already been invited' }, { status: 400 })
    }

    // Create the member row (pending)
    await sql`
      INSERT INTO workspace_members (workspace_id, invited_by, email, role, status)
      VALUES (${workspaceId}, ${session.userId}, ${email}, ${role}, 'pending')
    `

    // Create the invite token
    const token = crypto.randomBytes(32).toString('hex')
    await sql`
      INSERT INTO workspace_invites (workspace_id, email, token, role)
      VALUES (${workspaceId}, ${email}, ${token}, ${role})
    `

    // Get workspace name for the email
    const workspaceRows = await sql`
      SELECT name FROM workspaces WHERE id = ${workspaceId}
    `
    const workspaceName = workspaceRows[0]?.name ?? 'a workspace'

    // Send invite email
    const acceptUrl = `${process.env.APP_URL}/accept-invite?token=${token}`
    await resend.emails.send({
      from: 'TWO <noreply@two.so>',
      to: email,
      subject: `You've been invited to ${workspaceName} on TWO`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px;">You've been invited</h1>
          <p style="font-size: 15px; color: #555; margin-bottom: 32px;">You've been invited to join <strong>${workspaceName}</strong> on TWO as a <strong>${role}</strong>.</p>
          <a href="${acceptUrl}" style="display: inline-block; background: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Accept invite</a>
          <p style="font-size: 13px; color: #999; margin-top: 32px;">This invite expires in 7 days. If you weren't expecting this, you can safely ignore it.</p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
  }
}
