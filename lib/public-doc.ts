import { cache } from 'react'
import { sql } from '@/lib/db'

// Everything a visitor to a shared doc gets to see. Nothing about the owner,
// workspace or folder leaves the server.
export interface PublicDoc {
  uuid: string
  title: string
  content: string
  updated_at: string | null
}

export const getPublicDoc = cache(async (id: string): Promise<PublicDoc | null> => {
  const result = await sql`
    SELECT uuid, title, content, updated_at FROM docs
    WHERE uuid = ${id}
      AND deleted_at IS NULL
      AND is_public = true
  `
  if (result.length === 0) return null
  const doc = result[0]
  return {
    uuid: doc.uuid,
    title: doc.title ?? '',
    content: doc.content ?? '',
    updated_at: doc.updated_at ? new Date(doc.updated_at).toISOString() : null,
  }
})
