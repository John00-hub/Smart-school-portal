# SmartSchool — Setup & Architecture

**Phase 2** — audited, repaired and prepared for controlled pilot testing.
See `AUDIT.md` for the full findings and `docs/` for deployment and migration
plans.

React + TypeScript + Tailwind CSS, backed by Supabase (Postgres, Auth, Row
Level Security). Four role dashboards: Administrator, Teacher, Parent, Student.

---

## 1. Two modes

| | Demo mode *(default)* | Live mode |
|---|---|---|
| Triggered by | No env vars set | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set |
| Data | Bundled dataset in `localStorage` | Your real Supabase tables |
| Writes | Local only | Postgres first, then re-read |
| Auth | Local check against demo users | Supabase Auth |
| Indicator | Login badge: **“Demo Mode — Local Data”** | Badge: **“Connected to Supabase”** |

Demo mode exists so you can inspect every screen without credentials. The
login page states which mode is active; password reset reports that it needs a
live connection rather than faking success.

---

## 2. Connect Supabase (≈10 minutes)

1. https://supabase.com/dashboard → **New project**.
2. **SQL Editor** → paste all of `supabase/schema.sql` → **Run**.
3. *(Optional demo data)* → paste `supabase/seed.sql` → **Run**.
4. *Authentication → Providers → Email* → enabled.
   - **Confirm email**: ON for production, OFF for a quick test.
5. *Authentication → URL Configuration*
   - **Site URL**: `http://localhost:5173` (your deployed origin in prod)
   - **Redirect URLs**: `http://localhost:5173/**`
6. Wire the frontend:
   ```bash
   cp .env.example .env    # fill in the two values
   npm install && npm run dev
   ```
   The login badge should read **“Connected to Supabase”**.

### Applying migration 0002 (multi-tenancy, grade scales, publishing)

**Read `docs/MIGRATION-STRATEGY.md` first and take a backup.** The migration
converts `results.grade` from a generated column and backfills every row into
a demo tenant. It is syntax-validated but **has not been executed against a
real database**.

```
SQL Editor → paste supabase/migrations/0002_multitenant_grading_publishing.sql → Run
```

The strategy document contains the pre-flight and post-flight SQL checks.

---

