import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import Pusher from "pusher"

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const socketId = formData.get("socket_id") as string
  const channelName = formData.get("channel_name") as string
  if (!socketId || !channelName) {
    return NextResponse.json({ error: "socket_id and channel_name required" }, { status: 400 })
  }

  const match = channelName.match(/^presence-doc-(.+)$/)
  if (!match) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }
  const docId = match[1]

  const [ownResult, sharedResult, ownerResult] = await Promise.all([
    sql`
      SELECT docs.id FROM docs
      WHERE docs.uuid = ${docId} AND docs.user_id = ${session.userId} AND docs.deleted_at IS NULL
    `,
    sql`
      SELECT docs.id FROM docs
      INNER JOIN workspace_members wm ON wm.workspace_id::text = docs.workspace_id::text
      WHERE docs.uuid = ${docId}
        AND docs.deleted_at IS NULL
        AND wm.user_id = ${session.userId}
        AND wm.status = 'accepted'
    `,
    sql`
      SELECT docs.id FROM docs
      INNER JOIN workspaces w ON w.id::text = docs.workspace_id::text
      WHERE docs.uuid = ${docId}
        AND docs.deleted_at IS NULL
        AND w.user_id = ${session.userId}
    `,
  ])

  if (ownResult.length === 0 && sharedResult.length === 0 && ownerResult.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const userRows = await sql`
    SELECT email, name FROM users WHERE id = ${session.userId}
  `
  const user = userRows[0]
  const name = user?.name || user?.email?.split("@")[0] || "Anonymous"

  const authResponse = pusher.authorizeChannel(socketId, channelName, {
    user_id: String(session.userId),
    user_info: { name },
  })

  return NextResponse.json(authResponse)
}
