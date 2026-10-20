# SmartSchool — School Management Portal

Role-based school management portal with four dashboards (Administrator,
Teacher, Parent, Student). React + TypeScript + Tailwind CSS, backed by
Supabase (Postgres, Auth, Row Level Security).

**→ Full setup, security model and known limits: [SETUP.md](SETUP.md)**

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Runs immediately in **demo mode** on a bundled dataset — no credentials
needed. Add Supabase keys to switch to a live database (see SETUP.md §2).

### Demo logins

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@greenfield.example` | `Admin123!` |
| Teacher | `teacher@greenfield.example` | `Teacher123!` |
| Parent | `parent@greenfield.example` | `Parent123!` |
| Student | `student@greenfield.example` | `Student123!` |

---

## Features

- **Landing page** — hero, features, role overview, footer
- **Auth** — email/password, persistent sessions, password reset, role-based
  redirect, protected routes
- **Admin** — dashboard stats, student CRUD + search/filter, teacher directory,
  class management with enrolment capacity, announcements
- **Teacher** — assigned classes only, student lists, results entry
  (CA 30 + Exam 70 with live grade preview), daily attendance marking
- **Parent** — switch between multiple children, results, attendance,
  performance summary
- **Student** — results, attendance, weekly timetable, announcements, GPA
- **UI** — responsive from phone to desktop, collapsible sidebar, mobile
  drawer, toasts, confirmation dialogs, empty states, loading states

---

## Scripts

```bash
npm run dev         # dev server
npm run build       # typecheck + production bundle
npm run preview     # serve the build
npm test            # 46 assertions over the real store/grading/auth modules
npm run check:sql   # parse schema.sql + seed.sql with the PostgreSQL parser,
                    # verify RLS coverage and policy drop/create pairing
```

`npm test` bundles the actual TypeScript source with esbuild and runs it under
jsdom — it exercises the shipped modules, not a reimplementation.

`npm run check:sql` uses `libpg-query` (the real PostgreSQL 18 parser compiled
to WASM) to parse every statement *and* every function body with its true
signature, then asserts no RLS-enabled table was left without a policy.

---

## Project layout

```
supabase/
  schema.sql            16 tables · 20 functions · 41 RLS policies · triggers
  seed.sql              optional demo dataset
src/
  lib/
    supabase.ts         lazy Supabase client + shared types
    store.ts            demo dataset + localStorage cache
    supabaseService.ts  real auth / queries / mutations
    dataSource.ts       mode switch + write-through writes
  context/AuthContext.tsx
  App.tsx               landing · login · 4 dashboards · routing
test/
  smoke.ts              46 assertions over the real modules
  run-smoke.mjs         jsdom harness
validate_sql.cjs        PostgreSQL parser check
check_policies.cjs      RLS coverage check
```

---

## Design tokens

Colours are defined once as CSS variables in `src/index.css` and exposed to
Tailwind as `brand.*` tokens in `tailwind.config.js`. Change them there — not
in components.

| Token | CSS variable | Tailwind class | Value |
|---|---|---|---|
| Primary | `--brand-primary` | `bg-brand` | `#166534` |
| Primary dark | `--brand-primary-dark` | `bg-brand-dark` | `#14532D` |
| Primary light | `--brand-primary-light` | `bg-brand-light` | `#DCFCE7` |
| Accent | `--brand-accent` | `bg-brand-accent` | `#22C55E` |
| Background | `--brand-background` | `bg-brand-background` | `#F8FAFC` |
| Surface | `--brand-surface` | `bg-white` | `#FFFFFF` |
| Text | `--brand-text` | `text-slate-900` | `#0F172A` |

School identity (name, motto, logo, contact details, colours, session) lives in
`src/lib/branding.ts`. Onboarding a new school means editing that one file —
auth, dashboards and academic logic are untouched.


---

## Security summary

Role is never client-controlled: the signup trigger always assigns `student`,
a before-update trigger blocks self-escalation, 41 RLS policies filter every
row per role, and privileged operations run through `SECURITY DEFINER` RPCs
that re-check `is_admin()`. Duplicate results and double-marked attendance are
rejected by unique constraints in Postgres. Details in SETUP.md §4.

The `service_role` key is not used anywhere in this project and must never be
added to the frontend.
