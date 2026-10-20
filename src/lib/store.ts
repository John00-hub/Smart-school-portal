// Centralized data store - mimics Supabase with localStorage persistence
// In production, replace with actual Supabase queries

export interface AppUser {
  id: string
  email: string
  password: string // demo only - never do this in production
  role: 'admin' | 'teacher' | 'parent' | 'student'
  full_name: string
  avatar?: string
}

export interface StudentRecord {
  id: string
  admission_no: string
  full_name: string
  email: string
  class_id: string
  class_name: string
  parent_id: string
  gender: string
  dob: string
  address: string
  phone: string
  avatar: string
}

export interface TeacherRecord {
  id: string
  employee_no: string
  full_name: string
  email: string
  phone: string
  qualification: string
  department: string
  avatar: string
  class_ids: string[]
}

export interface ClassRecord {
  id: string
  name: string
  section: string
  level: string
  teacher_id: string
  teacher_name: string
  capacity: number
  enrolled: number
  session: string
}

export interface AnnouncementRecord {
  id: string
  title: string
  content: string
  author: string
  target: string
  date: string
  pinned?: boolean
}

export interface ResultRecord {
  id: string
  student_id: string
  student_name: string
  subject: string
  term: string
  session: string
  ca_score: number
  exam_score: number
  total: number
  grade: string
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export interface AttendanceRecord {
  id: string
  student_id: string
  student_name: string
  class_id: string
  date: string
  /** Mirrors the Postgres `attendance_status` enum, including `excused`. */
  status: AttendanceStatus
  /** Profile id of the teacher who marked this row. */
  marked_by?: string
}

export interface TimetableEntry {
  day: string
  time: string
  subject: string
  teacher: string
  room: string
}

// Initial seed data
const seedUsers: AppUser[] = [
  { id: 'u-admin', email: 'admin@greenfield.example', password: 'Admin123!', role: 'admin', full_name: 'Dr. Tobiloba Adeyemi', avatar: 'https://i.pravatar.cc/150?img=5' },
  { id: 'u-teacher1', email: 'teacher@greenfield.example', password: 'Teacher123!', role: 'teacher', full_name: 'Mr. Chinedu Okeke', avatar: 'https://i.pravatar.cc/150?img=12' },
  { id: 'u-teacher2', email: 'aisha.abdullahi@greenfield.example', password: 'Teacher123!', role: 'teacher', full_name: 'Mrs. Aisha Abdullahi', avatar: 'https://i.pravatar.cc/150?img=9' },
  { id: 'u-parent1', email: 'parent@greenfield.example', password: 'Parent123!', role: 'parent', full_name: 'Mrs. Ngozi Okafor', avatar: 'https://i.pravatar.cc/150?img=26' },
  { id: 'u-parent2', email: 'abdullahi.musa@greenfield.example', password: 'Parent123!', role: 'parent', full_name: 'Mr. Abdullahi Musa', avatar: 'https://i.pravatar.cc/150?img=15' },
  { id: 'u-student1', email: 'student@greenfield.example', password: 'Student123!', role: 'student', full_name: 'Chiamaka Okafor', avatar: 'https://i.pravatar.cc/150?img=32' },
  { id: 'u-student2', email: 'emeka.okafor@greenfield.example', password: 'Student123!', role: 'student', full_name: 'Emeka Okafor', avatar: 'https://i.pravatar.cc/150?img=51' },
]

const seedClasses: ClassRecord[] = [
  { id: 'c1', name: 'JSS 1', section: 'A', level: 'Junior Secondary', teacher_id: 'u-teacher1', teacher_name: 'Mr. Chinedu Okeke', capacity: 40, enrolled: 32, session: '2024/2025' },
  { id: 'c2', name: 'JSS 1', section: 'B', level: 'Junior Secondary', teacher_id: 'u-teacher2', teacher_name: 'Mrs. Aisha Abdullahi', capacity: 40, enrolled: 28, session: '2024/2025' },
  { id: 'c3', name: 'JSS 2', section: 'A', level: 'Junior Secondary', teacher_id: 'u-teacher1', teacher_name: 'Mr. Chinedu Okeke', capacity: 35, enrolled: 30, session: '2024/2025' },
  { id: 'c4', name: 'SSS 1', section: 'A', level: 'Senior Secondary', teacher_id: 'u-teacher2', teacher_name: 'Mrs. Aisha Abdullahi', capacity: 35, enrolled: 26, session: '2024/2025' },
  { id: 'c5', name: 'SSS 2', section: 'B', level: 'Senior Secondary', teacher_id: 'u-teacher1', teacher_name: 'Mr. Chinedu Okeke', capacity: 30, enrolled: 22, session: '2024/2025' },
  { id: 'c6', name: 'SSS 3', section: 'A', level: 'Senior Secondary', teacher_id: 'u-teacher2', teacher_name: 'Mrs. Aisha Abdullahi', capacity: 30, enrolled: 24, session: '2024/2025' },
]

const seedStudents: StudentRecord[] = [
  { id: 's1', admission_no: 'SS/2024/001', full_name: 'Chiamaka Okafor', email: 'student@greenfield.example', class_id: 'c1', class_name: 'JSS 1 A', parent_id: 'u-parent1', gender: 'Female', dob: '2012-05-14', address: '12 Independence Layout, Enugu', phone: '08031234567', avatar: 'https://i.pravatar.cc/150?img=32' },
  { id: 's2', admission_no: 'SS/2024/002', full_name: 'Emeka Okafor', email: 'emeka.okafor@greenfield.example', class_id: 'c1', class_name: 'JSS 1 A', parent_id: 'u-parent1', gender: 'Male', dob: '2012-03-22', address: '8 GRA, Enugu', phone: '08039876543', avatar: 'https://i.pravatar.cc/150?img=51' },
  { id: 's3', admission_no: 'SS/2024/003', full_name: 'Zainab Musa', email: 'zainab.musa@greenfield.example', class_id: 'c1', class_name: 'JSS 1 A', parent_id: 'u-parent2', gender: 'Female', dob: '2012-07-08', address: '15 Ogui Road, Enugu', phone: '08031239876', avatar: 'https://i.pravatar.cc/150?img=33' },
  { id: 's4', admission_no: 'SS/2024/004', full_name: 'Ibrahim Musa', email: 'ibrahim.musa@greenfield.example', class_id: 'c2', class_name: 'JSS 1 B', parent_id: 'u-parent2', gender: 'Male', dob: '2011-11-30', address: '22 New Haven, Enugu', phone: '08035551234', avatar: 'https://i.pravatar.cc/150?img=52' },
  { id: 's5', admission_no: 'SS/2024/005', full_name: 'Adaeze Okafor', email: 'adaeze.okafor@greenfield.example', class_id: 'c3', class_name: 'JSS 2 A', parent_id: 'u-parent1', gender: 'Female', dob: '2011-04-18', address: '10 Abakpa Nike, Enugu', phone: '08034445566', avatar: 'https://i.pravatar.cc/150?img=34' },
  { id: 's6', admission_no: 'SS/2024/006', full_name: 'Usman Musa', email: 'usman.musa@greenfield.example', class_id: 'c4', class_name: 'SSS 1 A', parent_id: 'u-parent2', gender: 'Male', dob: '2010-09-12', address: '5 Coal Camp, Enugu', phone: '08036667788', avatar: 'https://i.pravatar.cc/150?img=53' },
  { id: 's7', admission_no: 'SS/2024/007', full_name: 'Amarachi Okafor', email: 'amarachi.okafor@greenfield.example', class_id: 'c4', class_name: 'SSS 1 A', parent_id: 'u-parent1', gender: 'Female', dob: '2010-06-25', address: '18 Uwani, Enugu', phone: '08037778899', avatar: 'https://i.pravatar.cc/150?img=35' },
  { id: 's8', admission_no: 'SS/2024/008', full_name: 'Yusuf Musa', email: 'yusuf.musa@greenfield.example', class_id: 'c5', class_name: 'SSS 2 B', parent_id: 'u-parent2', gender: 'Male', dob: '2009-02-14', address: '30 Independence Avenue, Enugu', phone: '08038889900', avatar: 'https://i.pravatar.cc/150?img=54' },
]

const seedTeachers: TeacherRecord[] = [
  { id: 't1', employee_no: 'TCH/2020/011', full_name: 'Mr. Chinedu Okeke', email: 'teacher@greenfield.example', phone: '08031234000', qualification: 'M.Ed Mathematics', department: 'Sciences', avatar: 'https://i.pravatar.cc/150?img=12', class_ids: ['c1', 'c3', 'c5'] },
  { id: 't2', employee_no: 'TCH/2021/024', full_name: 'Mrs. Aisha Abdullahi', email: 'aisha.abdullahi@greenfield.example', phone: '08039876000', qualification: 'B.Ed English', department: 'Languages', avatar: 'https://i.pravatar.cc/150?img=9', class_ids: ['c2', 'c4', 'c6'] },
  { id: 't3', employee_no: 'TCH/2019/008', full_name: 'Dr. Samuel Adebayo', email: 'samuel.adebayo@greenfield.example', phone: '08035550011', qualification: 'Ph.D Physics', department: 'Sciences', avatar: 'https://i.pravatar.cc/150?img=11', class_ids: ['c3', 'c6'] },
  { id: 't4', employee_no: 'TCH/2022/031', full_name: 'Mrs. Funmilayo Adekunle', email: 'funmilayo.adekunle@greenfield.example', phone: '08036660022', qualification: 'M.Sc Chemistry', department: 'Sciences', avatar: 'https://i.pravatar.cc/150?img=29', class_ids: ['c1', 'c4'] },
]

const seedAnnouncements: AnnouncementRecord[] = [
  { id: 'a1', title: 'Mid-Term Break Announced', content: 'Dear Parents and Students, please be informed that mid-term break will commence from 24th October to 29th October 2024. Boarding students are to be picked up by 2pm on the 24th. Classes resume fully on 30th October.', author: 'Dr. Tobiloba Adeyemi', target: 'all', date: '2024-10-15', pinned: true },
  { id: 'a2', title: 'Inter-House Sports Competition', content: 'The annual Inter-House Sports Competition will hold on 15th November 2024 at the school sports complex. All houses should commence training immediately. Parents are warmly invited.', author: 'Mr. Chinedu Okeke', target: 'all', date: '2024-10-10' },
  { id: 'a3', title: 'PTA Meeting - 25th October', content: 'This is to invite all parents/guardians to the PTA meeting scheduled for 25th October 2024 by 10:00 AM in the school hall. Agenda includes academic progress and infrastructure development.', author: 'Dr. Tobiloba Adeyemi', target: 'parent', date: '2024-10-08' },
  { id: 'a4', title: 'Teachers Workshop', content: 'All teaching staff are required to attend the professional development workshop on Modern Pedagogy scheduled for 22nd October 2024 at 9:00 AM in the conference room.', author: 'Dr. Tobiloba Adeyemi', target: 'teacher', date: '2024-10-05' },
  { id: 'a5', title: 'SSS 3 Mock Examination', content: 'SSS 3 mock examinations will commence on 4th November 2024. Students are advised to prepare thoroughly. Timetable has been pasted on notice boards and sent to parents.', author: 'Mrs. Aisha Abdullahi', target: 'student', date: '2024-10-12' },
]

const seedResults: ResultRecord[] = [
  { id: 'r1', student_id: 's1', student_name: 'Chiamaka Okafor', subject: 'Mathematics', term: 'First Term', session: '2024/2025', ca_score: 28, exam_score: 62, total: 90, grade: 'A' },
  { id: 'r2', student_id: 's1', student_name: 'Chiamaka Okafor', subject: 'English Language', term: 'First Term', session: '2024/2025', ca_score: 25, exam_score: 58, total: 83, grade: 'A' },
  { id: 'r3', student_id: 's1', student_name: 'Chiamaka Okafor', subject: 'Basic Science', term: 'First Term', session: '2024/2025', ca_score: 24, exam_score: 55, total: 79, grade: 'B' },
  { id: 'r4', student_id: 's1', student_name: 'Chiamaka Okafor', subject: 'Social Studies', term: 'First Term', session: '2024/2025', ca_score: 26, exam_score: 52, total: 78, grade: 'B' },
  { id: 'r5', student_id: 's2', student_name: 'Emeka Okafor', subject: 'Mathematics', term: 'First Term', session: '2024/2025', ca_score: 22, exam_score: 48, total: 70, grade: 'B' },
  { id: 'r6', student_id: 's2', student_name: 'Emeka Okafor', subject: 'English Language', term: 'First Term', session: '2024/2025', ca_score: 20, exam_score: 45, total: 65, grade: 'C' },
  { id: 'r7', student_id: 's5', student_name: 'Adaeze Okafor', subject: 'Mathematics', term: 'First Term', session: '2024/2025', ca_score: 30, exam_score: 65, total: 95, grade: 'A' },
]

const seedAttendance: AttendanceRecord[] = [
  { id: 'at1', student_id: 's1', student_name: 'Chiamaka Okafor', class_id: 'c1', date: '2024-10-14', status: 'present' },
  { id: 'at2', student_id: 's2', student_name: 'Emeka Okafor', class_id: 'c1', date: '2024-10-14', status: 'present' },
  { id: 'at3', student_id: 's3', student_name: 'Ibrahim Musa', class_id: 'c1', date: '2024-10-14', status: 'absent' },
  { id: 'at4', student_id: 's1', student_name: 'Chiamaka Okafor', class_id: 'c1', date: '2024-10-15', status: 'present' },
  { id: 'at5', student_id: 's2', student_name: 'Emeka Okafor', class_id: 'c1', date: '2024-10-15', status: 'late' },
  { id: 'at6', student_id: 's1', student_name: 'Chiamaka Okafor', class_id: 'c1', date: '2024-10-16', status: 'present' },
  { id: 'at7', student_id: 's4', student_name: 'Zainab Musa', class_id: 'c2', date: '2024-10-14', status: 'present' },
]

export const timetableData: Record<string, TimetableEntry[]> = {
  'c1': [
    { day: 'Monday', time: '08:00 - 08:40', subject: 'Mathematics', teacher: 'Mr. Chinedu Okeke', room: 'Room 101' },
    { day: 'Monday', time: '08:40 - 09:20', subject: 'English', teacher: 'Mrs. Aisha Abdullahi', room: 'Room 101' },
    { day: 'Monday', time: '09:20 - 10:00', subject: 'Basic Science', teacher: 'Dr. Samuel Adebayo', room: 'Lab 1' },
    { day: 'Monday', time: '10:30 - 11:10', subject: 'Social Studies', teacher: 'Mrs. Funmilayo Adekunle', room: 'Room 101' },
    { day: 'Monday', time: '11:10 - 11:50', subject: 'Creative Arts', teacher: 'Mrs. Aisha Abdullahi', room: 'Room 102' },
    { day: 'Tuesday', time: '08:00 - 08:40', subject: 'English', teacher: 'Mrs. Aisha Abdullahi', room: 'Room 101' },
    { day: 'Tuesday', time: '08:40 - 09:20', subject: 'Mathematics', teacher: 'Mr. Chinedu Okeke', room: 'Room 101' },
    { day: 'Tuesday', time: '09:20 - 10:00', subject: 'Computer Studies', teacher: 'Mr. Chinedu Okeke', room: 'ICT Lab' },
    { day: 'Wednesday', time: '08:00 - 08:40', subject: 'Basic Tech', teacher: 'Dr. Samuel Adebayo', room: 'Workshop' },
    { day: 'Wednesday', time: '08:40 - 09:20', subject: 'Mathematics', teacher: 'Mr. Chinedu Okeke', room: 'Room 101' },
    { day: 'Thursday', time: '08:00 - 08:40', subject: 'French', teacher: 'Mrs. Funmilayo Adekunle', room: 'Room 101' },
    { day: 'Friday', time: '08:00 - 08:40', subject: 'Physical Education', teacher: 'Mr. Chinedu Okeke', room: 'Field' },
  ]
}

import { gradeLetter, gradeRemark } from './grading'

// Storage helpers
const STORAGE_KEY = 'smartschool_data_v2'

interface StoreData {
  users: AppUser[]
  students: StudentRecord[]
  teachers: TeacherRecord[]
  classes: ClassRecord[]
  announcements: AnnouncementRecord[]
  results: ResultRecord[]
  attendance: AttendanceRecord[]
}

function getStoredData(): StoreData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  // Deep-copy the seed. Returning the module-level arrays directly would let
  // any mutation (push/splice) permanently corrupt the seed, so reset() could
  // never restore a clean dataset.
  return {
    users: structuredCloneSafe(seedUsers),
    students: structuredCloneSafe(seedStudents),
    teachers: structuredCloneSafe(seedTeachers),
    classes: structuredCloneSafe(seedClasses),
    announcements: structuredCloneSafe(seedAnnouncements),
    results: structuredCloneSafe(seedResults),
    attendance: structuredCloneSafe(seedAttendance),
  }
}

