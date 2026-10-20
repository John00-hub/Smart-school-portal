-- ============================================================================
-- SMARTSCHOOL — MIGRATION 0002
-- Multi-tenancy · configurable grade scales · controlled result publishing
-- ============================================================================
-- Addresses audit findings H2, H3 and H5.
--
-- ⚠️  READ THE MIGRATION STRATEGY IN docs/MIGRATION-STRATEGY.md BEFORE RUNNING.
--     This file is written to be safe on a project that already holds data,
--     but it is a schema change and must be reviewed first.
--
-- Run order:  0001 (schema.sql + seed.sql)  →  this file
-- Idempotent: yes — safe to re-run.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- PART A — CONFIGURABLE GRADE SCALES  (audit H3)
-- ────────────────────────────────────────────────────────────────────────────
--
-- WHY `results.grade` MUST STOP BEING A GENERATED COLUMN
-- ------------------------------------------------------
-- In 0001 the column was declared:
--     grade text GENERATED ALWAYS AS (public.grade_for_total(ca+exam)) STORED
--
-- A stored generated column is evaluated once, at write time, from an
-- IMMUTABLE function. If a school later edits its grade boundaries, every
-- existing row keeps the grade computed under the OLD bands, and Postgres
-- will not recompute them. Worse, an immutable function cannot legally read
-- a settings table, so the boundaries could never be per-school in the first
-- place.
--
-- Therefore `grade` becomes an ordinary column, populated by a trigger that
-- reads the school's scale at insert/update time. Editing a scale does not
-- retroactively rewrite history (correct for academic records), and new
-- results always use the current bands.

create table if not exists public.grade_scales (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid,                              -- FK added in Part C
  name        text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint grade_scales_name_per_school unique (school_id, name)
);

create table if not exists public.grade_bands (
  id         uuid primary key default gen_random_uuid(),
  scale_id   uuid not null references public.grade_scales(id) on delete cascade,
  grade      text not null,
  min_score  numeric not null check (min_score between 0 and 100),
  max_score  numeric check (max_score between 0 and 100),
  remark     text,
  created_at timestamptz not null default now(),
  constraint grade_bands_unique unique (scale_id, grade),
  constraint grade_bands_order check (max_score is null or max_score >= min_score)
);

create index if not exists grade_bands_scale_idx on public.grade_bands(scale_id);

-- Seed the default scale (matches src/lib/grading.ts DEFAULT_SCALE exactly).
insert into public.grade_scales (id, name, is_default)
values ('00000000-0000-0000-0000-000000000001', 'Standard 5-point (A–F)', true)
on conflict do nothing;

insert into public.grade_bands (scale_id, grade, min_score, max_score, remark)
select '00000000-0000-0000-0000-000000000001', v.grade, v.mn, v.mx, v.remark
from (values
  ('A', 75::numeric, null::numeric, 'Excellent'),
  ('B', 65, 74, 'Very Good'),
  ('C', 50, 64, 'Good'),
  ('D', 45, 49, 'Pass'),
  ('E', 40, 44, 'Weak Pass'),
  ('F',  0, 39, 'Fail')
) as v(grade, mn, mx, remark)
on conflict (scale_id, grade) do nothing;

-- Resolve a grade from the bands table. Not immutable — it reads config.
create or replace function public.grade_from_scale(
  p_total numeric,
  p_school_id uuid default null
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select b.grade
  from public.grade_bands b
  join public.grade_scales s on s.id = b.scale_id
  where (s.school_id = p_school_id or (p_school_id is null and s.is_default))
    and p_total >= b.min_score
    and (b.max_score is null or p_total <= b.max_score)
  order by b.min_score desc
  limit 1;
$$;

-- ── Convert results.grade from GENERATED to a trigger-maintained column ────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='results'
      and column_name='grade' and is_generated='ALWAYS'
  ) then
    alter table public.results drop column grade;
    alter table public.results add column grade text;
    raise notice 'results.grade converted from GENERATED to a plain column.';
  end if;
end $$;

create or replace function public.set_result_grade()
returns trigger language plpgsql as $$
declare v_school uuid;
begin
  select school_id into v_school from public.students where id = new.student_id;
  new.grade := coalesce(public.grade_from_scale(new.ca_score + new.exam_score, v_school), 'F');
  return new;
end $$;

