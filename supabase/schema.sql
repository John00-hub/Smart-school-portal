-- ============================================================================
-- SMARTSCHOOL — SUPABASE / POSTGRESQL SCHEMA
-- ============================================================================
-- Run this ENTIRE file in the Supabase SQL Editor (Dashboard > SQL Editor).
-- It is idempotent: safe to re-run.
--
-- Contents:
--   1. Enums & helper functions
--   2. Tables (15) with constraints, timestamps, indexes
--   3. Triggers (profile auto-creation, total/grade computation, audit log)
--   4. Row Level Security policies for all four roles
--   5. Seed data (optional — see seed.sql for full demo dataset)
--
-- SECURITY MODEL
--   * auth.uid() is the ONLY trusted identity. Never taken from the client.
--   * public.profiles.role is written ONLY by privileged triggers / admin RPCs.
--     There is no client-side UPDATE path that can escalate a role.
--   * Public signup can only ever create role = 'student'.
--   * Service-role key must NEVER appear in frontend code.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ENUMS & HELPERS
-- ────────────────────────────────────────────────────────────────────────────

do $$ begin
  create type user_role as enum ('admin','teacher','parent','student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('present','absent','late','excused');
exception when duplicate_object then null; end $$;

do $$ begin
  create type announcement_audience as enum ('all','teacher','parent','student');
exception when duplicate_object then null; end $$;

-- SECURITY DEFINER: reads profiles.role. Deliberately exposed to anon/authed
-- so RLS policies can ask "what role am I?" without exposing other rows.
create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'admin', false);
$$;

-- Can the calling teacher manage this class? (class teacher OR assigned to a subject)
create or replace function public.teacher_manages_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teacher_assignments ta
    where ta.class_id = p_class_id
      and ta.teacher_profile_id = auth.uid()
      and ta.is_active
  );
$$;

-- Is the calling parent linked to this student?
create or replace function public.parent_of_student(p_student_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parent_student_links l
    where l.parent_profile_id = auth.uid()
      and l.student_profile_id = p_student_profile_id
      and l.is_active
  );
$$;

-- Grade from total (CA 30 + Exam 70 = 100)
create or replace function public.grade_for_total(p_total numeric)
returns text
language sql
immutable
as $$
  select case
    when p_total >= 75 then 'A'
    when p_total >= 65 then 'B'
    when p_total >= 50 then 'C'
    when p_total >= 45 then 'D'
    when p_total >= 40 then 'E'
    else 'F'
  end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. TABLES
-- ────────────────────────────────────────────────────────────────────────────

-- 2.1 profiles — 1:1 with auth.users. Single source of truth for role.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        user_role not null default 'student',
  full_name   text not null,
  phone       text,
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_email_unique unique (email)
);
comment on table public.profiles is 'Role authority. Only admin RPCs and the signup trigger may set role.';

create index if not exists profiles_role_idx on public.profiles(role);

-- 2.2 academic_sessions
create table if not exists public.academic_sessions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,              -- e.g. '2025/2026'
  start_date  date not null,
  end_date    date not null,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint sessions_date_order check (end_date > start_date)
);

-- 2.3 terms
create table if not exists public.terms (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.academic_sessions(id) on delete cascade,
  name       text not null check (name in ('First Term','Second Term','Third Term')),
  start_date date not null,
  end_date   date not null,
  created_at timestamptz not null default now(),
  constraint terms_unique unique (session_id, name)
);

-- 2.4 classes
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.academic_sessions(id) on delete cascade,
  name        text not null,                     -- 'JSS 1'
  section     text not null default 'A',         -- 'A'
  level       text not null,                     -- 'Junior Secondary'
  capacity    integer not null default 40 check (capacity > 0),
  room        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint classes_unique unique (session_id, name, section)
);

create index if not exists classes_session_idx on public.classes(session_id);

-- 2.5 subjects
create table if not exists public.subjects (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,               -- 'MTH'
  name       text not null,                      -- 'Mathematics'
  ca_max     integer not null default 30 check (ca_max >= 0),
  exam_max   integer not null default 70 check (exam_max >= 0),
  created_at timestamptz not null default now()
);