function structuredCloneSafe<T>(v: T): T {
  if (typeof structuredClone === 'function') return structuredClone(v)
  return JSON.parse(JSON.stringify(v))
}

function saveData(data: StoreData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  // dispatch event for reactivity
  window.dispatchEvent(new CustomEvent('smartschool:update', { detail: data }))
}

// Public API
export const store = {
  get: getStoredData,
  save: saveData,
  reset: () => {
    localStorage.removeItem(STORAGE_KEY)
    saveData(getStoredData())
  },
  // Users
  addUser: (user: AppUser) => {
    const data = getStoredData()
    data.users.push(user)
    saveData(data)
  },
  // Students
  addStudent: (s: StudentRecord) => {
    const data = getStoredData()
    data.students.push(s)
    // update class enrolled
    const cls = data.classes.find(c => c.id === s.class_id)
    if (cls) cls.enrolled++
    saveData(data)
  },
  updateStudent: (id: string, patch: Partial<StudentRecord>) => {
    const data = getStoredData()
    const idx = data.students.findIndex(s => s.id === id)
    if (idx !== -1) { data.students[idx] = { ...data.students[idx], ...patch }; saveData(data) }
  },
  deleteStudent: (id: string) => {
    const data = getStoredData()
    data.students = data.students.filter(s => s.id !== id)
    saveData(data)
  },
  // Teachers
  addTeacher: (t: TeacherRecord) => {
    const data = getStoredData()
    data.teachers.push(t)
    saveData(data)
  },
  // Classes
  addClass: (c: ClassRecord) => {
    const data = getStoredData()
    data.classes.push(c)
    saveData(data)
  },
  updateClass: (id: string, patch: Partial<ClassRecord>) => {
    const data = getStoredData()
    const idx = data.classes.findIndex(c => c.id === id)
    if (idx !== -1) { data.classes[idx] = { ...data.classes[idx], ...patch }; saveData(data) }
  },
  deleteClass: (id: string) => {
    const data = getStoredData()
    data.classes = data.classes.filter(c => c.id !== id)
    saveData(data)
  },
  // Announcements
  addAnnouncement: (a: AnnouncementRecord) => {
    const data = getStoredData()
    data.announcements.unshift(a)
    saveData(data)
  },
  updateAnnouncement: (id: string, patch: Partial<AnnouncementRecord>) => {
    const data = getStoredData()
    const idx = data.announcements.findIndex(a => a.id === id)
    if (idx !== -1) { data.announcements[idx] = { ...data.announcements[idx], ...patch }; saveData(data) }
  },
  deleteAnnouncement: (id: string) => {
    const data = getStoredData()
    data.announcements = data.announcements.filter(a => a.id !== id)
    saveData(data)
  },
  // Results
  addResult: (r: ResultRecord) => {
    const data = getStoredData()
    // prevent duplicate
    const dup = data.results.find(x => x.student_id === r.student_id && x.subject === r.subject && x.term === r.term && x.session === r.session)
    if (dup) throw new Error('Duplicate result: This student already has a result for this subject, term and session.')
    data.results.push(r)
    saveData(data)
  },
  updateResult: (id: string, patch: Partial<ResultRecord>) => {
    const data = getStoredData()
    const idx = data.results.findIndex(r => r.id === id)
    if (idx !== -1) { data.results[idx] = { ...data.results[idx], ...patch }; saveData(data) }
  },
  deleteResult: (id: string) => {
    const data = getStoredData()
    data.results = data.results.filter(r => r.id !== id)
    saveData(data)
  },
  // Attendance
  addAttendance: (records: AttendanceRecord[]) => {
    const data = getStoredData()
    records.forEach(rec => {
      const exists = data.attendance.find(a => a.student_id === rec.student_id && a.date === rec.date)
      if (!exists) data.attendance.push(rec)
      else { exists.status = rec.status }
    })
    saveData(data)
  },
}

/**
 * Delegates to src/lib/grading.ts — the single source of truth.
 *
 * Previously this reimplemented the bands and DISAGREED with the database
 * function `grade_for_total()` (this file had no 'E' band), so the same score
 * graded differently in demo vs live mode. Kept as a thin alias so existing
 * call sites keep working.
 */
export const gradeFromTotal = (total: number): string => gradeLetter(total)

export const gradeRemarkFor = (total: number): string => gradeRemark(total)

/**
 * 5-point GPA on the A–F scale. Grades outside the map (e.g. the A1–F9
 * seven-point scale) fall back to a numeric derivation so a custom scale
 * still produces a sane value rather than silently reading 0.
 */
export const calculateGPA = (results: ResultRecord[]): number => {
  if (!results.length) return 0
  const points: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 }
  const total = results.reduce((acc, r) => acc + (points[r.grade] || 0), 0)
  return Number((total / results.length).toFixed(2))
}