## 3. Demo accounts

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@greenfield.example` | `Admin123!` |
| Teacher | `teacher@greenfield.example` | `Teacher123!` |
| Teacher | `aisha.abdullahi@greenfield.example` | `Teacher123!` |
| Parent | `parent@greenfield.example` | `Parent123!` |
| Parent | `abdullahi.musa@greenfield.example` | `Parent123!` |
| Student | `student@greenfield.example` | `Student123!` |

Change these before any real use. In demo mode the login page has one-tap
buttons that fill each set.

---

## 4. Security model

Frontend routing is convenience, not the boundary. Five independent layers:

**a) Role is not client-controlled.** The `handle_new_user()` trigger always
assigns `'student'`. Public signup has no role parameter.

**b) Self-escalation blocked by trigger.** `trg_block_role_change` raises
SQLSTATE 42501 if a user updates their own `role`.

**c) RLS filters every row per role.** 41 policies in 0001, plus tenant
isolation in 0002. Parents see only linked children; teachers only classes
they manage; students only themselves. `activity_logs` has no write policy at
all, so audit entries cannot be forged or erased.

**d) Privileged actions go through `SECURITY DEFINER` RPCs.**
`admin_create_account`, `admin_link_parent`, `admin_enroll_student`,
`admin_assign_teacher`, `teacher_upsert_result`, `teacher_submit_attendance`,
`teacher_publish_results` — each re-checks authorisation server-side.

**e) Tenant isolation is RESTRICTIVE.** In 0002, tenant policies are
`AS RESTRICTIVE`, so they AND with the role policies. A permissive policy
would have *widened* access instead of narrowing it — the most important
detail in the migration.

Constraint-level guarantees:

- `results_unique_record (student_id, subject_id, session_id, term)` — no duplicate results.
- `attendance_unique_record (student_id, record_date)` — no double-marking.
- `enforce_class_capacity` trigger — enrolment past capacity is rejected.
- `guard_result_publish` — only authorised teachers can publish.

**The `service_role` key is used nowhere in this project** and must never be
added to the frontend. Verify before deploying:

```bash
grep -r "service_role" dist/ && echo "LEAKED" || echo "clean"
```

---

## 5. Academic configuration

| Concern | Where |
|---|---|
| Grade boundaries | `grade_scales` + `grade_bands` tables (per school), mirrored in `src/lib/grading.ts` |
| CA / exam weighting | `subjects.ca_max` / `exam_max` (30 / 70 by default) |
| Sessions & terms | `academic_sessions`, `terms` |
| Publishing | `results.is_published` — defaults to **false** |

**Results are not visible to parents or students until published.** This
prevents half-entered sheets from leaking. Use `teacher_publish_results()` to
release a whole class/subject/term at once.

Grade bands are now read from `src/lib/grading.ts` in the frontend and
`grade_from_scale()` in the database. Both agree on A≥75, B≥65, C≥50, D≥45,
E≥40, F. (Phase 1 had two disagreeing scales — see `AUDIT.md` H3.)

---

## 6. Scripts

```bash
npm run dev         # dev server on :5173
npm run build       # typecheck (tsc -b) + production bundle
npm run preview     # serve the build
npm test            # assertions over the real store/grading/dataSource modules
npm run check:sql   # parse all SQL with the PostgreSQL parser + RLS coverage
```

`npm test` bundles the actual TypeScript with esbuild and runs it under
jsdom — the shipped modules, not a reimplementation.

`npm run check:sql` uses `libpg-query` (the real PostgreSQL 18 parser in
WASM). It parses every statement *and* every function body with its true
signature, verifies `drop`/`create policy` pairing, and confirms no
RLS-enabled table was left without a policy.

> These validate syntax and policy wiring only. They cannot check semantics
> that require a running database.

---

## 7. Verification status

**Automated — actually run:**

| Check | Result |
|---|---|
| `npm run build` (tsc + vite) | ✅ clean |
| `npm test` | ✅ 67/67 |
| `npm run check:sql` | ✅ 3 SQL files, all functions parse, RLS coverage ok |
| `node test/mobile.mjs` | ✅ 30 pages at 360px, 0 horizontal overflow |
| `node test/touch-check.mjs` | ✅ 0 sub-24px tap targets; report card PDF renders |
| `npx oxlint src` | ⚠️ warnings, 0 errors |

**LIVE-PENDING — cannot be verified without a real Supabase project:**

1. That RLS policies return the intended row sets per role.
2. That any query in `supabaseService.ts` matches the real schema.
3. That `admin_create_account` can insert into `auth.users` — this depends on
   Supabase's internal `auth` schema permissions, which vary by project and
   often require running as the `postgres` role.
4. Migration 0002 executing successfully and preserving grades.
5. Cross-tenant isolation actually holding.
6. Realtime subscriptions, password-reset delivery, live CRUD.

**A passing build is not production readiness.** Items 1–6 must be tested
against a provisioned project before any real school data is entered.

---

## 8. Known limitations

1. **Live mode is unexercised.** No credentials were available; no query has
   been run against a database.
2. **No frontend tenant awareness.** Reads are scoped by `current_school_id()`
   in live mode, but there is no UI to switch schools or manage branding.
3. **Migration 0002 not executed.** Syntax-validated only.
4. **Report card is screen+print only.** No PDF generation server-side.
5. **Admin teacher management is create-only** — no edit or deactivate yet.
6. **No error boundary.** A render error blanks the app.
7. **Bundle ~600 kB un-split.** Route-level code splitting is the obvious next step.
8. **`terms` and `activity_logs`** have no UI.

---

## 9. Layout

```
smartschool/
├── supabase/
│   ├── schema.sql                              0001 — 16 tables, 41 RLS policies
│   ├── seed.sql                                optional demo dataset
│   └── migrations/
│       └── 0002_multitenant_grading_publishing.sql
├── src/
│   ├── components/ReportCard.tsx               printable report card
│   ├── context/AuthContext.tsx                 session, role, mode
│   ├── lib/
│   │   ├── supabase.ts                         lazy client + types
│   │   ├── store.ts                            demo dataset + cache
│   │   ├── grading.ts                          grade scales (single source)
│   │   ├── supabaseService.ts                  real auth / queries / mutations
│   │   └── dataSource.ts                       mode switch + write-through
│   ├── App.tsx                                 landing, login, 4 dashboards
│   └── index.css                               Tailwind + print styles
├── test/smoke.ts                               automated assertions
├── validate_sql.cjs / check_policies.cjs       SQL verification
├── vercel.json                                 SPA rewrite + headers
├── AUDIT.md                                    Phase 2 audit findings
└── docs/
    ├── MIGRATION-STRATEGY.md                   multi-tenancy plan + rollback
    └── OCI-DEPLOYMENT.md                       Ubuntu/Nginx/HTTPS guide
```

Design tokens: primary `#166534`, primary-dark `#14532D`, primary-light
`#DCFCE7`, accent `#22C55E`, background `#F8FAFC`, white surfaces, Inter body /
Plus Jakarta Sans headings. Defined as CSS variables in `src/index.css`, exposed
to Tailwind as `brand.*` in `tailwind.config.js`.
