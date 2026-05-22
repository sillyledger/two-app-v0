import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const docs = await sql`
    SELECT id, uuid, title, updated_at, created_at
    FROM docs
    WHERE updated_at >= ${thirtyDaysAgo.toISOString()}
      AND user_id = ${session.userId}
      AND deleted_at IS NULL
    ORDER BY updated_at DESC
  `

  return NextResponse.json(docs)
}
