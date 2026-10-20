# SmartSchool — Phase 2 Audit

**Audited:** 2026-10-19 · commit `5a97b17` (Phase 1 baseline)
**Method:** full read of `src/**` and `supabase/**`, plus execution of every
available automated check. Line numbers below refer to the baseline commit.

## Baseline (what actually passes today)

| Check | Result |
|---|---|
| `npm run build` (tsc + vite) | ✅ clean |
| `npm test` | ✅ 46/46 |
| `npm run check:sql` | ✅ 180 stmts, 20 fns, RLS coverage ok |
| `npx oxlint src` | ⚠️ 9 warnings, 0 errors |

**A passing build does not mean the product works.** The defects below are all
invisible to those checks, which is exactly why the audit was necessary.

---

## CRITICAL — blocks pilot use

### C1. Live Mode never writes to Supabase. The entire write layer is dead code.

`src/lib/dataSource.ts` exports a `writes` object containing the real
write-through functions. **Nothing imports it.**

```
$ grep -n "dataSource\|writes\." src/App.tsx     → no matches
$ grep -rn "from '../lib/dataSource'" src/       → AuthContext.tsx only
```

All 12 mutation sites in `App.tsx` call the demo store directly:

| Line | Operation | Calls |
|---|---|---|
| 672 | delete student | `store.deleteStudent` |
| 749 | edit student | `store.updateStudent` |
| 765 | register student | `store.addStudent` |
| 865 | add teacher | `store.addTeacher` |
| 877 | create teacher login | `store.addUser` |
| 930 | delete class | `store.deleteClass` |
| 946–947 | create/edit class | `store.updateClass` / `store.addClass` |
| 1005 | delete announcement | `store.deleteAnnouncement` |
| 1024–1025 | publish announcement | `store.addAnnouncement` |
| 1181 | delete result | `store.deleteResult` |
| 1209 | enter result | `store.addResult` |
| 1288 | mark attendance | `store.addAttendance` |

**Consequence:** with real Supabase credentials configured, reads would come
from Postgres but **every write would silently go to `localStorage` only**.
A teacher entering results would see a success toast and the parent would see
nothing. This is the single most serious defect in the project.

**Correction to prior documentation:** Phase 1's `SETUP.md` §7 stated that
"students, classes, results, attendance and announcements are wired." That was
false — none of them were. The `writes` layer existed but was unreachable.

**Fix:** route every mutation through `writes`, with the error surfaced to the
user. No silent fallback.

---

### C2. Cross-user data exposure — student dashboard shows the wrong child

Four components fall back to the *first student in the array* when identity
mapping fails:

```
1496  const me = data.students.find(s => s.email.toLowerCase() === user?.email.toLowerCase()) || data.students[0]
1567  (same)
1595  (same)
1623  (same)
```

If a signed-in student's email does not match a `students.email` value, the
UI renders **another student's grades, attendance and timetable** as if they
were the user's own.

Why the match fails: in live mode `queries.students()` derives
`students.email` from `profiles.email`, but a student row may have no linked
profile (`profile_id IS NULL`) — the common case, since most students do not
have login accounts. The fallback then triggers.

In live mode RLS limits what is *fetched*, so the blast radius is smaller, but
in demo mode this is a genuine leak, and the pattern is wrong regardless.

**Fix:** map identity by `profile_id`, and render an explicit
"no linked record" state instead of falling back to another user's data.

---

### C3. No SPA rewrite — deep links 404 on Vercel

No `vercel.json` exists. Opening `https://site/teacher/results` directly
returns Vercel's 404 because there is no such file on disk. Only `/` works.

**Fix:** add `vercel.json` with a rewrite of all paths to `/index.html`.

---

### C4. Teacher account creation is broken in live mode

`AdminTeachers` (line 877) does:

```ts
store.addUser({ id: 'u-' + Date.now(), email, password: 'Teacher123!', role: 'teacher', ... })
```