-- 2.6 students
create table if not exists public.students (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid unique references public.profiles(id) on delete set null,
  admission_no  text not null unique,
  full_name     text not null,
  gender        text check (gender in ('Male','Female')),
  date_of_birth date,
  address       text,
  phone         text,
  enrollment_date date not null default current_date,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists students_profile_idx on public.students(profile_id);
create index if not exists students_name_idx on public.students(full_name);

-- 2.7 teachers
create table if not exists public.teachers (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid unique references public.profiles(id) on delete set null,
  employee_no   text not null unique,
  full_name     text not null,
  qualification text,
  department    text,
  phone         text,
  hire_date     date not null default current_date,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists teachers_profile_idx on public.teachers(profile_id);

-- 2.8 parents
create table if not exists public.parents (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid unique references public.profiles(id) on delete set null,
  full_name     text not null,
  occupation    text,
  address       text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists parents_profile_idx on public.parents(profile_id);

-- 2.9 parent_student_links  (many-to-many; a parent may have many children)
create table if not exists public.parent_student_links (
  id                 uuid primary key default gen_random_uuid(),
  parent_profile_id  uuid not null references public.profiles(id) on delete cascade,
  student_profile_id uuid not null references public.profiles(id) on delete cascade,
  relationship       text not null default 'parent'
                     check (relationship in ('father','mother','guardian','parent')),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  constraint parent_student_link_unique
    unique (parent_profile_id, student_profile_id)
);

create index if not exists psl_parent_idx  on public.parent_student_links(parent_profile_id);
create index if not exists psl_student_idx on public.parent_student_links(student_profile_id);

-- 2.10 teacher_assignments  (teacher <-> class <-> subject)
create table if not exists public.teacher_assignments (
  id                  uuid primary key default gen_random_uuid(),
  teacher_profile_id  uuid not null references public.profiles(id) on delete cascade,
  class_id            uuid not null references public.classes(id) on delete cascade,
  subject_id          uuid references public.subjects(id) on delete set null,
  is_class_teacher    boolean not null default false,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  constraint ta_unique
    unique (teacher_profile_id, class_id, subject_id)
);

create index if not exists ta_teacher_idx on public.teacher_assignments(teacher_profile_id);
create index if not exists ta_class_idx   on public.teacher_assignments(class_id);

-- 2.11 enrollments  (student <-> class)
create table if not exists public.enrollments (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  class_id     uuid not null references public.classes(id) on delete cascade,
  academic_year text not null default '2025/2026',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint enrollment_unique unique (student_id, class_id, academic_year)
);

create index if not exists enrollments_student_idx on public.enrollments(student_id);
create index if not exists enrollments_class_idx   on public.enrollments(class_id);

-- Capacity guard: a class can never exceed its capacity.
create or replace function public.enforce_class_capacity()
returns trigger language plpgsql as $$
declare v_count int; v_cap int;
begin
  if new.is_active then
    select count(*) into v_count from public.enrollments
      where class_id = new.class_id and is_active and id <> new.id;
    select capacity into v_cap from public.classes where id = new.class_id;
    if v_count + 1 > v_cap then
      raise exception 'Class is at full capacity (%).', v_cap;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_capacity on public.enrollments;
create trigger trg_enforce_capacity
  before insert or update on public.enrollments
  for each row execute function public.enforce_class_capacity();

-- 2.12 results  — UNIQUE prevents duplicate (student, subject, session, term)
create table if not exists public.results (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  subject_id    uuid not null references public.subjects(id) on delete cascade,
  session_id    uuid not null references public.academic_sessions(id) on delete cascade,
  term          text not null check (term in ('First Term','Second Term','Third Term')),
  ca_score      numeric not null default 0 check (ca_score between 0 and 30),
  exam_score    numeric not null default 0 check (exam_score between 0 and 70),
  total_score   numeric generated always as (ca_score + exam_score) stored,
  grade         text generated always as (public.grade_for_total(ca_score + exam_score)) stored,
  remarks       text,
  recorded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- ★ Duplicate prevention at the database level
  constraint results_unique_record
    unique (student_id, subject_id, session_id, term)
);

create index if not exists results_student_idx on public.results(student_id);
create index if not exists results_subject_idx on public.results(subject_id);
create index if not exists results_session_idx on public.results(session_id, term);

-- 2.13 attendance — UNIQUE prevents double-marking a student on a date
create table if not exists public.attendance (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  class_id     uuid not null references public.classes(id) on delete cascade,
  session_id   uuid references public.academic_sessions(id) on delete set null,
  record_date  date not null default current_date,
  status       attendance_status not null default 'present',
  remark       text,
  marked_by    uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint attendance_unique_record unique (student_id, record_date)
);

create index if not exists attendance_student_idx on public.attendance(student_id);
create index if not exists attendance_date_idx    on public.attendance(record_date);
create index if not exists attendance_class_idx   on public.attendance(class_id, record_date);

-- 2.14 timetables
create table if not exists public.timetables (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  subject_id   uuid not null references public.subjects(id) on delete cascade,
  day_of_week  integer not null check (day_of_week between 1 and 7),  -- 1 = Monday
  start_time   time not null,
  end_time     time not null,
  room         text,
  teacher_profile_id uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint timetables_time_order check (end_time > start_time),
  constraint timetable_no_clash
    unique (class_id, day_of_week, start_time, subject_id)
);

create index if not exists timetable_class_idx on public.timetables(class_id, day_of_week);

-- 2.15 announcements
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  content     text not null,
  audience    announcement_audience not null default 'all',
  author_id   uuid not null references public.profiles(id) on delete cascade,
  is_pinned   boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists announcements_audience_idx on public.announcements(audience, published_at desc);

-- 2.16 activity_logs  (append-only audit trail; only admin reads)
create table if not exists public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,          -- 'student.created', 'result.updated', ...
  entity_type text not null,
  entity_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_logs_created_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_actor_idx   on public.activity_logs(actor_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. TRIGGERS
-- ────────────────────────────────────────────────────────────────────────────

-- 3.1 updated_at maintenance
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','classes','students','teachers','parents',
                           'results','attendance','announcements']
  loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I', t);
    execute format(
      'create trigger trg_set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- 3.2 Auto-create a profile row for every new auth user.
--     SECURITY: a brand-new signup ALWAYS gets role='student'.
--     The role can only be changed later by an admin RPC (security definer).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role := 'student';
  v_name text := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
begin
  insert into public.profiles (id, email, role, full_name, phone, avatar_url)
  values (
    new.id,
    new.email,
    v_role,
    v_name,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3.3 Audit trail on sensitive writes
create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_action text; v_type text := tg_table_name; v_id uuid;
begin
  v_action := case
    when tg_op = 'INSERT' then v_type || '.created'
    when tg_op = 'UPDATE' then v_type || '.updated'
    when tg_op = 'DELETE' then v_type || '.deleted'
  end;
  v_id := case tg_op when 'DELETE' then old.id else new.id end;
  insert into public.activity_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), v_action, v_type, v_id,
          jsonb_build_object('op', tg_op, 'by_role', public.current_role()));
  return case tg_op when 'DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['students','teachers','classes','results','attendance','announcements','enrollments']
  loop
    execute format('drop trigger if exists trg_log_activity on public.%I', t);
    execute format(
      'create trigger trg_log_activity after insert or update or delete on public.%I
       for each row execute function public.log_activity()', t);
  end loop;
end $$;

-- 3.4 Teachers may only write results/attendance for classes they manage.
--     Defence in depth: RLS also blocks it, but this gives a clear error.
create or replace function public.guard_teacher_authorisation()
returns trigger language plpgsql as $$
declare v_student_profile uuid; v_class uuid;
begin
  if public.is_admin() then return new; end if;
  if public.current_role() <> 'teacher' then return new; end if;

  if tg_table_name = 'results' then
    select s.profile_id into v_student_profile from public.students s where s.id = new.student_id;
    select e.class_id into v_class
      from public.enrollments e
      where e.student_id = new.student_id and e.is_active
      order by e.created_at desc limit 1;
    if v_class is null or not public.teacher_manages_class(v_class) then
      raise exception 'Not authorised: you do not manage this student''s class.'
        using hint = 'RLS/authorisation guard';
    end if;
  elsif tg_table_name = 'attendance' then
    if not public.teacher_manages_class(new.class_id) then
      raise exception 'Not authorised: you do not manage class %.', new.class_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_results on public.results;
create trigger trg_guard_results
  before insert or update on public.results
  for each row execute function public.guard_teacher_authorisation();

drop trigger if exists trg_guard_attendance on public.attendance;
create trigger trg_guard_attendance
  before insert or update on public.attendance
  for each row execute function public.guard_teacher_authorisation();

-- ────────────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────────────────

alter table public.profiles             enable row level security;
alter table public.academic_sessions    enable row level security;
alter table public.terms                enable row level security;
alter table public.classes              enable row level security;
alter table public.subjects             enable row level security;
alter table public.students             enable row level security;
alter table public.teachers             enable row level security;
alter table public.parents              enable row level security;
alter table public.parent_student_links enable row level security;
alter table public.teacher_assignments  enable row level security;
alter table public.enrollments          enable row level security;
alter table public.results              enable row level security;
alter table public.attendance           enable row level security;
alter table public.timetables           enable row level security;
alter table public.announcements        enable row level security;
alter table public.activity_logs        enable row level security;

-- Helper: is this profile one of my linked children?
create or replace function public.is_my_child(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_student_links l
    where l.parent_profile_id = auth.uid()
      and l.student_profile_id = p_profile_id
      and l.is_active);
$$;

-- ═══ 4.1 profiles ═══════════════════════════════════════════════════════════
-- Everyone can READ basic directory info of authenticated users
-- (needed for joins: names, roles). Sensitive writes are admin-only.
drop policy if exists "profiles: readable by any authenticated user" on public.profiles;
create policy "profiles: readable by any authenticated user"
  on public.profiles for select
  to authenticated
  using (true);

-- Users may edit their OWN profile — but role is protected by a separate trigger below.
drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins may insert/update/delete any profile.
drop policy if exists "profiles: admin full" on public.profiles;
create policy "profiles: admin full"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ★ ANTI-ESCALATION: block any self-service change to `role`.
create or replace function public.block_role_self_change()
returns trigger language plpgsql as $$
begin
  if new.id = auth.uid() and new.role <> old.role then
    raise exception 'Privilege escalation blocked: role can only be changed by an administrator.'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_block_role_change on public.profiles;
create trigger trg_block_role_change
  before update on public.profiles
  for each row execute function public.block_role_self_change();

-- ═══ 4.2 students ═══════════════════════════════════════════════════════════
drop policy if exists "students: admin all" on public.students;
create policy "students: admin all" on public.students
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Teachers see students in their classes only.
drop policy if exists "students: teacher sees own class" on public.students;
create policy "students: teacher sees own class" on public.students
  for select to authenticated
  using (
    public.current_role() = 'teacher'
    and exists (
      select 1 from public.enrollments e
      where e.student_id = public.students.id
        and e.is_active
        and public.teacher_manages_class(e.class_id))
  );

-- Students see only themselves.
drop policy if exists "students: self read" on public.students;
create policy "students: self read" on public.students
  for select to authenticated
  using (public.current_role() = 'student' and profile_id = auth.uid());

-- Parents see only linked children.
drop policy if exists "students: parent sees linked children" on public.students;
create policy "students: parent sees linked children" on public.students
  for select to authenticated
  using (public.current_role() = 'parent' and public.is_my_child(profile_id));

-- ═══ 4.3 teachers ═══════════════════════════════════════════════════════════
drop policy if exists "teachers: admin all" on public.teachers;
create policy "teachers: admin all" on public.teachers
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "teachers: staff directory readable" on public.teachers;
create policy "teachers: staff directory readable" on public.teachers
  for select to authenticated using (true);

drop policy if exists "teachers: self update profile fields" on public.teachers;
create policy "teachers: self update profile fields" on public.teachers
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ═══ 4.4 parents ════════════════════════════════════════════════════════════
drop policy if exists "parents: admin all" on public.parents;
create policy "parents: admin all" on public.parents
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "parents: self read/update" on public.parents;
create policy "parents: self read/update" on public.parents
  for select to authenticated using (profile_id = auth.uid());

-- ═══ 4.5 parent_student_links ═══════════════════════════════════════════════
drop policy if exists "psl: admin all" on public.parent_student_links;
create policy "psl: admin all" on public.parent_student_links
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "psl: parent sees own links" on public.parent_student_links;
create policy "psl: parent sees own links" on public.parent_student_links
  for select to authenticated
  using (parent_profile_id = auth.uid());

drop policy if exists "psl: student sees own links" on public.parent_student_links;
create policy "psl: student sees own links" on public.parent_student_links
  for select to authenticated
  using (student_profile_id = auth.uid());

-- ═══ 4.6 classes / subjects / sessions / terms (reference data) ═════════════
drop policy if exists "reference: readable by authenticated" on public.classes;
create policy "reference: readable by authenticated" on public.classes
  for select to authenticated using (true);

drop policy if exists "classes: admin all" on public.classes;
create policy "classes: admin all" on public.classes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "subjects: readable by authenticated" on public.subjects;
create policy "subjects: readable by authenticated" on public.subjects
  for select to authenticated using (true);

drop policy if exists "subjects: admin all" on public.subjects;
create policy "subjects: admin all" on public.subjects
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sessions: readable by authenticated" on public.academic_sessions;
create policy "sessions: readable by authenticated" on public.academic_sessions
  for select to authenticated using (true);

drop policy if exists "sessions: admin all" on public.academic_sessions;
create policy "sessions: admin all" on public.academic_sessions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "terms: readable by authenticated" on public.terms;
create policy "terms: readable by authenticated" on public.terms
  for select to authenticated using (true);

drop policy if exists "terms: admin all" on public.terms;
create policy "terms: admin all" on public.terms
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ═══ 4.7 teacher_assignments ════════════════════════════════════════════════
drop policy if exists "ta: readable by authenticated" on public.teacher_assignments;
create policy "ta: readable by authenticated" on public.teacher_assignments
  for select to authenticated using (true);

drop policy if exists "ta: admin all" on public.teacher_assignments;
create policy "ta: admin all" on public.teacher_assignments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ═══ 4.8 enrollments ════════════════════════════════════════════════════════
drop policy if exists "enrollments: admin all" on public.enrollments;
create policy "enrollments: admin all" on public.enrollments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "enrollments: readable by authenticated" on public.enrollments;
create policy "enrollments: readable by authenticated" on public.enrollments
  for select to authenticated using (true);

-- ═══ 4.9 results ════════════════════════════════════════════════════════════
-- READ: own results (student) | linked children (parent) | own classes (teacher) | admin
drop policy if exists "results: read scoped" on public.results;
create policy "results: read scoped" on public.results
  for select to authenticated
  using (
    public.is_admin()
    or (public.current_role() = 'student'
        and student_id in (select id from public.students where profile_id = auth.uid()))
    or (public.current_role() = 'parent'
        and student_id in (
          select s.id from public.students s
          join public.parent_student_links l on l.student_profile_id = s.profile_id
          where l.parent_profile_id = auth.uid() and l.is_active))
    or (public.current_role() = 'teacher'
        and student_id in (
          select e.student_id from public.enrollments e
          where e.is_active and public.teacher_manages_class(e.class_id)))
  );

-- WRITE: admin, or the teacher who manages the student's class
drop policy if exists "results: teacher writes own class" on public.results;
create policy "results: teacher writes own class" on public.results
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.current_role() = 'teacher'
        and exists (
          select 1 from public.enrollments e
          where e.student_id = public.results.student_id
            and e.is_active
            and public.teacher_manages_class(e.class_id)))
  );

drop policy if exists "results: teacher updates own class" on public.results;
create policy "results: teacher updates own class" on public.results
  for update to authenticated
  using (
    public.is_admin()
    or (public.current_role() = 'teacher'
        and exists (
          select 1 from public.enrollments e
          where e.student_id = public.results.student_id
            and e.is_active
            and public.teacher_manages_class(e.class_id)))
  );

drop policy if exists "results: admin delete" on public.results;
create policy "results: admin delete" on public.results
  for delete to authenticated using (public.is_admin());

-- ═══ 4.10 attendance ════════════════════════════════════════════════════════
drop policy if exists "attendance: read scoped" on public.attendance;
create policy "attendance: read scoped" on public.attendance
  for select to authenticated
  using (
    public.is_admin()
    or (public.current_role() = 'student'
        and student_id in (select id from public.students where profile_id = auth.uid()))
    or (public.current_role() = 'parent'
        and student_id in (
          select s.id from public.students s
          join public.parent_student_links l on l.student_profile_id = s.profile_id
          where l.parent_profile_id = auth.uid() and l.is_active))
    or (public.current_role() = 'teacher' and public.teacher_manages_class(class_id))
  );

drop policy if exists "attendance: teacher writes own class" on public.attendance;
create policy "attendance: teacher writes own class" on public.attendance
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.current_role() = 'teacher' and public.teacher_manages_class(class_id))
  );

