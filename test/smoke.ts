/**
 * Smoke test that exercises the REAL modules — store logic, grading,
 * duplicate prevention, and the data-source switch.
 *
 * Bundled with esbuild (so the actual TS source is what runs, not a copy)
 * and executed inside jsdom so localStorage/window behave as in a browser.
 *
 *   npx esbuild src/smoke.ts --bundle --format=esm --outfile=/tmp/smoke.mjs \
 *     --platform=browser --external:react --external:react-dom \
 *     --external:react-router-dom --external:lucide-react --external:recharts \
 *     --external:@supabase/supabase-js
 *   node test/smoke.mjs
 */
import { store, gradeFromTotal, calculateGPA } from '../src/lib/store'
import { gradeFor, gradeLetter, validateScale, DEFAULT_SCALE, SEVEN_POINT_SCALE } from '../src/lib/grading'
import { USE_SUPABASE } from '../src/lib/dataSource'

let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log('  PASS  ' + name) }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  <- ' + detail : '')) }
}

// ── 1. Mode detection ──────────────────────────────────────────────────────
console.log('\n[1] Backend mode detection')
check('no env vars -> demo mode', USE_SUPABASE === false, 'got ' + USE_SUPABASE)

// ── 2. Grading boundaries ──────────────────────────────────────────────────
console.log('\n[2] Grade boundaries (CA 30 + Exam 70)')
// NOTE: these expectations were deliberately corrected in Phase 2.
// The old demo scale had no 'E' band (D>=40) and therefore disagreed with the
// database function grade_for_total(), which has D>=45 and E>=40. Both now
// share src/lib/grading.ts, so 40-44 is 'E' and 45-49 is 'D'.
const grades: [number, string][] = [[95,'A'],[75,'A'],[74,'B'],[65,'B'],[64,'C'],[50,'C'],[49,'D'],[45,'D'],[44,'E'],[40,'E'],[39,'F'],[0,'F']]
for (const [total, expected] of grades) {
  const got = gradeFromTotal(total)
  check(`total ${String(total).padStart(3)} -> ${expected}`, got === expected, 'got ' + got)
}

// ── 3. Seed data integrity ─────────────────────────────────────────────────
console.log('\n[3] Seed data')
const seed = store.get()
check('6 classes seeded', seed.classes.length === 6, 'got ' + seed.classes.length)
check('8 students seeded', seed.students.length === 8, 'got ' + seed.students.length)
check('4 teachers seeded', seed.teachers.length === 4, 'got ' + seed.teachers.length)
check('announcements seeded', seed.announcements.length === 5, 'got ' + seed.announcements.length)

// Every demo login maps to exactly one role
const roles = ['admin','teacher','parent','student']
for (const r of roles) {
  check(`demo account exists for role: ${r}`, seed.users.some(u => u.role === r))
}

// Referential integrity: every student's class_id resolves
const danglingClass = seed.students.filter(s => !seed.classes.some(c => c.id === s.class_id))
check('every student.class_id resolves to a class', danglingClass.length === 0,
  JSON.stringify(danglingClass.map(s => s.full_name + '->' + s.class_id)))

// Every student's parent_id resolves to a real parent user
const danglingParent = seed.students.filter(s => s.parent_id && !seed.users.some(u => u.id === s.parent_id))
check('every student.parent_id resolves to a user', danglingParent.length === 0,
  JSON.stringify(danglingParent.map(s => s.full_name + '->' + s.parent_id)))

// Every teacher class_id resolves
const danglingT = seed.teachers.flatMap(t => t.class_ids.filter(cid => !seed.classes.some(c => c.id === cid)))
check('every teacher class assignment resolves', danglingT.length === 0, JSON.stringify(danglingT))

// Every result points at a real student
const danglingR = seed.results.filter(r => !seed.students.some(s => s.id === r.student_id))
check('every result.student_id resolves', danglingR.length === 0)

// ── 4. Duplicate result prevention (mirrors results_unique_record) ─────────
console.log('\n[4] Duplicate result prevention')
const before = store.get().results.length
let dupError = ''
try {
  store.addResult({
    id: 'r-dup-test', student_id: 's1', student_name: 'Chiamaka Okafor',
    subject: 'Mathematics', term: 'First Term', session: '2024/2025',
    ca_score: 10, exam_score: 10, total: 20, grade: 'F',
  })
} catch (e: any) { dupError = e.message }
check('re-inserting student+subject+term+session throws', dupError.length > 0, 'no error thrown')
check('...and the message names the duplicate', /duplicate/i.test(dupError), dupError)
check('row count unchanged after rejected duplicate', store.get().results.length === before,
  `${before} -> ${store.get().results.length}`)