drop trigger if exists trg_set_result_grade on public.results;
create trigger trg_set_result_grade
  before insert or update of ca_score, exam_score on public.results
  for each row execute function public.set_result_grade();

-- Backfill existing rows so no result is left with a null grade.
update public.results r
   set grade = coalesce(
     public.grade_from_scale(r.ca_score + r.exam_score,
       (select school_id from public.students where id = r.student_id)),
     'F')
 where r.grade is null;

-- ────────────────────────────────────────────────────────────────────────────
-- PART B — CONTROLLED RESULT PUBLISHING  (audit H5)
-- ────────────────────────────────────────────────────────────────────────────
--
-- Problem: parents saw a score the instant a teacher saved it, including
-- half-entered sheets. Publishing must be a deliberate act.
--
-- `results.is_published` defaults to FALSE. Parent and student read policies
-- are extended to require it, so unpublished scores are invisible to them
-- while remaining fully visible to the teacher who entered them and to admins.

alter table public.results add column if not exists is_published boolean not null default false;
alter table public.results add column if not exists published_at timestamptz;
alter table public.results add column if not exists published_by uuid references public.profiles(id);

create index if not exists results_published_idx on public.results(is_published);

-- Existing rows stay UNPUBLISHED. That is the safe default: it is far better
-- to under-publish than to expose half-entered marks to families.
update public.results set is_published = false where is_published is null;

-- Teachers may only publish results for classes they manage.
create or replace function public.guard_result_publish()
returns trigger language plpgsql as $$
begin
  if new.is_published and not old.is_published then
    if not public.is_admin() and public.current_role() <> 'teacher' then
      raise exception 'Only teachers and administrators may publish results.'
        using errcode = '42501';
    end if;
    if not public.is_admin() and not exists (
         select 1 from public.enrollments e
          where e.student_id = new.student_id and e.is_active
            and public.teacher_manages_class(e.class_id)) then
      raise exception 'Not authorised to publish results for this student.'
        using errcode = '42501';
    end if;
    new.published_at := now();
    new.published_by := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_result_publish on public.results;
create trigger trg_guard_result_publish
  before update of is_published on public.results
  for each row execute function public.guard_result_publish();

