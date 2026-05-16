import { neon } from '@neondatabase/serverless'

export const sql = neon(process.env.DATABASE_URL!)

export interface Note {
  id: number
  title: string
  content: string | null
  color: string
  is_starred: boolean
  created_at: string
  updated_at: string
}
