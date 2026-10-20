/**
 * GRADING — single source of truth for grade boundaries.
 *
 * WHY THIS EXISTS
 * ---------------
 * Grade bands were previously hardcoded in two places that DISAGREED:
 *   - src/lib/store.ts   : A>=75, B>=65, C>=50, D>=40,       F
 *   - supabase/schema.sql: A>=75, B>=65, C>=50, D>=45, E>=40, F
 *
 * The same score therefore received a different grade in demo mode than in
 * live mode. Nigerian schools use varied scales, so the bands must be
 * configurable per school and read from one place.
 *
 * In LIVE MODE the bands come from the `grade_scales` table (per school).
 * In DEMO MODE the defaults below are used. Both paths call the same
 * `gradeFor()` function, so the frontend can never disagree with itself.
 *
 * IMPORTANT: the authoritative grade for a persisted result is computed by
 * Postgres, not here. This module is for live preview while a teacher types
 * and for rendering; the database remains the source of record.
 */

export interface GradeBand {
  grade: string
  /** Inclusive lower bound. */
  min: number
  /** Optional inclusive upper bound. Omit for the top band. */
  max?: number
  remark: string
}

export interface GradeScale {
  id: string
  name: string
  bands: GradeBand[]
}

/** Default scale matching the schema's seeded `grade_scales` row. */
export const DEFAULT_SCALE: GradeScale = {
  id: 'default',
  name: 'Standard 5-point (A–F)',
  bands: [
    { grade: 'A', min: 75, remark: 'Excellent' },
    { grade: 'B', min: 65, max: 74, remark: 'Very Good' },
    { grade: 'C', min: 50, max: 64, remark: 'Good' },
    { grade: 'D', min: 45, max: 49, remark: 'Pass' },
    { grade: 'E', min: 40, max: 44, remark: 'Weak Pass' },
    { grade: 'F', min: 0, max: 39, remark: 'Fail' },
  ],
}

/** A common alternative used by some Nigerian schools. */
export const SEVEN_POINT_SCALE: GradeScale = {
  id: 'seven-point',
  name: '7-point (A1–F9)',
  bands: [
    { grade: 'A1', min: 75, remark: 'Excellent' },
    { grade: 'B2', min: 70, max: 74, remark: 'Very Good' },
    { grade: 'B3', min: 65, max: 69, remark: 'Good' },
    { grade: 'C4', min: 60, max: 64, remark: 'Credit' },
    { grade: 'C5', min: 55, max: 59, remark: 'Credit' },
    { grade: 'C6', min: 50, max: 54, remark: 'Credit' },
    { grade: 'D7', min: 45, max: 49, remark: 'Pass' },
    { grade: 'E8', min: 40, max: 44, remark: 'Pass' },
    { grade: 'F9', min: 0, max: 39, remark: 'Fail' },
  ],
}

const FALLBACK: GradeBand = { grade: 'F', min: 0, max: 0, remark: 'Fail' }

/**
 * Resolve a grade for a total score against a scale.
 * Bands are matched by descending `min`, so the first band whose lower bound
 * the score meets wins — this is order-independent and safe against unsorted
 * input coming from the database.
 */
export function gradeFor(total: number, scale: GradeScale = DEFAULT_SCALE): GradeBand {
  if (!Number.isFinite(total)) return FALLBACK
  const sorted = [...scale.bands].sort((a, b) => b.min - a.min)
  for (const band of sorted) {
    if (total >= band.min && (band.max === undefined || total <= band.max)) {
      return band
    }
  }
  return FALLBACK
}

export function gradeLetter(total: number, scale: GradeScale = DEFAULT_SCALE): string {
  return gradeFor(total, scale).grade
}

export function gradeRemark(total: number, scale: GradeScale = DEFAULT_SCALE): string {
  return gradeFor(total, scale).remark
}

/** True if the grade counts as a pass (anything above the lowest band). */
export function isPass(total: number, scale: GradeScale = DEFAULT_SCALE): boolean {
  const lowest = [...scale.bands].sort((a, b) => a.min - b.min)[0]
  return gradeFor(total, scale).grade !== lowest?.grade
}

/**
 * Validate a scale before saving it.
 * Guards against the configuration errors that would silently misgrade:
 * overlapping bands, gaps, and out-of-range bounds.
 */
export function validateScale(scale: GradeScale): string[] {
  const errs: string[] = []
  if (!scale.bands.length) return ['A grade scale needs at least one band.']
  const sorted = [...scale.bands].sort((a, b) => b.min - a.min)
  const seen = new Set<string>()

  for (const b of sorted) {
    if (!b.grade?.trim()) errs.push('Every band needs a grade letter.')
    if (seen.has(b.grade)) errs.push(`Duplicate grade "${b.grade}".`)
    seen.add(b.grade)
    if (b.min < 0 || b.min > 100) errs.push(`Band ${b.grade}: lower bound must be 0–100.`)
    if (b.max !== undefined) {
      if (b.max < b.min) errs.push(`Band ${b.grade}: upper bound is below its lower bound.`)
      if (b.max > 100) errs.push(`Band ${b.grade}: upper bound must be <= 100.`)
    }
  }
  if (sorted[0].min !== 0 && sorted[sorted.length - 1].min !== 0) {
    // at least one band must accept 0
  }
  if (sorted[sorted.length - 1].min !== 0) {
    errs.push('The lowest band must start at 0 so every score has a grade.')
  }

  // Adjacency check. `sorted` is descending by min, so for each pair the band
  // BELOW must end exactly one point under the band ABOVE's lower bound.
  // Comparing the wrong ends here (upper.max vs lower.min) reports false
  // overlaps on every correct scale — caught by the test suite.
  for (let i = 0; i < sorted.length - 1; i++) {
    const above = sorted[i]
    const below = sorted[i + 1]
    const expected = above.min - 1
    if (below.max === undefined) continue          // open-ended band, nothing to check
    if (below.max !== expected) {
      errs.push(
        below.max < expected
          ? `Gap: scores ${below.max + 1}–${expected} have no grade (between ${below.grade} and ${above.grade}).`
          : `Overlap: ${below.grade} and ${above.grade} both cover ${expected + 1}–${below.max}.`
      )
    }
  }
  return errs
}
