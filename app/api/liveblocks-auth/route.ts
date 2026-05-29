import { Liveblocks } from "@liveblocks/node"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
})

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { room } = await request.json()
  if (!room) {
    return NextResponse.json({ error: "Room required" }, { status: 400 })
  }

  // Verify the user has access to this doc
  const docId = room // room ID is the doc UUID

  const ownResult = await sql`
    SELECT docs.id FROM docs
    WHERE docs.uuid = ${docId} AND docs.user_id = ${session.userId} AND docs.deleted_at IS NULL
  `

  const sharedResult = await sql`
    SELECT docs.id FROM docs
    INNER JOIN workspace_members wm ON wm.workspace_id::text = docs.workspace_id::text
    WHERE docs.uuid = ${docId}
      AND docs.deleted_at IS NULL
      AND wm.user_id = ${session.userId}
      AND wm.status = 'accepted'
  `

  const ownerResult = await sql`
    SELECT docs.id FROM docs
    INNER JOIN workspaces w ON w.id::text = docs.workspace_id::text
    WHERE docs.uuid = ${docId}
      AND docs.deleted_at IS NULL
      AND w.user_id = ${session.userId}
  `

  if (ownResult.length === 0 && sharedResult.length === 0 && ownerResult.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  // Get user info for presence
  const userRows = await sql`
    SELECT email, name FROM users WHERE id = ${session.userId}
  `
  const user = userRows[0]
  const name = user?.name || user?.email?.split("@")[0] || "Anonymous"

  const liveblocksSession = liveblocks.prepareSession(session.userId, {
    userInfo: { name },
  })

  liveblocksSession.allow(docId, liveblocksSession.FULL_ACCESS)

  const { body, status } = await liveblocksSession.authorize()
  return new Response(body, { status })
}
