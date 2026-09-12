import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { sql } from '@/lib/db'
import { isWorkspaceOwner, getUserRoleInWorkspace } from '@/lib/workspaces'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get('folder_id')
  const workspaceId = searchParams.get('workspace_id')

  try {
    if (folderId) {
      const folderRows = await sql`SELECT workspace_id FROM folders WHERE id::text = ${folderId}`
      const folderWorkspaceId = folderRows[0]?.workspace_id ?? null

      if (folderWorkspaceId) {
        const accessCheck = await sql`
          SELECT 1 FROM workspaces WHERE id::text = ${folderWorkspaceId} AND user_id = ${payload.userId}
          UNION
          SELECT 1 FROM workspace_members
          WHERE workspace_id::text = ${folderWorkspaceId}
            AND user_id = ${payload.userId}
            AND status = 'accepted'
        `
        if (accessCheck.length === 0) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const docs = await sql`
          SELECT docs.*, users.name AS author_name, users.email AS author_email,
                 folders.name AS folder_name, workspaces.is_shared AS is_workspace_shared
          FROM docs
          LEFT JOIN users ON docs.user_id = users.id
          LEFT JOIN folders ON docs.folder_id::text = folders.id::text
          LEFT JOIN workspaces ON docs.workspace_id::text = workspaces.id::text
          WHERE docs.folder_id = ${folderId}
            AND docs.deleted_at IS NULL
          ORDER BY docs.created_at DESC
        `
        return NextResponse.json(docs)
      }

      const docs = await sql`
        SELECT docs.*, users.name AS author_name, users.email AS author_email,
               folders.name AS folder_name, workspaces.is_shared AS is_workspace_shared
        FROM docs
        LEFT JOIN users ON docs.user_id = users.id
        LEFT JOIN folders ON docs.folder_id::text = folders.id::text
        LEFT JOIN workspaces ON docs.workspace_id::text = workspaces.id::text
        WHERE docs.user_id = ${payload.userId}
          AND docs.folder_id = ${folderId}
          AND docs.deleted_at IS NULL
        ORDER BY docs.created_at DESC
      `
      return NextResponse.json(docs)
    }

    if (workspaceId) {
      // Check if user owns this workspace or is an accepted member
      const accessCheck = await sql`
        SELECT 1 FROM workspaces WHERE id::text = ${workspaceId} AND user_id = ${payload.userId}
        UNION
        SELECT 1 FROM workspace_members
        WHERE workspace_id::text = ${workspaceId}
          AND user_id = ${payload.userId}
          AND status = 'accepted'
      `

      if (accessCheck.length === 0) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      // Return all docs in workspace regardless of who created them
      const docs = await sql`
        SELECT docs.*, users.name AS author_name, users.email AS author_email,
               folders.name AS folder_name, workspaces.is_shared AS is_workspace_shared
        FROM docs
        LEFT JOIN users ON docs.user_id = users.id
        LEFT JOIN folders ON docs.folder_id::text = folders.id::text
        LEFT JOIN workspaces ON docs.workspace_id::text = workspaces.id::text
        WHERE docs.workspace_id::text = ${workspaceId}
          AND docs.deleted_at IS NULL
        ORDER BY docs.created_at DESC
      `
      return NextResponse.json(docs)
    }

    // Paginated + searchable mode — opt-in only, used by app/docs/page.tsx.
    // Every other caller of this endpoint (sidebar, folders, workspaces, etc.)
    // never sends `paginated=true` and gets the exact unchanged response below.
    if (searchParams.get('paginated') === 'true') {
      const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '36', 10) || 36, 1), 100)
      const q = (searchParams.get('q') || '').trim()
      const cursor = searchParams.get('cursor')

      let cursorCreatedAt: string | null = null
      let cursorId: string | null = null
      if (cursor) {
        const idx = cursor.lastIndexOf('_')
        if (idx > 0) {
          cursorCreatedAt = cursor.slice(0, idx)
          cursorId = cursor.slice(idx + 1)
        }
      }

      if (q) {
        const docs = await sql`
          SELECT docs.id, docs.uuid, docs.title, docs.preview, docs.created_at,
                 docs.folder_id, docs.is_starred,
                 folders.name AS folder_name, workspaces.is_shared AS is_workspace_shared
          FROM docs
          LEFT JOIN folders ON docs.folder_id::text = folders.id::text
          LEFT JOIN workspaces ON docs.workspace_id::text = workspaces.id::text
          WHERE docs.user_id = ${payload.userId}
            AND docs.deleted_at IS NULL
            AND docs.search_vector @@ plainto_tsquery('english', ${q})
          ORDER BY ts_rank(docs.search_vector, plainto_tsquery('english', ${q})) DESC,
                   docs.created_at DESC, docs.id DESC
          LIMIT ${limit}
        `
        return NextResponse.json({ docs, nextCursor: null })
      }

      const docs = cursorCreatedAt && cursorId
        ? await sql`
            SELECT docs.id, docs.uuid, docs.title, docs.preview, docs.created_at,
                   docs.folder_id, docs.is_starred,
                   folders.name AS folder_name, workspaces.is_shared AS is_workspace_shared
            FROM docs
            LEFT JOIN folders ON docs.folder_id::text = folders.id::text
            LEFT JOIN workspaces ON docs.workspace_id::text = workspaces.id::text
            WHERE docs.user_id = ${payload.userId}
              AND docs.deleted_at IS NULL
              AND (docs.created_at, docs.id) < (${cursorCreatedAt}, ${cursorId})
            ORDER BY docs.created_at DESC, docs.id DESC
            LIMIT ${limit}
          `
        : await sql`
            SELECT docs.id, docs.uuid, docs.title, docs.preview, docs.created_at,
                   docs.folder_id, docs.is_starred,
                   folders.name AS folder_name, workspaces.is_shared AS is_workspace_shared
            FROM docs
            LEFT JOIN folders ON docs.folder_id::text = folders.id::text
            LEFT JOIN workspaces ON docs.workspace_id::text = workspaces.id::text
            WHERE docs.user_id = ${payload.userId}
              AND docs.deleted_at IS NULL
            ORDER BY docs.created_at DESC, docs.id DESC
            LIMIT ${limit}
          `

      const last = docs[docs.length - 1]
      const nextCursor = docs.length === limit && last ? `${last.created_at}_${last.id}` : null
      return NextResponse.json({ docs, nextCursor })
    }

    // Default: return only user's own docs
    const docs = await sql`
      SELECT docs.*, users.name AS author_name, users.email AS author_email,
             folders.name AS folder_name, workspaces.is_shared AS is_workspace_shared
      FROM docs
      LEFT JOIN users ON docs.user_id = users.id
      LEFT JOIN folders ON docs.folder_id::text = folders.id::text
      LEFT JOIN workspaces ON docs.workspace_id::text = workspaces.id::text
      WHERE docs.user_id = ${payload.userId}
        AND docs.deleted_at IS NULL
      ORDER BY docs.created_at DESC
    `
    return NextResponse.json(docs)

  } catch (error) {
    console.error('Failed to fetch docs:', error)
    return NextResponse.json({ error: 'Failed to fetch docs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token.value)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const userResult = await sql`
      SELECT plan FROM users WHERE id = ${payload.userId}
    `
    const user = userResult[0]
    const plan = user?.plan ?? 'free'

    if (plan === 'free') {
      const countResult = await sql`
        SELECT COUNT(*) AS count FROM docs
        WHERE user_id = ${payload.userId}
          AND deleted_at IS NULL
      `
      const docCount = parseInt(countResult[0].count, 10)
      if (docCount >= 30) {
        return NextResponse.json({ error: 'free_limit_reached' }, { status: 403 })
      }
    }

    const { title, content, color, type = 'doc', folder_id = null, workspace_id = null } = await request.json()

    if (workspace_id) {
      const owner = await isWorkspaceOwner(payload.userId, workspace_id)
      if (!owner) {
        const role = await getUserRoleInWorkspace(payload.userId, workspace_id)
        if (!role || !['admin', 'editor'].includes(role)) {
          return NextResponse.json({ error: 'Not authorized to create docs in this workspace' }, { status: 403 })
        }
      }
    }

    const result = await sql`
      INSERT INTO docs (title, content, content_text, preview, color, type, user_id, folder_id, workspace_id, uuid)
      VALUES (
        ${title},
        ${content},
        strip_html(${content}),
        left(strip_html(${content}), 240),
        ${color},
        ${type},
        ${payload.userId},
        ${folder_id},
        ${workspace_id},
        gen_random_uuid()::TEXT
      )
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create doc:', error)
    return NextResponse.json({ error: 'Failed to create doc' }, { status: 500 })
  }
}