// A different term for the same student/subject IS allowed
let okInsert = true
try {
  store.addResult({
    id: 'r-2nd-term', student_id: 's1', student_name: 'Chiamaka Okafor',
    subject: 'Mathematics', term: 'Second Term', session: '2024/2025',
    ca_score: 25, exam_score: 50, total: 75, grade: 'A',
  })
} catch { okInsert = false }
check('same student+subject in a DIFFERENT term is allowed', okInsert)
check('result count grew by 1', store.get().results.length === before + 1,
  `${before} -> ${store.get().results.length}`)

// ── 5. Attendance upsert (mirrors attendance_unique_record) ────────────────
console.log('\n[5] Attendance upsert on (student, date)')
const day = '2024-11-01'
store.addAttendance([{ id: 'x1', student_id: 's1', student_name: 'C', class_id: 'c1', date: day, status: 'present' }])
const afterFirst = store.get().attendance.filter(a => a.student_id === 's1' && a.date === day).length
check('first mark inserts one row', afterFirst === 1, 'got ' + afterFirst)

store.addAttendance([{ id: 'x2', student_id: 's1', student_name: 'C', class_id: 'c1', date: day, status: 'absent' }])
const afterSecond = store.get().attendance.filter(a => a.student_id === 's1' && a.date === day)
check('re-marking the same day does NOT duplicate', afterSecond.length === 1, 'got ' + afterSecond.length)
check('...and updates the status instead', afterSecond[0]?.status === 'absent', 'got ' + afterSecond[0]?.status)

// ── 6. Enrolment counter ───────────────────────────────────────────────────
console.log('\n[6] Class enrolment counter')
const cls = store.get().classes.find(c => c.id === 'c2')!
const enrolledBefore = cls.enrolled
store.addStudent({
  id: 's-new', admission_no: 'SS/2024/999', full_name: 'Test Pupil',
  email: 'test@x.edu', class_id: 'c2', class_name: 'JSS 1 B',
  parent_id: 'u-parent1', gender: 'Female', dob: '2012-01-01',
  address: '', phone: '', avatar: '',
})
const clsAfter = store.get().classes.find(c => c.id === 'c2')!
check('enrolled increments on registration', clsAfter.enrolled === enrolledBefore + 1,
  `${enrolledBefore} -> ${clsAfter.enrolled}`)

// ── 7. GPA ─────────────────────────────────────────────────────────────────
console.log('\n[7] GPA calculation')
const myResults = store.get().results.filter(r => r.student_id === 's1')
const gpa = calculateGPA(myResults)
check('GPA is a finite number', Number.isFinite(gpa), String(gpa))
check('GPA within 0..5 scale', gpa >= 0 && gpa <= 5, String(gpa))
check('GPA of empty set is 0', calculateGPA([]) === 0)

// ── 8. Role isolation of announcements ─────────────────────────────────────
console.log('\n[8] Announcement audience filtering')
const visibleTo = (role: string) =>
  store.get().announcements.filter(a => a.target === 'all' || a.target === role)
const parentSees = visibleTo('parent')
const studentSees = visibleTo('student')
const teacherSees = visibleTo('teacher')
check("parent sees 'all' + 'parent' only",
  parentSees.every(a => a.target === 'all' || a.target === 'parent'))
check("parent does NOT see teacher-only items",
  !parentSees.some(a => a.target === 'teacher'))
check("student does NOT see parent-only items",
  !studentSees.some(a => a.target === 'parent'))
check("teacher does NOT see student-only items",
  !teacherSees.some(a => a.target === 'student'))
check('teacher-only announcement exists in seed',
  store.get().announcements.some(a => a.target === 'teacher'))
check('student-only announcement exists in seed',
  store.get().announcements.some(a => a.target === 'student'))

// ── 9. Persistence round-trip ──────────────────────────────────────────────
console.log('\n[9] Persistence')
const snapshot = store.get()
const reread = store.get()
check('reads are stable across calls', reread.students.length === snapshot.students.length)
check('localStorage holds the dataset', (localStorage.getItem('smartschool_data_v2') || '').length > 100)

