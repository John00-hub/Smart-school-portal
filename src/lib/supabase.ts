import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client.
 *
 * The client is created LAZILY, on first use, rather than at import time.
 * Two reasons:
 *   1. In demo mode (no env vars) the SDK is never instantiated at all, so a
 *      missing/invalid URL cannot break the app.
 *   2. Importing this module has no side effects, which keeps the module graph
 *      side-effect free and testable.
 *
 * Credentials come from Vite env vars. Only the ANON key belongs here — it is
 * safe in frontend code because Row Level Security decides what it may touch.
 * The service_role key must never appear in this project.
 */

const supabaseUrl: string = (import.meta.env?.VITE_SUPABASE_URL as string) || ''
const supabaseAnonKey: string = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || ''

/** True when both env vars are present and the URL looks like a Supabase host. */
export const isSupabaseConfigured = (): boolean =>
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  supabaseUrl.startsWith('http')

/** Returns the singleton client, creating it on first call.
 *  Throws if Supabase is not configured — callers must check first. */
let _client: SupabaseClient | null = null
export const getSupabase = (): SupabaseClient => {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
      'in your .env file, then restart the dev server. See SETUP.md.'
    )
  }
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  }
  return _client
}

/** Convenience accessor for code paths that have already verified configuration. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop]
  },
})

export const supabaseUrlForDebug = () => supabaseUrl

// ────────────────────────────────────────────────────────────────────────────
// Shared types
// ────────────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'teacher' | 'parent' | 'student'

export interface Profile {
  id: string
  email: string
  role: UserRole
  full_name: string
  avatar_url?: string
  created_at?: string
}

export interface Student {
  id: string
  profile_id?: string
  admission_no: string
  full_name: string
  email?: string
  class_id: string
  parent_id?: string
  date_of_birth?: string
  gender?: string
  address?: string
  phone?: string
  created_at?: string
}

export interface Teacher {
  id: string
  profile_id?: string
  employee_no: string
  full_name: string
  email: string
  phone?: string
  qualification?: string
  department?: string
  created_at?: string
}

export interface Class {
  id: string
  name: string
  section?: string
  class_teacher_id?: string
  academic_session: string
  capacity?: number
  created_at?: string
}

export interface Announcement {
  id: string
  title: string
  content: string
  author_id: string
  target_role: 'all' | 'teacher' | 'parent' | 'student'
  created_at: string
}

export interface Result {
  id: string
  student_id: string
  subject: string
  term: string
  session: string
  ca_score: number
  exam_score: number
  total: number
  grade: string
  created_at?: string
}

export interface Attendance {
  id: string
  student_id: string
  class_id: string
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  marked_by: string
}
