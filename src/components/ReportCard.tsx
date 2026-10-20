/**
 * Printable student report card.
 *
 * Audit item H4: schools need a printable term report. This renders an
 * A4-oriented report that prints cleanly (see the @media print block in
 * index.css) while staying on-brand on screen.
 *
 * Accessible to a student for themselves, a parent for a linked child, and a
 * teacher/admin for students in their scope. The caller is responsible for
 * only passing records the signed-in user is entitled to see — the database
 * enforces that in live mode via RLS.
 */
import { Printer, Download } from 'lucide-react'
import { gradeRemark, type GradeScale, DEFAULT_SCALE } from '../lib/grading'
import type { ResultRecord, AttendanceRecord, StudentRecord } from '../lib/store'
import { activeSchool, schoolInitials } from '../lib/branding'

interface Props {
  student: StudentRecord
  results: ResultRecord[]
  attendance?: AttendanceRecord[]
  term?: string
  session?: string
  teacherName?: string
  principalName?: string
  schoolName?: string
  scale?: GradeScale
  /** Hide the on-screen toolbar when already inside a print flow. */
  bare?: boolean
}

const positionOf = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function ReportCard({
  student, results, attendance = [], term = 'First Term', session = '2024/2025',
  teacherName, principalName, schoolName = activeSchool.schoolName, scale = DEFAULT_SCALE, bare = false,
}: Props) {
  // Only results for the requested term/session belong on this report.
  const scoped = results.filter(
    r => (term === 'All Terms' || r.term === term) && (session === 'All Sessions' || r.session === session)
  )

  const totals = scoped.map(r => r.total)
  const average = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0
  const highest = totals.length ? Math.max(...totals) : 0
  const lowest = totals.length ? Math.min(...totals) : 0

  const present = attendance.filter(a => a.status === 'present').length
  const late = attendance.filter(a => a.status === 'late').length
  const absent = attendance.filter(a => a.status === 'absent').length
  const schoolDays = attendance.length
  const attendancePct = schoolDays ? Math.round(((present + late) / schoolDays) * 100) : 0

  const remarksFor = (total: number) => {
    const r = gradeRemark(total, scale)
    if (total >= 75) return 'Excellent performance. Keep it up.'
    if (total >= 65) return 'Very good. A little more effort will reach the top.'
    if (total >= 50) return 'Good. Consolidate with regular revision.'
    if (total >= 45) return 'Fair. Needs more attention and practice.'
    return `Below expectations — ${r.toLowerCase()}. Please see the class teacher.`
  }

  const overallRemark =
    average >= 75 ? 'An outstanding term. Congratulations.'
    : average >= 65 ? 'A very good term. Aim higher next term.'
    : average >= 50 ? 'A satisfactory term. More consistent effort is needed.'
    : average > 0 ? 'Performance is below expectation. A meeting with the class teacher is advised.'
    : 'No results recorded for this term.'

  return (
    <div>
      {!bare && (
        <div className="no-print flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => window.print()}
            className="px-5 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm flex items-center gap-2"
          >
            <Printer size={16} /> Print report card
          </button>
          <span className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-600 flex items-center gap-2">
            <Download size={16} /> Use your browser's "Save as PDF" in the print dialog
          </span>
        </div>
      )}

      <article className="print-area bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-[820px] mx-auto">
        {/* Header */}
        <header className="text-center border-b-2 border-brand pb-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand flex items-center justify-center text-white font-extrabold text-lg">
              {activeSchool.logoUrl
                ? <img src={activeSchool.logoUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                : schoolInitials}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-brand tracking-tight">{schoolName}</h1>
              <p className="text-xs text-slate-500 uppercase tracking-widest">Student Terminal Report</p>
          {activeSchool.motto && <p className="text-[11px] italic text-slate-400 mt-0.5">{activeSchool.motto}</p>}
            </div>
          </div>
        </header>

        {/* Student details */}
        <section className="grid sm:grid-cols-2 gap-x-8 gap-y-2 mt-5 text-sm">
          <Detail label="Student name" value={student.full_name} />
          <Detail label="Admission no." value={student.admission_no} />
          <Detail label="Class" value={student.class_name} />
          <Detail label="Gender" value={student.gender || '—'} />
          <Detail label="Term" value={term} />
          <Detail label="Academic session" value={session} />
          <Detail label="Class teacher" value={teacherName || '—'} />
          <Detail label="Date of birth" value={student.dob || '—'} />
        </section>

        {/* Summary */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <Metric label="Average" value={totals.length ? average.toFixed(1) : '—'} />
          <Metric label="Highest" value={totals.length ? String(highest) : '—'} />
          <Metric label="Lowest" value={totals.length ? String(lowest) : '—'} />
          <Metric label="Subjects" value={String(scoped.length)} />
        </section>

        {/* Results table */}
        <section className="mt-6 print-break">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-2">Academic performance</h2>
          {scoped.length === 0 ? (
            <p className="text-sm text-slate-500 border border-dashed border-slate-300 rounded-xl p-6 text-center">
              No results recorded for {term}, {session}.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1 print:overflow-visible print:mx-0 print:px-0">
            <table className="w-full min-w-[560px] print:min-w-0">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th className="text-center">CA (30)</th>
                  <th className="text-center">Exam (70)</th>
                  <th className="text-center">Total</th>
                  <th className="text-center">Grade</th>
                  <th>Teacher's remark</th>
                </tr>
              </thead>
              <tbody>
                {scoped.map(r => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.subject}</td>
                    <td className="text-center">{r.ca_score}</td>
                    <td className="text-center">{r.exam_score}</td>
                    <td className="text-center font-bold">{r.total}</td>
                    <td className="text-center font-bold">{r.grade}</td>
                    <td className="text-xs">{remarksFor(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </section>

        {/* Attendance */}
        <section className="mt-6 print-break">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-2">Attendance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Metric label="School days" value={String(schoolDays)} />
            <Metric label="Present" value={String(present)} />
            <Metric label="Late" value={String(late)} />
            <Metric label="Absent" value={String(absent)} />
            <Metric label="Rate" value={`${attendancePct}%`} />
          </div>
        </section>

        {/* Remarks */}
        <section className="mt-6 print-break">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-2">Class teacher's remark</h2>
          <p className="text-sm text-slate-700 border border-slate-300 rounded-xl p-4">{overallRemark}</p>
        </section>

        {/* Signatures */}
        <section className="mt-10 grid sm:grid-cols-2 gap-8 print-break">
          <div>
            <div className="border-t border-slate-400 pt-1 text-xs text-slate-600">
              Class teacher{teacherName ? ` — ${teacherName}` : ''}
            </div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1 text-xs text-slate-600">
              Principal{principalName ? ` — ${principalName}` : ''}
            </div>
          </div>
        </section>

        <footer className="mt-8 pt-3 border-t border-slate-200 text-center text-[11px] text-slate-400">
          Generated {new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
          {' · '}This report is unofficial until signed by the class teacher and principal.
        </footer>
      </article>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900 text-right">{value}</span>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 text-center bg-brand-background">
      <div className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">{label}</div>
      <div className="text-lg font-extrabold text-slate-900 mt-0.5">{value}</div>
    </div>
  )
}

export { positionOf }
