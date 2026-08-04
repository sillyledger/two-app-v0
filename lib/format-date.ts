const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function parseOffsetHours(tz: string): number {
  const m = tz.match(/UTC([+-])(\d+)(?::(\d+))?/)
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  const hours = parseInt(m[2], 10)
  const mins = m[3] ? parseInt(m[3], 10) : 0
  return sign * (hours + mins / 60)
}

export function toUserTime(input: string | Date, timezone: string): Date {
  const date = typeof input === 'string' ? new Date(input) : input
  const offsetHours = parseOffsetHours(timezone || 'UTC+0')
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000
  return new Date(utcMs + offsetHours * 3600000)
}

export function formatDate(input: string | Date, dateFormat: string, timezone: string): string {
  const d = toUserTime(input, timezone)
  const day = d.getDate()
  const month = d.getMonth()
  const year = d.getFullYear()
  const pad = (n: number) => String(n).padStart(2, '0')

  switch (dateFormat) {
    case 'DD/MM/YYYY': return `${pad(day)}/${pad(month + 1)}/${year}`
    case 'MM/DD/YYYY': return `${pad(month + 1)}/${pad(day)}/${year}`
    case 'YYYY-MM-DD': return `${year}-${pad(month + 1)}-${pad(day)}`
    case 'MMM D, YYYY':
    default: return `${MONTHS[month]} ${day}, ${year}`
  }
}

export function formatDayHeader(input: string | Date, timezone: string): string {
  const d = toUserTime(input, timezone)
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function dayKey(input: string | Date, timezone: string): string {
  const d = toUserTime(input, timezone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function getUserDatePrefs(): { timezone: string; dateFormat: string } {
  if (typeof window === 'undefined') return { timezone: 'UTC+0', dateFormat: 'MMM D, YYYY' }
  return {
    timezone: localStorage.getItem('timezone') || 'UTC+0',
    dateFormat: localStorage.getItem('date-format') || 'MMM D, YYYY',
  }
}
