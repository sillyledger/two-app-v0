import { sql } from '@/lib/db'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupByDay(docs: any[]) {
  const groups: Record<string, any[]> = {}
  for (const doc of docs) {
    const date = new Date(doc.updated_at)
    const key = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(doc)
  }
  return groups
}

export default async function ActivityPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const docs = await sql`
    SELECT id, uuid, title, content, updated_at, created_at
    FROM docs
    WHERE updated_at >= ${thirtyDaysAgo.toISOString()}
    ORDER BY updated_at DESC
  `

  const grouped = groupByDay(docs)
  const days = Object.keys(grouped)

  return (
    <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Activity</h1>
        <p className="text-sm text-neutral-500 mt-1">Everything you've touched in the last 30 days</p>
      </div>

      {days.length === 0 ? (
        <p className="text-neutral-500 text-sm">No activity yet.</p>
      ) : (
        <div className="space-y-8">
          {days.map((day) => (
            <div key={day}>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">{day}</p>
              <div className="space-y-1">
                {grouped[day].map((doc: any) => {
                  const isNew =
                    Math.abs(new Date(doc.updated_at).getTime() - new Date(doc.created_at).getTime()) < 5000
                  return (
                    <Link
                      key={doc.uuid}
                      href={`/docs/${doc.uuid}`}
                      className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-neutral-800 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs w-14 shrink-0">
                          {isNew ? (
                            <span className="text-emerald-500 font-medium">created</span>
                          ) : (
                            <span className="text-neutral-500">edited</span>
                          )}
                        </span>
                        <span className="text-neutral-200 text-sm truncate group-hover:text-white transition-colors">
                          {doc.title || 'Untitled'}
                        </span>
                      </div>
                      <span className="text-neutral-600 text-xs shrink-0 ml-4">
                        {timeAgo(doc.updated_at)}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
