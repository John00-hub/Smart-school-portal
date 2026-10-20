/**
 * ============================================================================
 * SMARTSCHOOL — SUPABASE DATA LAYER
 * ============================================================================
 *
 * HOW THE BACKEND SWITCH WORKS
 * ----------------------------
 * The app runs in one of two modes, chosen automatically at startup:
 *
 *   DEMO MODE   (default)  – no env vars set. Data lives in localStorage so
 *                            you can click through every screen immediately.
 *
 *   LIVE MODE   (auto)     – VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are
 *                            set. Every READ is hydrated from your real
 *                            Supabase tables on startup, and every WRITE is
 *                            sent to Supabase (write-through), then mirrored
 *                            into the local cache so the UI updates instantly.
 *
 * Reads stay synchronous against the cache; Supabase is the source of truth
 * and the cache is repopulated from it on every app start. Row Level Security
 * enforces what each role can actually see, so the cache can never contain a
 * row the logged-in user was not allowed to read.
 *
 * SECURITY
 * --------
 * Only the anon key is used here. That key is safe in frontend code because
 * RLS decides what it may touch. The service_role key must NEVER be imported
 * into this project — it belongs in server-side scripts or CI only.
 * ============================================================================
 */

import { supabase, isSupabaseConfigured, type Profile, type UserRole } from './supabase'
import { schoolEmail } from './branding'
import type {
  StudentRecord, TeacherRecord, ClassRecord,
  AnnouncementRecord, ResultRecord, AttendanceRecord, TimetableEntry,
} from './store'

export const USE_SUPABASE = isSupabaseConfigured()

// ─────────────────────────────────────────────────────────────────────────────
// Row types as they exist in Postgres (snake_case, joined where useful)
// ─────────────────────────────────────────────────────────────────────────────

interface ClassRow {
  id: string
  name: string
  section: string
  level: string
  capacity: number
  room: string | null
  session_id: string
  academic_sessions?: unknown
  teacher_assignments?: unknown
}

interface StudentRow {
  id: string
  admission_no: string
  full_name: string
  gender: string | null
  date_of_birth: string | null
  address: string | null
  phone: string | null
  profile_id: string | null
  profiles?: unknown
  enrollments?: unknown
}

interface TeacherRow {
  id: string
  employee_no: string
  full_name: string
  qualification: string | null
  department: string | null
  phone: string | null
  profile_id: string | null
  profiles?: unknown
  teacher_assignments?: unknown
}

interface ResultRow {
  id: string
  ca_score: number
  exam_score: number
  total_score: number
  grade: string
  term: string
  students?: unknown
  subjects?: unknown
  academic_sessions?: unknown
}

interface AttendanceRow {
  id: string
  record_date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  student_id: string
  class_id: string
  students?: unknown
}

interface TimetableRow {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
  subjects?: unknown
  teacher_assignments?: unknown
}

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/**
 * PostgREST returns an embedded to-one relation as a plain object in recent
 * versions, but as a single-element array in others. Normalise to one object
 * so the mapping code works against either shape.
 */
function one<T>(v: unknown): T | null {
  if (Array.isArray(v)) return (v[0] as T) ?? null
  return (v as T) ?? null
}

/** Same idea for to-many relations: always an array. */
function many<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[]
  return v ? [v as T] : []
}

function avatarFor(seed: string) {
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(seed)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — Supabase Auth is the only identity source.
// The role is read from profiles.role, which no client can write.
// ─────────────────────────────────────────────────────────────────────────────

export const auth = {
  async signIn(email: string, password: string): Promise<Profile> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(humaniseAuthError(error.message))
    if (!data.user) throw new Error('Sign-in failed: no user returned.')

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id, email, role, full_name, avatar_url')
      .eq('id', data.user.id)
      .maybeSingle()

    if (pErr) throw new Error('Could not load your profile: ' + pErr.message)
    if (!profile) throw new Error('No profile row exists for this account. Ask an administrator.')
    return profile as Profile
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  },

  async session(): Promise<Profile | null> {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, role, full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
    return (profile as Profile) ?? null
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw new Error(error.message)
  },

  /**
   * Public sign-up. Deliberately cannot accept a role: the
   * handle_new_user() trigger always assigns 'student'.
   * Teacher / parent / admin accounts are created by an administrator.
   */
  async signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw new Error(humaniseAuthError(error.message))
    return data
  },
}

function humaniseAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Invalid email or password. Please check your credentials and try again.'
  if (m.includes('email not confirmed')) return 'This email address has not been confirmed yet. Check your inbox.'
  if (m.includes('already registered')) return 'An account with this email already exists. Try signing in.'
  if (m.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.'
  return msg
}

// ─────────────────────────────────────────────────────────────────────────────
// READS — hydrate the UI cache from the real database.
// RLS silently filters these: a parent only ever receives linked children,
// a teacher only classes they manage, a student only their own rows.
// ─────────────────────────────────────────────────────────────────────────────

export const queries = {
  async classes(): Promise<ClassRecord[]> {
    const { data, error } = await supabase
      .from('classes')
      .select(`id, name, section, level, capacity, room, session_id,
               academic_sessions(name),
               teacher_assignments(teacher_profile_id, is_class_teacher)`)
      .order('name')
    if (error) throw new Error('Failed to load classes: ' + error.message)

    // Resolve class-teacher names in one extra round trip.
    const rows = data as unknown as ClassRow[]
    const teacherIds = [...new Set(
      rows.flatMap(c => many<{ teacher_profile_id: string; is_class_teacher: boolean }>(c.teacher_assignments)
        .filter(a => a.is_class_teacher).map(a => a.teacher_profile_id))
    )]
    const teachers = teacherIds.length
      ? (await supabase.from('profiles').select('id, full_name').in('id', teacherIds)).data ?? []
      : []
    const nameById = new Map(teachers.map((t: any) => [t.id, t.full_name]))

    // Enrolment counts
    const { data: enr } = await supabase
      .from('enrollments')
      .select('class_id')
      .eq('is_active', true)
    const counts = new Map<string, number>()
    for (const e of (enr as any[]) ?? []) counts.set(e.class_id, (counts.get(e.class_id) ?? 0) + 1)

    return rows.map(c => {
      const ct = many<{ teacher_profile_id: string; is_class_teacher: boolean }>(c.teacher_assignments)
        .find(a => a.is_class_teacher)
      const teacherId = ct?.teacher_profile_id ?? ''
      return {
        id: c.id,
        name: c.name,
        section: c.section,
        level: c.level,
        capacity: c.capacity,
        teacher_id: teacherId,
        teacher_name: nameById.get(teacherId) ?? 'Unassigned',
        enrolled: counts.get(c.id) ?? 0,
        session: one<{ name: string }>(c.academic_sessions)?.name ?? '',
      }
    })
  },

  async students(classes: ClassRecord[]): Promise<StudentRecord[]> {
    const { data, error } = await supabase
      .from('students')
      .select(`id, admission_no, full_name, gender, date_of_birth, address, phone,
               profile_id, profiles(email),
               enrollments(class_id, classes(id, name, section))`)
      .eq('is_active', true)
      .order('full_name')
    if (error) throw new Error('Failed to load students: ' + error.message)

    const classById = new Map(classes.map(c => [c.id, c]))
    // Parent link per student profile
    const { data: links } = await supabase
      .from('parent_student_links')
      .select('student_profile_id, parent_profile_id')
      .eq('is_active', true)
    const parentByStudent = new Map<string, string>()
    for (const l of (links as any[]) ?? []) parentByStudent.set(l.student_profile_id, l.parent_profile_id)

    return (data as unknown as StudentRow[]).map(s => {
      const enr = many<{ class_id: string; classes: unknown }>(s.enrollments)[0]
      const enrClass = one<{ id: string; name: string; section: string }>(enr?.classes)
      const cls = enrClass ? classById.get(enrClass.id) : undefined
      return {
        id: s.id,
        admission_no: s.admission_no,
        full_name: s.full_name,
        email: one<{ email: string }>(s.profiles)?.email ?? schoolEmail(s.admission_no),
        class_id: enr?.class_id ?? '',
        class_name: enrClass ? `${enrClass.name} ${enrClass.section}` : (cls?.name ?? 'Unassigned'),
        parent_id: (s.profile_id && parentByStudent.get(s.profile_id)) || '',
        gender: s.gender ?? '',
        dob: s.date_of_birth ?? '',
        address: s.address ?? '',
        phone: s.phone ?? '',
        avatar: avatarFor(s.id),
      }
    })
  },

  async teachers(): Promise<TeacherRecord[]> {
    const { data, error } = await supabase
      .from('teachers')
      .select(`id, employee_no, full_name, qualification, department, phone, profile_id,
               profiles(email), teacher_assignments(class_id)`)
      .eq('is_active', true)
      .order('full_name')
    if (error) throw new Error('Failed to load teachers: ' + error.message)

    return (data as unknown as TeacherRow[]).map(t => ({
      id: t.profile_id ?? t.id,
      employee_no: t.employee_no,
      full_name: t.full_name,
      email: one<{ email: string }>(t.profiles)?.email ?? '',
      phone: t.phone ?? '',
      qualification: t.qualification ?? '',
      department: t.department ?? '',
      avatar: avatarFor(t.profile_id ?? t.id),
      class_ids: many<{ class_id: string }>(t.teacher_assignments).map(a => a.class_id),
    }))
  },

  async results(): Promise<ResultRecord[]> {
    const { data, error } = await supabase
      .from('results')
      .select(`id, term, ca_score, exam_score, total_score, grade,
               students(id, full_name), subjects(name), academic_sessions(name)`)
      .order('created_at', { ascending: false })
    if (error) throw new Error('Failed to load results: ' + error.message)

    return (data as unknown as ResultRow[]).map(r => ({
      id: r.id,
      student_id: one<{ id: string }>(r.students)?.id ?? '',
      student_name: one<{ full_name: string }>(r.students)?.full_name ?? '',
      subject: one<{ name: string }>(r.subjects)?.name ?? '',
      term: r.term,
      session: one<{ name: string }>(r.academic_sessions)?.name ?? '',
      ca_score: Number(r.ca_score),
      exam_score: Number(r.exam_score),
      total: Number(r.total_score),
      grade: r.grade,
    }))
  },

  async attendance(): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase
      .from('attendance')
      .select('id, record_date, status, student_id, class_id, students(full_name)')
      .order('record_date', { ascending: false })
      .limit(500)
    if (error) throw new Error('Failed to load attendance: ' + error.message)

    return (data as unknown as AttendanceRow[]).map(a => ({
      id: a.id,
      student_id: a.student_id,
      student_name: one<{ full_name: string }>(a.students)?.full_name ?? '',
      class_id: a.class_id,
      date: a.record_date,
      // 'excused' is a DB-level status the UI renders alongside the other three
      status: (a.status === 'excused' ? 'absent' : a.status) as AttendanceRecord['status'],
    }))
  },

  async announcements(): Promise<AnnouncementRecord[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, content, audience, is_pinned, published_at, author_id, profiles(full_name)')
      .order('published_at', { ascending: false })
    if (error) throw new Error('Failed to load announcements: ' + error.message)

    return (data as any[]).map(a => ({
      id: a.id,
      title: a.title,
      content: a.content,
      author: one<{ full_name: string }>(a.profiles)?.full_name ?? 'Administration',
      target: a.audience,
      date: (a.published_at ?? '').slice(0, 10),
      pinned: a.is_pinned,
    }))
  },

  async timetable(classId: string): Promise<TimetableEntry[]> {
    const { data, error } = await supabase
      .from('timetables')
      .select('day_of_week, start_time, end_time, room, subjects(name)')
      .eq('class_id', classId)
      .order('day_of_week')
      .order('start_time')
    if (error) throw new Error('Failed to load timetable: ' + error.message)

    return (data as unknown as TimetableRow[]).map(t => ({
      day: DAYS[t.day_of_week] ?? '',
      time: `${t.start_time.slice(0, 5)} - ${t.end_time.slice(0, 5)}`,
      subject: one<{ name: string }>(t.subjects)?.name ?? '',
      teacher: '',
      room: t.room ?? '',
    }))
  },

  async profiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, full_name, avatar_url')
      .eq('is_active', true)
    if (error) throw new Error('Failed to load profiles: ' + error.message)
    return (data ?? []) as Profile[]
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITES — every mutation goes to Supabase first. If it fails, the caller
// gets the error and the cache is left untouched, so the UI never shows a
// success state for an operation the database rejected.
// ─────────────────────────────────────────────────────────────────────────────