This writes a **plaintext password into `localStorage`** and creates no
`auth.users` row. In live mode the teacher cannot log in — the account does
not exist. The amber notice on the form ("Login will be created with default
password") describes behaviour that does not happen against a real database.

**Fix:** call `mutations.createAccount()` → the `admin_create_account` RPC,
which already exists and is correctly guarded. Demo mode keeps its local path.

---

## HIGH — significant functional gaps

### H1. `@ts-ignore` masks a real type error

Line 1287:
```ts
// @ts-ignore
store.addAttendance(toSave)
```
`toSave` includes `marked_by`, which is not on `AttendanceRecord`. The ignore
hides a genuine interface mismatch rather than fixing it.

### H2. No tenant/school model — blocks commercialization entirely

`grep -c "school_id\|schools" supabase/schema.sql` → **0**.

Every table is global. Two schools sharing one project would see each other's
students, results and announcements. Selling to multiple Nigerian private
schools is impossible without this.

**Constraint on how to add it:** `results.grade` is a
`GENERATED ALWAYS AS (grade_for_total(...)) STORED` column (schema.sql:306).
Once grade boundaries become per-school configurable (H3), a stored generated
column can no longer express them — it would need recomputation whenever a
school edits its scale. The migration must therefore convert `grade` to a
computed-on-write value. This is a real schema implication, not a detail.

### H3. Grade boundaries hardcoded in two places

- `src/lib/store.ts:320` — `gradeFromTotal()` (A≥75, B≥65, C≥50, D≥40, else F)
- `supabase/schema.sql:95` — `grade_for_total()` (A≥75, B≥65, C≥50, D≥45, E≥40, F)

These **already disagree** (D and E bands differ), so demo mode and live mode
assign different grades to the same score. Nigerian schools use varied scales;
this must be configurable per school and sourced from one place.

### H4. No printable report card

`grep -i "print"` in App.tsx → 1 incidental match. There is no report-card
view and no print stylesheet. Schools require a printable term report.

### H5. Results can be published accidentally

There is no draft/published state on `results`. A parent can see a score the
moment a teacher saves it — including a half-entered sheet. The requirement is
that results stay hidden until deliberately released.

### H6. `App.tsx` is 1726 lines

One file holds the landing page, login, all four dashboards, nine sub-pages,
and six modal forms. Every change risks unrelated regressions, and the file is
the main obstacle to the reusable-component requirement.

---

## MEDIUM

| # | Finding | Detail |
|---|---|---|
| M1 | Demo/Live divergence untested | No test exercises the live path; `writes` is untested because it is unreachable |
| M2 | Password reset UX | `LoginPage` calls `resetPassword` but no `/reset-password` route exists to complete the flow |
| M3 | Accessibility | 24 `label`/`aria-label` occurrences across ~40 form controls; several selects and icon-only buttons are unlabelled |
| M4 | Hardcoded session string | `'2024/2025'` literal in several places; should read the current `academic_sessions` row |
| M5 | `store.addUser` stores passwords | Acceptable for a local demo, but the `password` field must never reach the live path |
| M6 | Attendance status enum mismatch | Schema has 4 values incl. `excused`; UI maps `excused` → `absent`, silently misrepresenting data |
| M7 | No error boundary | A render error anywhere blanks the whole app |

---

## LOW

- L1. `hero.png` (13 KB) is imported nowhere — dead asset.
- L2. oxlint reports 9 warnings, mostly `set-state-in-effect`.
- L3. Bundle ~597 kB un-split; no route-level code splitting.
- L4. `README.md`/`SETUP.md` describe the Vercel deploy but no config file exists.

---

## Verified as working (do not break)

- Landing page, login, role redirect, protected routes — all correct.
- Grading boundaries in `store.ts` pass all 10 boundary tests.
- Duplicate-result prevention and attendance upsert semantics are correct.
- RLS policy set is coherent: 41 policies, every RLS table has ≥1 policy,
  drop/create names are paired.
- Anti-escalation trigger, capacity trigger, teacher-authorisation guard and
  the `admin_*` RPC guards are all present and syntactically valid.

---

## What cannot be verified without a live Supabase project

Stated plainly — none of the following has been executed against a database:

1. That the RLS policies return the intended row sets per role.
2. That any query in `supabaseService.ts` matches the real schema.
3. That `admin_create_account` successfully inserts into `auth.users`
   (this depends on Supabase's internal `auth` schema permissions, which vary
   by project and often require the SQL to run as the `postgres` role).
4. Realtime subscriptions, password-reset email delivery, or live CRUD.

These require a provisioned project. They are marked **LIVE-PENDING** wherever
they appear in the code and docs. I will not report them as passing.

---

## Repair order

1. **C1** — wire `writes` into all 12 mutation sites (fixes the core defect)
2. **C3** — `vercel.json`
3. **C2** — identity mapping + no-fallback states
4. **C4** — teacher account creation via RPC
5. **H1** — remove `@ts-ignore`
6. **H3** — single configurable grade scale
7. **H5** — draft/publish results
8. **H4** — printable report card
9. **H6** — split `App.tsx` into components
10. **H2** — tenant model + documented migration (design first, per instruction)
