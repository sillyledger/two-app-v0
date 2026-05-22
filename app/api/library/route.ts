import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch all labels for this user
  const labels = await sql`
    SELECT l.id, l.name, l.color
    FROM labels l
    WHERE l.user_id = ${payload.userId}
    ORDER BY l.name ASC
  `

  // Fetch all docs with their labels for this user
  const docs = await sql`
    SELECT
      d.id, d.uuid, d.title, d.updated_at, d.created_at,
      COALESCE(
        json_agg(
          json_build_object('id', l.id, 'name', l.name, 'color', l.color)
        ) FILTER (WHERE l.id IS NOT NULL),
        '[]'
      ) AS labels
    FROM docs d
    LEFT JOIN doc_labels dl ON dl.doc_id = d.id
    LEFT JOIN labels l ON l.id = dl.label_id
    WHERE d.user_id = ${payload.userId}
      AND d.deleted_at IS NULL
    GROUP BY d.id
    ORDER BY d.updated_at DESC
  `

  return NextResponse.json({ labels, docs })
}
