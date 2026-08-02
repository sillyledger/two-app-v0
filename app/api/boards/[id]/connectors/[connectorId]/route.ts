import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; connectorId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { connectorId } = await params

  try {
    const owned = await sql`
      SELECT bc.id FROM board_connectors bc
      JOIN boards b ON b.id = bc.board_id
      WHERE bc.id = ${connectorId} AND b.user_id = ${session.userId}
    `
    if (!owned[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await sql`DELETE FROM board_connectors WHERE id = ${connectorId}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete connector:', error)
    return NextResponse.json({ error: 'Failed to delete connector' }, { status: 500 })
  }
}