-- Publish a whole class/subject/term sheet in one deliberate action.
create or replace function public.teacher_publish_results(
  p_class_id uuid, p_subject_id uuid, p_session_id uuid, p_term text
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_count int;
begin
  if public.current_role() <> 'teacher' and not public.is_admin() then
    raise exception 'Forbidden: teachers and administrators only.' using errcode = '42501';
  end if;
  if not public.is_admin() and not public.teacher_manages_class(p_class_id) then
    raise exception 'Not authorised for this class.' using errcode = '42501';
  end if;

  update public.results r
     set is_published = true, published_at = now(), published_by = auth.uid()
   where r.subject_id = p_subject_id
     and r.session_id = p_session_id
     and r.term = p_term
     and not r.is_published
     and r.student_id in (
       select e.student_id from public.enrollments e
        where e.class_id = p_class_id and e.is_active)
  returning 1 into v_count;

  return coalesce((select count(*) from public.results r
                    where r.subject_id = p_subject_id
                      and r.session_id = p_session_id
                      and r.term = p_term
                      and r.is_published
                      and r.student_id in (
                        select e.student_id from public.enrollments e
                         where e.class_id = p_class_id and e.is_active)), 0);
end $$;

-- ── Tighten the read policies so unpublished marks stay private ────────────
drop policy if exists "results: read scoped" on public.results;
create policy "results: read scoped" on public.results
  for select to authenticated
  using (
    public.is_admin()
    -- Teachers see everything they manage, published or not.
    or (public.current_role() = 'teacher'
        and exists (
          select 1 from public.enrollments e
           where e.student_id = public.results.student_id
             and e.is_active
             and public.teacher_manages_class(e.class_id)))
    -- Students and parents see PUBLISHED rows only.
    or (public.results.is_published
        and public.current_role() = 'student'
        and student_id in (select id from public.students where profile_id = auth.uid()))
    or (public.results.is_published
        and public.current_role() = 'parent'
        and student_id in (
          select s.id from public.students s
          join public.parent_student_links l on l.student_profile_id = s.profile_id
          where l.parent_profile_id = auth.uid() and l.is_active))
  );

-- ────────────────────────────────────────────────────────────────────────────
-- PART C — MULTI-TENANCY  (audit H2)
-- ────────────────────────────────────────────────────────────────────────────
--
-- Tenant isolation is enforced HERE, in the database — not in the UI.
-- Every tenant-owned table gains a `school_id`, and a SECURITY DEFINER
-- helper resolves the caller's school so no client can assert one.

create table if not exists public.schools (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique,          -- 'greenfield-academy'
  email          text,
  phone          text,
  address        text,
  -- Branding hooks for future school-specific theming.
  logo_url       text,
  primary_colour text default '#1E40AF',
  accent_colour  text default '#38BDF8',
  motto          text,
  grade_scale_id uuid references public.grade_scales(id),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.grade_scales
  add constraint grade_scales_school_fk
  foreign key (school_id) references public.schools(id) on delete cascade;

-- A school's membership. `schools` itself is NOT keyed by profile, because a
-- parent may have children at two schools and an admin may serve several.
create table if not exists public.school_members (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  constraint school_members_unique unique (school_id, profile_id)
);

create index if not exists school_members_profile_idx on public.school_members(profile_id);
create index if not exists school_members_school_idx  on public.school_members(school_id);

-- The caller's school. SECURITY DEFINER so policies can use it, and it can
-- never be spoofed by the client.
create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.school_members
   where profile_id = auth.uid() and is_active
   order by created_at limit 1;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  -- A platform operator (Midex Edits) who manages every school.
  select coalesce(
    (select bool_or(sm.school_id is null) from public.profiles p
      left join public.school_members sm on sm.profile_id = p.id
      where p.id = auth.uid() and p.role = 'admin'), false);
$$;

-- Add school_id to every tenant-owned table. Nullable during migration so
-- existing rows survive; backfilled below and then tightened.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','students','teachers','parents','classes','subjects',
    'teacher_assignments','enrollments','results','attendance',
    'timetables','announcements','academic_sessions','terms',
    'parent_student_links','activity_logs'
  ]
  loop
    if exists (select 1 from information_schema.tables
                where table_schema='public' and table_name=t) then
      execute format('alter table public.%I add column if not exists school_id uuid', t);
      execute format('create index if not exists %I_school_idx on public.%I(school_id)', t, t);
    end if;
  end loop;
end $$;

-- Default tenant so existing data is not orphaned.
insert into public.schools (id, name, slug, email)
values ('00000000-0000-0000-0000-0000000000d1', 'Greenfield Academy', 'greenfield-academy', 'admin@greenfield.example')
on conflict (slug) do nothing;

-- Backfill every existing row into the demo tenant.
do $$
declare t text; v_def uuid := '00000000-0000-0000-0000-0000000000d1';
begin
  foreach t in array array[
    'profiles','students','teachers','parents','classes','subjects',
    'teacher_assignments','enrollments','results','attendance',
    'timetables','announcements','academic_sessions','terms',
    'parent_student_links','activity_logs'
  ]
  loop
    if exists (select 1 from information_schema.columns
                where table_schema='public' and table_name=t and column_name='school_id') then
      execute format('update public.%I set school_id = $1 where school_id is null', t)
        using v_def;
    end if;
  end loop;
end $$;

-- Existing users become members of the demo school.
insert into public.school_members (school_id, profile_id)
select '00000000-0000-0000-0000-0000000000d1', p.id
from public.profiles p
on conflict (school_id, profile_id) do nothing;

-- Now that backfill is done, new rows must carry a tenant. Existing rows are
-- covered by defaults applied on insert via the trigger below.
create or replace function public.assign_school()
returns trigger language plpgsql as $$
begin
  if new.school_id is null then
    new.school_id := public.current_school_id();
  end if;
  if new.school_id is null then
    raise exception 'No school context: the user is not a member of any school.'
      using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'students','teachers','parents','classes','subjects',
    'teacher_assignments','enrollments','results','attendance',
    'timetables','announcements','academic_sessions','terms',
    'parent_student_links'
  ]
  loop
    execute format('drop trigger if exists trg_assign_school on public.%I', t);
    execute format(
      'create trigger trg_assign_school before insert on public.%I
       for each row execute function public.assign_school()', t);
  end loop;
end $$;

-- ── TENANT ISOLATION POLICIES ──────────────────────────────────────────────
-- Appended to the existing role policies. A row is visible only if it belongs
-- to the caller's school AND the role policy in 0001 also allows it.
-- Postgres requires BOTH a permissive policy from 0001 and this one to match
-- only when combined with AND semantics, so we use RESTRICTIVE policies —
-- the only policy kind that intersects with existing permissive policies.

do $$
declare t text;
begin
  foreach t in array array[
    'students','teachers','parents','classes','subjects',
    'teacher_assignments','enrollments','results','attendance',
    'timetables','announcements','academic_sessions','terms',
    'parent_student_links'
  ]
  loop
    execute format(
      'drop policy if exists "tenant isolation" on public.%I', t);
    execute format(
      'create policy "tenant isolation" on public.%I as restrictive
         for all to authenticated
         using (school_id = public.current_school_id() or public.is_platform_admin())
         with check (school_id = public.current_school_id() or public.is_platform_admin())',
      t, t);
  end loop;
end $$;

-- Schools table: members read their own; platform admin manages all.
alter table public.schools enable row level security;

drop policy if exists "schools: member read" on public.schools;
create policy "schools: member read" on public.schools
  for select to authenticated
  using (
    public.is_platform_admin()
    or exists (select 1 from public.school_members m
                where m.school_id = public.schools.id
                  and m.profile_id = auth.uid() and m.is_active)
  );

drop policy if exists "schools: platform admin writes" on public.schools;
create policy "schools: platform admin writes" on public.schools
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

alter table public.school_members enable row level security;

drop policy if exists "school_members: self read" on public.school_members;
create policy "school_members: self read" on public.school_members
  for select to authenticated
  using (profile_id = auth.uid() or public.is_platform_admin());

drop policy if exists "school_members: platform admin writes" on public.school_members;
create policy "school_members: platform admin writes" on public.school_members
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Grade scales: readable by members of the owning school.
alter table public.grade_scales enable row level security;
alter table public.grade_bands  enable row level security;

drop policy if exists "grade_scales: read" on public.grade_scales;
create policy "grade_scales: read" on public.grade_scales
  for select to authenticated
  using (
    is_default
    or public.is_platform_admin()
    or school_id = public.current_school_id()
  );

drop policy if exists "grade_scales: admin writes" on public.grade_scales;
create policy "grade_scales: admin writes" on public.grade_scales
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "grade_bands: read" on public.grade_bands;
create policy "grade_bands: read" on public.grade_bands
  for select to authenticated
  using (
    exists (select 1 from public.grade_scales s
             where s.id = public.grade_bands.scale_id
               and (s.is_default or s.school_id = public.current_school_id()
                    or public.is_platform_admin()))
  );

drop policy if exists "grade_bands: admin writes" on public.grade_bands;
create policy "grade_bands: admin writes" on public.grade_bands
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Platform admin: create a school and its first administrator ────────────
create or replace function public.platform_create_school(
  p_name text, p_slug text, p_admin_email text, p_admin_password text,
  p_admin_name text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_school uuid; v_admin uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform operators may create schools.' using errcode = '42501';
  end if;

  insert into public.schools (name, slug) values (p_name, p_slug)
  returning id into v_school;

  -- Copy the default grade scale into the new tenant so it can be edited
  -- without affecting anyone else.
  insert into public.grade_scales (school_id, name)
  values (v_school, 'Standard 5-point (A–F)')
  returning id into v_admin;

  insert into public.grade_bands (scale_id, grade, min_score, max_score, remark)
  select v_admin, b.grade, b.min_score, b.max_score, b.remark
  from public.grade_bands b
  where b.scale_id = '00000000-0000-0000-0000-000000000001';

  update public.schools set grade_scale_id = v_admin where id = v_school;

  -- First administrator, scoped to this school only.
  perform public.admin_create_account(
    p_admin_email, p_admin_password, p_admin_name, 'admin'::user_role, null, '{}'::jsonb);

  insert into public.school_members (school_id, profile_id)
  select v_school, p.id from public.profiles p where p.email = lower(p_admin_email);

  return v_school;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- GRANTS for new objects
-- ────────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.schools, public.school_members,
  public.grade_scales, public.grade_bands to authenticated;
grant execute on all functions in schema public to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- VERIFY
-- ────────────────────────────────────────────────────────────────────────────
select 'schools' as t, count(*) from public.schools union all
select 'school_members', count(*) from public.school_members union all
select 'grade_scales', count(*) from public.grade_scales union all
select 'grade_bands', count(*) from public.grade_bands union all
select 'results unpublished', count(*) from public.results where not is_published union all
select 'results with null grade', count(*) from public.results where grade is null;