drop policy if exists "attendance: teacher updates own class" on public.attendance;
create policy "attendance: teacher updates own class" on public.attendance
  for update to authenticated
  using (
    public.is_admin()
    or (public.current_role() = 'teacher' and public.teacher_manages_class(class_id))
  );

drop policy if exists "attendance: admin delete" on public.attendance;
create policy "attendance: admin delete" on public.attendance
  for delete to authenticated using (public.is_admin());

-- ═══ 4.11 timetables ════════════════════════════════════════════════════════
drop policy if exists "timetables: readable by authenticated" on public.timetables;
create policy "timetables: readable by authenticated" on public.timetables
  for select to authenticated using (true);

drop policy if exists "timetables: admin all" on public.timetables;
create policy "timetables: admin all" on public.timetables
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ═══ 4.12 announcements ═════════════════════════════════════════════════════
drop policy if exists "announcements: audience scoped read" on public.announcements;
create policy "announcements: audience scoped read" on public.announcements
  for select to authenticated
  using (
    audience = 'all'
    or audience = public.current_role()
    or public.is_admin()
    or author_id = auth.uid()
  );

drop policy if exists "announcements: admin writes" on public.announcements;
create policy "announcements: admin writes" on public.announcements
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Teachers may publish to students/parents (not to 'all' or 'teacher')
drop policy if exists "announcements: teacher writes to students/parents" on public.announcements;
create policy "announcements: teacher writes to students/parents" on public.announcements
  for insert to authenticated
  with check (
    public.current_role() = 'teacher'
    and audience in ('student','parent')
    and author_id = auth.uid()
  );

