'use client'

import { useEffect, useState } from 'react'
import Editor from '@/components/editor'
import { formatDate, getUserDatePrefs } from '@/lib/format-date'

const DEFAULT_PREFS = { timezone: 'UTC+0', dateFormat: 'MMM D, YYYY' }

// Same format as the created date on the app's doc page: defaults on the
// server, the viewer's own date preferences once mounted
export function UpdatedDate({ value }: { value: string }) {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  useEffect(() => { setPrefs(getUserDatePrefs()) }, [])

  const date = new Date(value)
  if (isNaN(date.getTime())) return null
  return <>Updated {formatDate(date, prefs.dateFormat, prefs.timezone)}</>
}

export function PublicDocContent({ content }: { content: string }) {
  return <Editor content={content} editable={false} onChange={() => {}} />
}