export const mutations = {
  // ── Students ────────────────────────────────────────────────────────────
  async createStudent(input: {
    admissionNo: string; fullName: string; gender: string; dob: string
    address: string; phone: string; classId: string; academicYear: string
    parentProfileId?: string
  }) {
    const { data, error } = await supabase
      .from('students')
      .insert({
        admission_no: input.admissionNo,
        full_name: input.fullName,
        gender: input.gender || null,
        date_of_birth: input.dob || null,
        address: input.address || null,
        phone: input.phone || null,
      })
      .select()
      .single()
    if (error) throw new Error(describe(error, 'register this student'))
    const studentId = (data as any).id as string

    // Enrol — the DB trigger rejects this if the class is full.
    const { error: eErr } = await supabase
      .from('enrollments')
      .insert({ student_id: studentId, class_id: input.classId, academic_year: input.academicYear })
    if (eErr) throw new Error(describe(eErr, 'enrol this student'))

    return studentId
  },

  async updateStudent(id: string, patch: Partial<{
    admission_no: string; full_name: string; gender: string
    date_of_birth: string; address: string; phone: string
  }>) {
    const { error } = await supabase.from('students').update(patch).eq('id', id)
    if (error) throw new Error(describe(error, 'update this student'))
  },

  /** Move a student to a different class (deactivates the old enrolment). */
  async reassignStudentClass(studentId: string, newClassId: string, academicYear: string) {
    const { error: deact } = await supabase
      .from('enrollments')
      .update({ is_active: false })
      .eq('student_id', studentId)
      .eq('is_active', true)
    if (deact) throw new Error(describe(deact, 'release the previous enrolment'))

    const { error } = await supabase
      .from('enrollments')
      .insert({ student_id: studentId, class_id: newClassId, academic_year: academicYear })
    if (error) throw new Error(describe(error, 'enrol the student in the new class'))
  },

  async deleteStudent(id: string) {
    const { error } = await supabase.from('students').delete().eq('id', id)
    if (error) throw new Error(describe(error, 'delete this student'))
  },

  // ── Classes ─────────────────────────────────────────────────────────────
  async createClass(input: { name: string; section: string; level: string; capacity: number; sessionId: string; room?: string }) {
    const { data, error } = await supabase
      .from('classes')
      .insert({
        name: input.name,
        section: input.section,
        level: input.level,
        capacity: input.capacity,
        session_id: input.sessionId,
        room: input.room ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(describe(error, 'create this class'))
    return (data as any).id as string
  },

  async updateClass(id: string, patch: Partial<{ name: string; section: string; level: string; capacity: number; room: string }>) {
    const { error } = await supabase.from('classes').update(patch).eq('id', id)
    if (error) throw new Error(describe(error, 'update this class'))
  },

  async deleteClass(id: string) {
    const { error } = await supabase.from('classes').delete().eq('id', id)
    if (error) throw new Error(describe(error, 'delete this class'))
  },

  // ── Teacher assignments ─────────────────────────────────────────────────
  async assignTeacher(teacherProfileId: string, classId: string, opts: { subjectId?: string; isClassTeacher?: boolean } = {}) {
    const { error } = await supabase.rpc('admin_assign_teacher', {
      p_teacher_profile_id: teacherProfileId,
      p_class_id: classId,
      p_subject_id: opts.subjectId ?? null,
      p_is_class_teacher: opts.isClassTeacher ?? true,
    })
    if (error) throw new Error(describe(error, 'assign this teacher'))
  },

  // ── Accounts & families (admin only — enforced server-side) ─────────────
  async createAccount(input: {
    email: string; password: string; fullName: string
    role: UserRole; phone?: string; meta?: Record<string, unknown>
  }) {
    const { data, error } = await supabase.rpc('admin_create_account', {
      p_email: input.email,
      p_password: input.password,
      p_full_name: input.fullName,
      p_role: input.role,
      p_phone: input.phone ?? null,
      p_meta: (input.meta ?? {}) as any,
    })
    if (error) throw new Error(describe(error, 'create this account'))
    return data as unknown as Profile
  },

  async linkParent(parentProfileId: string, studentProfileId: string, relationship = 'parent') {
    const { error } = await supabase.rpc('admin_link_parent', {
      p_parent_profile_id: parentProfileId,
      p_student_profile_id: studentProfileId,
      p_relationship: relationship,
    })
    if (error) throw new Error(describe(error, 'link this family'))
  },

  // ── Results ─────────────────────────────────────────────────────────────
  /**
   * Uses the teacher_upsert_result RPC so that both the authorisation guard
   * and the duplicate check happen inside one transaction in Postgres.
   */
  async upsertResult(input: {
    studentId: string; subjectId: string; sessionId: string
    term: string; ca: number; exam: number; remarks?: string
  }) {
    const { data, error } = await supabase.rpc('teacher_upsert_result', {
      p_student_id: input.studentId,
      p_subject_id: input.subjectId,
      p_session_id: input.sessionId,
      p_term: input.term,
      p_ca: input.ca,
      p_exam: input.exam,
      p_remarks: input.remarks ?? null,
    })
    if (error) throw new Error(describe(error, 'save this result'))
    return data as string
  },

  async deleteResult(id: string) {
    const { error } = await supabase.from('results').delete().eq('id', id)
    if (error) throw new Error(describe(error, 'delete this result'))
  },

  // ── Attendance ──────────────────────────────────────────────────────────
  /** One RPC call per class-day; duplicate (student, date) rows are upserted. */
  async submitAttendance(classId: string, date: string, entries: { studentId: string; status: string }[]) {
    const { data, error } = await supabase.rpc('teacher_submit_attendance', {
      p_class_id: classId,
      p_date: date,
      p_entries: entries.map(e => ({ student_id: e.studentId, status: e.status })),
    })
    if (error) throw new Error(describe(error, 'save this attendance sheet'))
    return data as number
  },

  // ── Announcements ───────────────────────────────────────────────────────
  async createAnnouncement(input: { title: string; content: string; audience: string; pinned?: boolean }) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('announcements').insert({
      title: input.title,
      content: input.content,
      audience: input.audience,
      is_pinned: input.pinned ?? false,
      author_id: user?.id,
    })
    if (error) throw new Error(describe(error, 'publish this announcement'))
  },

  async updateAnnouncement(id: string, patch: Partial<{ title: string; content: string; audience: string; is_pinned: boolean }>) {
    const { error } = await supabase.from('announcements').update(patch).eq('id', id)
    if (error) throw new Error(describe(error, 'update this announcement'))
  },

  async deleteAnnouncement(id: string) {
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) throw new Error(describe(error, 'delete this announcement'))
  },

  // ── Role-aware RPC shortcuts ────────────────────────────────────────────
  async myChildren() {
    const { data, error } = await supabase.rpc('my_children')
    if (error) throw new Error(describe(error, 'load your children'))
    return (data ?? []) as any[]
  },

  async myClasses() {
    const { data, error } = await supabase.rpc('my_classes')
    if (error) throw new Error(describe(error, 'load your classes'))
    return (data ?? []) as any[]
  },
}

// Turn a PostgREST error into something a teacher or admin can act on.
function describe(error: { message: string; code?: string; details?: string }, action: string): string {
  const m = error.message ?? 'Unknown error'
  if (m.includes('duplicate key') || error.code === '23505') {
    return `A record already exists. ${action.replace('this', 'That')} record would be a duplicate.`
  }
  if (error.code === '42501') return `Permission denied — you are not allowed to ${action}.`
  if (m.includes('Not authorised')) return m
  if (m.includes('full capacity')) return `Cannot enrol: ${m}`
  if (m.includes('row-level security')) return `Blocked by security policy — you cannot ${action}.`
  return `Could not ${action}: ${m}`
}