-- ═══ 4.13 activity_logs ═════════════════════════════════════════════════════
drop policy if exists "logs: admin read only" on public.activity_logs;
create policy "logs: admin read only" on public.activity_logs
  for select to authenticated using (public.is_admin());
-- No insert/update/delete policies: writes happen via the SECURITY DEFINER
-- trigger only, so clients can neither forge nor erase audit entries.

-- ────────────────────────────────────────────────────────────────────────────
-- 5. PRIVILEGED RPCs (called from the frontend; run as SECURITY DEFINER)
--    These are the ONLY paths that create teacher/parent/admin accounts.
--    A self-signup user can never call them successfully unless already admin.
-- ────────────────────────────────────────────────────────────────────────────

-- 5.1 Admin creates a staff or parent account.
create or replace function public.admin_create_account(
  p_email text,
  p_password text,
  p_full_name text,
  p_role user_role,
  p_phone text default null,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user_id uuid; v_profile jsonb;
begin
  if not public.is_admin() then
    raise exception 'Forbidden: only administrators can create accounts.'
      using errcode = '42501';
  end if;

  if p_role not in ('teacher','parent','admin','student') then
    raise exception 'Invalid role.';
  end if;

  -- Creates the auth user. Requires the anon key + this function's definer rights.
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, recovery_token)
  values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    lower(p_email),
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'phone', p_phone) || p_meta,
    now(), now(), '', ''
  ) returning id into v_user_id;

  -- The on_auth_user_created trigger made a student profile; promote it.
  update public.profiles
     set role = p_role, full_name = p_full_name, phone = p_phone
   where id = v_user_id;

  -- Role-specific companion record
  if p_role = 'teacher' then
    insert into public.teachers (profile_id, employee_no, full_name, qualification, department, phone)
    values (v_user_id,
            coalesce(p_meta->>'employee_no', 'TCH-' || substr(v_user_id::text,1,8)),
            p_full_name, p_meta->>'qualification', p_meta->>'department', p_phone);
  elsif p_role = 'parent' then
    insert into public.parents (profile_id, full_name, occupation, address, phone)
    values (v_user_id, p_full_name, p_meta->>'occupation', p_meta->>'address', p_phone);
  end if;

  select to_jsonb(p) into v_profile from public.profiles p where p.id = v_user_id;
  return v_profile;
