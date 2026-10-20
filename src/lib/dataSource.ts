/**
 * Data-source bridge.
 *
 * The UI reads synchronously from the store cache. This module keeps that
 * cache honest:
 *
 *   DEMO MODE  – cache is seeded from the bundled demo dataset (localStorage).
 *   LIVE MODE  – cache is REPLACED by real rows from Supabase on boot, and
 *                every mutation is written to Supabase first. A failed write
 *                throws, so the cache is never updated for an operation the
 *                database rejected.
 */

import { store, type AttendanceStatus } from './store'
import { schoolEmail } from './branding'
import { USE_SUPABASE, queries, mutations } from './supabaseService'
import { supabase } from './supabase'

export { USE_SUPABASE }

let hydrating: Promise<void> | null = null
let hydrated = false
let lastError: string | null = null

export const dataSource = {
  get isLive() { return USE_SUPABASE },
  get isHydrated() { return hydrated },
  get error() { return lastError },

  /** Pull every table the UI needs into the cache. Safe to await repeatedly. */
  hydrate(): Promise<void> {
    if (!USE_SUPABASE) { hydrated = true; return Promise.resolve() }
    if (hydrating) return hydrating

    hydrating = (async () => {
      try {
        const [profiles, classes] = await Promise.all([
          queries.profiles(),
          queries.classes(),
        ])
        const [students, teachers, results, attendance, announcements] = await Promise.all([
          queries.students(classes),
          queries.teachers(),
          queries.results(),
          queries.attendance(),
          queries.announcements(),
        ])

        const data = store.get()
        data.users = profiles.map(p => ({
          id: p.id,
          email: p.email,
          password: '',                 // never read; Supabase owns credentials
          role: p.role,
          full_name: p.full_name,
          avatar: p.avatar_url ?? `https://i.pravatar.cc/150?u=${p.id}`,
        }))
        data.classes = classes
        data.students = students
        data.teachers = teachers
        data.results = results
        data.attendance = attendance
        data.announcements = announcements

        // Persist to localStorage so a refresh paints instantly, then refetch.
        store.save(data)
        hydrated = true
        lastError = null
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        hydrated = true      // let the app render so the error is visible
        console.error('[SmartSchool] Supabase hydration failed:', lastError)
      }
    })()
    return hydrating
  },

  /** Re-pull everything (after a mutation, or on Supabase REALTIME events). */
  async refresh() {
    if (!USE_SUPABASE) return
    hydrating = null
    hydrated = false
    await this.hydrate()
  },

  /** Subscribe to DB changes so a teacher's result upload shows up live. */
  subscribeTables(tables: string[], onChange: () => void) {
    if (!USE_SUPABASE) return () => {}
    const channels = tables.map(t =>
      supabase
        .channel(`smartschool-${t}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: t }, onChange)
        .subscribe()
    )
    return () => channels.forEach(c => supabase.removeChannel(c))
  },
}

/**
 * Write-through wrappers. In demo mode these hit the local store only.
 * In live mode the Supabase call runs FIRST and its error propagates, so the
 * cache stays consistent with the database.
 */
export const writes = {
  async createStudent(input: {
    admissionNo: string; fullName: string; gender: string; dob: string
    address: string; phone: string; classId: string; className: string
    parentId: string; academicYear?: string
  }) {
    if (USE_SUPABASE) {
      const id = await mutations.createStudent({
        admissionNo: input.admissionNo,
        fullName: input.fullName,
        gender: input.gender,
        dob: input.dob,
        address: input.address,
        phone: input.phone,
        classId: input.classId,
        academicYear: input.academicYear ?? '2024/2025',
        parentProfileId: input.parentId || undefined,
      })
      await dataSource.refresh()
      return id
    }
    // demo mode
    store.addStudent({
      id: 's' + Date.now(),
      admission_no: input.admissionNo,
      full_name: input.fullName,
      email: schoolEmail(input.fullName),
      class_id: input.classId,
      class_name: input.className,
      parent_id: input.parentId,
      gender: input.gender,
      dob: input.dob,
      address: input.address,
      phone: input.phone,
      avatar: `https://i.pravatar.cc/150?u=${Date.now()}`,
    })
  },

  /**
   * Create a teacher account.
   *
   * LIVE MODE: calls the admin_create_account RPC, which creates the
   * auth.users row AND the profiles/teachers rows inside one transaction.
   * The caller supplies an initial password; Supabase hashes it server-side.
   * The plaintext password is never persisted by the client.
   *
   * DEMO MODE: writes a local record only. The `password` field exists
   * solely for the demo login form and never leaves the browser.
   */
  async createTeacher(input: {
    fullName: string; email: string; phone: string; qualification: string
    department: string; employeeNo: string; password: string
    classIds: string[]
  }) {
    if (USE_SUPABASE) {
      const profile = await mutations.createAccount({
        email: input.email,
        password: input.password,
        fullName: input.fullName,
        role: 'teacher',
        phone: input.phone,
        meta: {
          employee_no: input.employeeNo,
          qualification: input.qualification,
          department: input.department,
        },
      })
      for (const classId of input.classIds) {
        await mutations.assignTeacher(profile.id, classId, { isClassTeacher: false })
      }
      await dataSource.refresh()
      return profile
    }
    const id = 't' + Date.now()
    const userId = 'u-' + Date.now()
    store.addTeacher({
      id,
      employee_no: input.employeeNo,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      qualification: input.qualification,
      department: input.department,
      avatar: `https://i.pravatar.cc/150?u=${id}`,
      class_ids: input.classIds,
    })
    store.addUser({
      id: userId,
      email: input.email,
      password: input.password,
      role: 'teacher',
      full_name: input.fullName,
      avatar: `https://i.pravatar.cc/150?u=${id}`,
    })
    return { id: userId }
  },

  async createClass(input: {
    name: string; section: string; level: string; capacity: number
    teacherId: string; teacherName: string; session: string; sessionId?: string
  }) {
    if (USE_SUPABASE) {
      const sessionId = input.sessionId
        ?? (await supabase.from('academic_sessions').select('id').eq('is_current', true).maybeSingle()).data?.id
      if (!sessionId) throw new Error('No current academic session is configured.')
      const id = await mutations.createClass({
        name: input.name, section: input.section, level: input.level,
        capacity: input.capacity, sessionId,
      })
      if (input.teacherId) {
        await mutations.assignTeacher(input.teacherId, id, { isClassTeacher: true })
      }
      await dataSource.refresh()
      return id
    }
    store.addClass({
      id: 'c' + Date.now(),
      name: input.name, section: input.section, level: input.level,
      teacher_id: input.teacherId, teacher_name: input.teacherName,
      capacity: input.capacity, enrolled: 0, session: input.session,
    })
  },

  async saveResult(input: {
    studentId: string; studentName: string; subject: string; term: string
    session: string; ca: number; exam: number; total: number; grade: string
    subjectId?: string; sessionId?: string
  }) {
    if (USE_SUPABASE) {
      const subjectId = input.subjectId
        ?? (await supabase.from('subjects').select('id').eq('name', input.subject).maybeSingle()).data?.id
      const sessionId = input.sessionId
        ?? (await supabase.from('academic_sessions').select('id').eq('is_current', true).maybeSingle()).data?.id
      if (!subjectId) throw new Error(`Subject "${input.subject}" does not exist in the subjects table.`)
      if (!sessionId) throw new Error('No current academic session is configured.')
      await mutations.upsertResult({
        studentId: input.studentId, subjectId, sessionId,
        term: input.term, ca: input.ca, exam: input.exam,
      })
      await dataSource.refresh()
      return
    }
    // demo mode enforces the same uniqueness rule as the DB constraint
    store.addResult({
      id: 'r' + Date.now(),
      student_id: input.studentId,
      student_name: input.studentName,
      subject: input.subject,
      term: input.term,
      session: input.session,
      ca_score: input.ca,
      exam_score: input.exam,
      total: input.total,
      grade: input.grade,
    })
  },

  async saveAttendance(classId: string, date: string, entries: { studentId: string; studentName: string; status: AttendanceStatus }[]) {
    if (USE_SUPABASE) {
      await mutations.submitAttendance(classId, date, entries.map(e => ({ studentId: e.studentId, status: e.status })))
      await dataSource.refresh()
      return
    }
    store.addAttendance(entries.map((e, i) => ({
      id: 'at' + Date.now() + i,
      student_id: e.studentId,
      student_name: e.studentName,
      class_id: classId,
      date,
      status: e.status,
    })))
  },

  async publishAnnouncement(input: { title: string; content: string; author: string; target: string; pinned?: boolean }) {
    if (USE_SUPABASE) {
      await mutations.createAnnouncement({
        title: input.title, content: input.content,
        audience: input.target, pinned: input.pinned,
      })
      await dataSource.refresh()
      return
    }
    store.addAnnouncement({
      id: 'a' + Date.now(),
      title: input.title,
      content: input.content,
      author: input.author,
      target: input.target,
      date: new Date().toISOString().slice(0, 10),
      pinned: input.pinned,
    })
  },

  async deleteAnnouncement(id: string) {
    if (USE_SUPABASE) { await mutations.deleteAnnouncement(id); await dataSource.refresh(); return }
    store.deleteAnnouncement(id)
  },

  async deleteStudent(id: string) {
    if (USE_SUPABASE) { await mutations.deleteStudent(id); await dataSource.refresh(); return }
    store.deleteStudent(id)
  },

  async updateStudent(id: string, patch: {
    full_name: string; admission_no: string; gender: string
    dob: string; address: string; phone: string
    classId?: string; className?: string; academicYear?: string
  }) {
    if (USE_SUPABASE) {
      await mutations.updateStudent(id, {
        full_name: patch.full_name,
        admission_no: patch.admission_no,
        gender: patch.gender || null as any,
        date_of_birth: patch.dob || null as any,
        address: patch.address || null as any,
        phone: patch.phone || null as any,
      })
      // Moving a student between classes is a separate enrolment change.
      if (patch.classId) {
        await mutations.reassignStudentClass(id, patch.classId, patch.academicYear ?? '2024/2025')
      }
      await dataSource.refresh()
      return
    }
    store.updateStudent(id, { ...patch, class_name: patch.className } as any)
  },

  async updateClass(id: string, patch: {
    name: string; section: string; level: string; capacity: number
    teacherId?: string; teacherName?: string
  }) {
    if (USE_SUPABASE) {
      await mutations.updateClass(id, {
        name: patch.name, section: patch.section,
        level: patch.level, capacity: patch.capacity,
      })
      if (patch.teacherId) {
        await mutations.assignTeacher(patch.teacherId, id, { isClassTeacher: true })
      }
      await dataSource.refresh()
      return
    }
    store.updateClass(id, {
      name: patch.name, section: patch.section, level: patch.level,
      capacity: patch.capacity,
      ...(patch.teacherId ? { teacher_id: patch.teacherId, teacher_name: patch.teacherName } : {}),
    } as any)
  },

  async updateAnnouncement(id: string, patch: { title: string; content: string; target: string; pinned?: boolean }) {
    if (USE_SUPABASE) {
      await mutations.updateAnnouncement(id, {
        title: patch.title, content: patch.content,
        audience: patch.target, is_pinned: patch.pinned,
      })
      await dataSource.refresh()
      return
    }
    store.updateAnnouncement(id, { ...patch, target: patch.target } as any)
  },

  async deleteClass(id: string) {
    if (USE_SUPABASE) { await mutations.deleteClass(id); await dataSource.refresh(); return }
    store.deleteClass(id)
  },

  async deleteResult(id: string) {
    if (USE_SUPABASE) { await mutations.deleteResult(id); await dataSource.refresh(); return }
    store.deleteResult(id)
  },
}