// ── 11. Configurable grade scales (audit H3) ───────────────────────────────
console.log('\n[11] Configurable grade scales')
check('default scale gives E for 42', gradeLetter(42) === 'E', gradeLetter(42))
check('default scale gives D for 46', gradeLetter(46) === 'D', gradeLetter(46))
check('seven-point scale gives A1 for 90', gradeLetter(90, SEVEN_POINT_SCALE) === 'A1', gradeLetter(90, SEVEN_POINT_SCALE))
check('seven-point scale gives C6 for 52', gradeLetter(52, SEVEN_POINT_SCALE) === 'C6', gradeLetter(52, SEVEN_POINT_SCALE))
check('frontend scale agrees with the DB bands (A>=75,B>=65,C>=50,D>=45,E>=40,F)',
  gradeLetter(75)==='A' && gradeLetter(65)==='B' && gradeLetter(50)==='C'
  && gradeLetter(45)==='D' && gradeLetter(40)==='E' && gradeLetter(39)==='F')
check('remark is returned with the grade', gradeFor(80).remark === 'Excellent', gradeFor(80).remark)
check('NaN total does not crash', gradeLetter(NaN) === 'F', gradeLetter(NaN))
check('negative total does not crash', gradeLetter(-5) === 'F', gradeLetter(-5))
check('default scale validates cleanly', validateScale(DEFAULT_SCALE).length === 0,
  JSON.stringify(validateScale(DEFAULT_SCALE)))
check('seven-point scale validates cleanly', validateScale(SEVEN_POINT_SCALE).length === 0,
  JSON.stringify(validateScale(SEVEN_POINT_SCALE)))

// A gap must be caught, or scores would silently have no grade.
const gapped = { id:'x', name:'gapped', bands:[
  { grade:'A', min:80, remark:'' }, { grade:'C', min:0, max:50, remark:'' } ] }
check('validateScale detects a gap between bands', validateScale(gapped).length > 0)

const overlapping = { id:'y', name:'overlap', bands:[
  { grade:'A', min:70, max:90, remark:'' }, { grade:'B', min:60, max:80, remark:'' },
  { grade:'F', min:0, max:59, remark:'' } ] }
check('validateScale detects overlapping bands', validateScale(overlapping).length > 0)

const noZero = { id:'z', name:'no-zero', bands:[{ grade:'A', min:40, remark:'' }] }
check('validateScale requires a band starting at 0', validateScale(noZero).length > 0)

// ── 12. Write routing (audit C1) ───────────────────────────────────────────
console.log('\n[12] Write routing')
const dsSrc = await import('../src/lib/dataSource')
check('dataSource exposes USE_SUPABASE', typeof dsSrc.USE_SUPABASE === 'boolean')
check('in demo mode USE_SUPABASE is false', dsSrc.USE_SUPABASE === false)
const writeNames = ['createStudent','updateStudent','deleteStudent','createTeacher','createClass',
  'updateClass','deleteClass','saveResult','deleteResult','saveAttendance',
  'publishAnnouncement','updateAnnouncement','deleteAnnouncement']
const missing = writeNames.filter(n => typeof (dsSrc.writes as any)[n] !== 'function')
check('every write operation exists on dataSource.writes', missing.length === 0, 'missing: ' + missing.join(', '))
check('writes.saveResult is callable', typeof dsSrc.writes.saveResult === 'function')

// Prove a write through `writes` actually lands in the store (demo path).
const beforeResults = store.get().results.length
await dsSrc.writes.saveResult({ studentId:'s2', studentName:'Joshua Wilson', subject:'French',
  term:'Second Term', session:'2024/2025', ca:20, exam:40, total:60, grade:'C' })
check('writes.saveResult persists in demo mode', store.get().results.length === beforeResults + 1)
check('...and the stored grade matches the scale',
  store.get().results.find(r => r.subject==='French' && r.term==='Second Term')?.grade === 'C')

// ── 10. Cleanup: reset restores the seed ───────────────────────────────────
console.log('\n[10] Reset')
store.reset()
const fresh = store.get()
check('reset restores 8 students', fresh.students.length === 8, 'got ' + fresh.students.length)
check('reset removes the test result', !fresh.results.some(r => r.id === 'r-2nd-term'))
check('reset removes the test attendance', !fresh.attendance.some(a => a.id === 'x1'))

console.log('\n' + '='.repeat(52))
console.log(`  ${pass} passed, ${fail} failed`)
console.log('='.repeat(52))
process.exit(fail === 0 ? 0 : 1)
