import { NextResponse } from 'next/server'
import { getPublicDoc } from '@/lib/public-doc'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const doc = await getPublicDoc(id)
    // Private and missing docs get the same answer, so a link can't be probed
    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(doc)
  } catch (error) {
    console.error('Failed to fetch public doc:', error)
    return NextResponse.json({ error: 'Failed to fetch doc' }, { status: 500 })
  }
}