exception when unique_violation then
  raise exception 'An account with email % already exists.', p_email;
end $$;

-- 5.2 Admin links a parent to a child.
create or replace function public.admin_link_parent(
  p_parent_profile_id uuid,
  p_student_profile_id uuid,
  p_relationship text default 'parent'
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Forbidden: only administrators can link families.' using errcode = '42501';
  end if;
  insert into public.parent_student_links (parent_profile_id, student_profile_id, relationship)
  values (p_parent_profile_id, p_student_profile_id, p_relationship)
  on conflict (parent_profile_id, student_profile_id)
  do update set is_active = true, relationship = excluded.relationship
  returning id into v_id;
  return v_id;
end $$;

-- 5.3 Admin enrols a student into a class (capacity enforced by trigger).
create or replace function public.admin_enroll_student(
  p_student_id uuid, p_class_id uuid, p_academic_year text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Forbidden: only administrators can enrol students.' using errcode = '42501';
  end if;
  insert into public.enrollments (student_id, class_id, academic_year)
  values (p_student_id, p_class_id, p_academic_year)
  on conflict (student_id, class_id, academic_year)
  do update set is_active = true
  returning id into v_id;
  return v_id;
end $$;

-- 5.4 Admin assigns a teacher to a class/subject.
create or replace function public.admin_assign_teacher(
  p_teacher_profile_id uuid, p_class_id uuid,
  p_subject_id uuid default null, p_is_class_teacher boolean default false
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Forbidden: only administrators can assign teachers.' using errcode = '42501';
  end if;
  insert into public.teacher_assignments
    (teacher_profile_id, class_id, subject_id, is_class_teacher)
  values (p_teacher_profile_id, p_class_id, p_subject_id, p_is_class_teacher)
  on conflict (teacher_profile_id, class_id, subject_id)
  do update set is_active = true, is_class_teacher = excluded.is_class_teacher
  returning id into v_id;
  return v_id;
end $$;

-- 5.5 Teacher records a full class attendance sheet in one call.
create or replace function public.teacher_submit_attendance(
  p_class_id uuid,
  p_date date,
  p_entries jsonb   -- [{"student_id":"uuid","status":"present"}, ...]
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_row jsonb; v_count int := 0; v_session uuid;
begin
  if public.current_role() <> 'teacher' and not public.is_admin() then
    raise exception 'Forbidden: teachers only.' using errcode = '42501';
  end if;
  if not public.teacher_manages_class(p_class_id) and not public.is_admin() then
    raise exception 'Not authorised for this class.' using errcode = '42501';
  end if;

  select id into v_session from public.academic_sessions where is_current limit 1;

  for v_row in select * from jsonb_array_elements(p_entries)
  loop
    insert into public.attendance (student_id, class_id, session_id, record_date, status, marked_by)
    values (
      (v_row->>'student_id')::uuid,
      p_class_id,
      v_session,
      p_date,
      coalesce((v_row->>'status')::attendance_status, 'present'),
      auth.uid()
    )
    on conflict (student_id, record_date)
    do update set status = excluded.status, marked_by = excluded.marked_by;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- 5.6 Teacher upserts a result (duplicate-safe, authorisation-checked).
create or replace function public.teacher_upsert_result(
  p_student_id uuid, p_subject_id uuid, p_session_id uuid, p_term text,
  p_ca numeric, p_exam numeric, p_remarks text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if public.current_role() <> 'teacher' and not public.is_admin() then
    raise exception 'Forbidden: teachers only.' using errcode = '42501';
  end if;
  if not public.is_admin() and not exists (
       select 1 from public.enrollments e
        where e.student_id = p_student_id and e.is_active
          and public.teacher_manages_class(e.class_id)) then
    raise exception 'Not authorised: you do not manage this student''s class.' using errcode = '42501';
  end if;
  if p_ca < 0 or p_ca > 30 then raise exception 'CA score must be between 0 and 30.'; end if;
  if p_exam < 0 or p_exam > 70 then raise exception 'Exam score must be between 0 and 70.'; end if;

  insert into public.results (student_id, subject_id, session_id, term, ca_score, exam_score, remarks, recorded_by)
  values (p_student_id, p_subject_id, p_session_id, p_term, p_ca, p_exam, p_remarks, auth.uid())
  on conflict (student_id, subject_id, session_id, term)
  do update set ca_score = excluded.ca_score,
                exam_score = excluded.exam_score,
                remarks = excluded.remarks,
                recorded_by = excluded.recorded_by
  returning id into v_id;
  return v_id;
end $$;

-- 5.7 Parent: my linked children with summary stats (single round trip).
create or replace function public.my_children()
returns table (
  id uuid, full_name text, admission_no text, gender text,
  class_name text, class_section text,
  avg_total numeric, subject_count bigint,
  present_days bigint, total_days bigint, attendance_rate numeric
)
language sql stable security definer set search_path = public
as $$
  select
    s.id, s.full_name, s.admission_no, s.gender,
    c.name, c.section,
    (select round(avg(r.total_score),1) from public.results r where r.student_id = s.id),
    (select count(*) from public.results r where r.student_id = s.id),
    (select count(*) from public.attendance a where a.student_id = s.id and a.status = 'present'),
    (select count(*) from public.attendance a where a.student_id = s.id),
    (select case when count(*) = 0 then 0
                 else round(100.0 * count(*) filter (where status='present') / count(*), 1)
            end from public.attendance a where a.student_id = s.id)
  from public.students s
  join public.parent_student_links l
    on l.student_profile_id = s.profile_id and l.is_active and l.parent_profile_id = auth.uid()
  left join public.enrollments e on e.student_id = s.id and e.is_active
  left join public.classes c on c.id = e.class_id
  order by s.full_name;
$$;

-- 5.8 Teacher: classes I manage, with student counts.
create or replace function public.my_classes()
returns table (
  id uuid, name text, section text, level text, capacity integer,
  is_class_teacher boolean, enrolled bigint
)
language sql stable security definer set search_path = public
as $$
  select distinct c.id, c.name, c.section, c.level, c.capacity,
         bool_or(ta.is_class_teacher) as is_class_teacher,
         (select count(*) from public.enrollments e where e.class_id = c.id and e.is_active)
  from public.classes c
  join public.teacher_assignments ta
    on ta.class_id = c.id and ta.teacher_profile_id = auth.uid() and ta.is_active
  group by c.id, c.name, c.section, c.level, c.capacity;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. GRANTS  (PostgREST exposes these to anon/authenticated)
-- ────────────────────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant execute on all functions in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. BASE SEED (reference data only — demo records live in seed.sql)
-- ────────────────────────────────────────────────────────────────────────────
insert into public.subjects (code, name, ca_max, exam_max) values
  ('MTH','Mathematics',30,70),
  ('ENG','English Language',30,70),
  ('BSC','Basic Science',30,70),
  ('SOS','Social Studies',30,70),
  ('CSC','Computer Studies',30,70),
  ('FRE','French',30,70),
  ('ART','Creative Arts',30,70),
  ('BST','Business Studies',30,70),
  ('PHY','Physics',30,70),
  ('CHM','Chemistry',30,70),
  ('BIO','Biology',30,70),
  ('EKN','Economics',30,70)
on conflict (code) do nothing;

insert into public.academic_sessions (name, start_date, end_date, is_current) values
  ('2024/2025','2024-09-09','2025-07-31', true),
  ('2025/2026','2025-09-08','2026-07-31', false)
on conflict (name) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- REQUIRED SUPABASE PROJECT SETTINGS (Dashboard, not SQL)
-- ════════════════════════════════════════════════════════════════════════════
-- Authentication > Providers > Email : ENABLED
--   - "Confirm email" : ON for production, OFF for local demo
-- Authentication > URL Configuration
--   - Site URL        : http://localhost:5173   (your deployed URL in prod)
--   - Redirect URLs   : http://localhost:5173/**
-- API > Keys
--   - anon public key  -> VITE_SUPABASE_ANON_KEY   (safe in frontend)
--   - service_role key -> NEVER in frontend. Server/CI only.
-- ════════════════════════════════════════════════════════════════════════════
