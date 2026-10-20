-- ============================================================================
-- SMARTSCHOOL — DEMO SEED DATA
-- ============================================================================
-- Run AFTER schema.sql. Optional: skip this for a clean production database.
--
-- Demo accounts are created through auth.users directly so the file stays
-- self-contained. In production, create accounts through
-- public.admin_create_account() or the Supabase dashboard instead.
--
-- All passwords below are DEMO ONLY:
--   admin    -> Admin123!
--   teacher  -> Teacher123!
--   parent   -> Parent123!
--   student  -> Student123!
-- ============================================================================

-- pgcrypto supplies crypt() / gen_salt() for password hashing
create extension if not exists pgcrypto;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Demo auth users
-- ────────────────────────────────────────────────────────────────────────────
with demo_users(email, password, full_name, meta) as (
  values
    ('admin@greenfield.example',   'Admin123!',   'Dr. Tobiloba Adeyemi', '{"full_name":"Dr. Tobiloba Adeyemi"}'::jsonb),
    ('teacher@greenfield.example', 'Teacher123!', 'Mr. Chinedu Okeke',   '{"full_name":"Mr. Chinedu Okeke"}'::jsonb),
    ('aisha.abdullahi@greenfield.example','Teacher123!','Mrs. Aisha Abdullahi','{"full_name":"Mrs. Aisha Abdullahi"}'::jsonb),
    ('parent@greenfield.example',  'Parent123!',  'Mrs. Ngozi Okafor',  '{"full_name":"Mrs. Ngozi Okafor"}'::jsonb),
    ('abdullahi.musa@greenfield.example',  'Parent123!',  'Mr. Abdullahi Musa',   '{"full_name":"Mr. Abdullahi Musa"}'::jsonb),
    ('student@greenfield.example', 'Student123!', 'Chiamaka Okafor',    '{"full_name":"Chiamaka Okafor"}'::jsonb)
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated',
  email,
  crypt(password, gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  meta,
  now(), now(), '', ''
from demo_users d
where not exists (select 1 from auth.users u where u.email = d.email);

-- The on_auth_user_created trigger already created 'student' profiles.
-- Promote the admin / teacher / parent demo accounts.
update public.profiles p set role = 'admin'
  from auth.users u
 where u.id = p.id and u.email = 'admin@greenfield.example';

update public.profiles p set role = 'teacher'
  from auth.users u
 where u.id = p.id and u.email in ('teacher@greenfield.example','aisha.abdullahi@greenfield.example');

update public.profiles p set role = 'parent'
  from auth.users u
 where u.id = p.id and u.email in ('parent@greenfield.example','abdullahi.musa@greenfield.example');

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Teachers & parents companion records
-- ────────────────────────────────────────────────────────────────────────────
insert into public.teachers (profile_id, employee_no, full_name, qualification, department, phone)
select p.id, v.no, p.full_name, v.qual, v.dept, v.phone
from public.profiles p
join (values
  ('teacher@greenfield.example',   'TCH/2020/011', 'M.Ed Mathematics', 'Sciences',  '08031234000'),
  ('aisha.abdullahi@greenfield.example','TCH/2021/024','B.Ed English',     'Languages', '08039876000')
) as v(email, no, qual, dept, phone) on v.email = p.email
where not exists (select 1 from public.teachers t where t.profile_id = p.id);

insert into public.parents (profile_id, full_name, occupation, phone)
select p.id, p.full_name, 'Business Owner', '08031234567'
from public.profiles p
where p.email in ('parent@greenfield.example','abdullahi.musa@greenfield.example')
  and not exists (select 1 from public.parents pa where pa.profile_id = p.id);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Classes for the current session
-- ────────────────────────────────────────────────────────────────────────────
insert into public.classes (session_id, name, section, level, capacity, room)
select s.id, v.name, v.section, v.level, v.cap, v.room
from public.academic_sessions s
cross join (values
  ('JSS 1','A','Junior Secondary',40,'Room 101'),
  ('JSS 1','B','Junior Secondary',40,'Room 102'),
  ('JSS 2','A','Junior Secondary',35,'Room 103'),
  ('SSS 1','A','Senior Secondary',35,'Room 201'),
  ('SSS 2','B','Senior Secondary',30,'Room 202'),
  ('SSS 3','A','Senior Secondary',30,'Room 203')
) as v(name, section, level, cap, room)
where s.is_current
on conflict (session_id, name, section) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Students (no auth account except the demo student)
-- ────────────────────────────────────────────────────────────────────────────
insert into public.students (admission_no, full_name, gender, date_of_birth, address, phone, profile_id)
values
  ('SS/2024/002','Emeka Okafor',   'Male',  '2012-03-22','8 GRA, Enugu',          '08039876543', null),
  ('SS/2024/003','Zainab Musa',      'Female','2012-07-08','15 Ogui Road, Enugu',  '08031239876', null),
  ('SS/2024/004','Ibrahim Musa',    'Male',  '2011-11-30','22 New Haven, Enugu',  '08035551234', null),
  ('SS/2024/005','Adaeze Okafor',    'Female','2011-04-18','10 Abakpa Nike, Enugu',     '08034445566', null),
  ('SS/2024/006','Usman Musa',       'Male',  '2010-09-12','5 Coal Camp, Enugu',   '08036667788', null),
  ('SS/2024/007','Amarachi Okafor',  'Female','2010-06-25','18 Uwani, Enugu',      '08037778899', null),
  ('SS/2024/008','Yusuf Musa',    'Male',  '2009-02-14','30 Independence Avenue, Enugu',  '08038889900', null)
on conflict (admission_no) do nothing;

-- Link the demo student account to its student record
update public.students s
   set profile_id = p.id
  from public.profiles p
 where p.email = 'student@greenfield.example'
   and s.admission_no = 'SS/2024/001'
   and s.profile_id is null;

-- Create the demo student record if missing
insert into public.students (admission_no, full_name, gender, date_of_birth, address, phone, profile_id)
select 'SS/2024/001','Chiamaka Okafor','Female','2012-05-14','12 Independence Layout, Enugu','08031234567', p.id
from public.profiles p
where p.email = 'student@greenfield.example'
  and not exists (select 1 from public.students where admission_no = 'SS/2024/001')
on conflict (admission_no) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Enrolments (capacity enforced by trigger)
-- ────────────────────────────────────────────────────────────────────────────
insert into public.enrollments (student_id, class_id, academic_year, is_active)
select s.id, c.id, '2024/2025', true
from public.students s
join public.classes c on c.session_id = (select id from public.academic_sessions where is_current limit 1)
where (s.admission_no, c.name, c.section) in (
  ('SS/2024/001','JSS 1','A'),
  ('SS/2024/002','JSS 1','A'),
  ('SS/2024/003','JSS 1','A'),
  ('SS/2024/004','JSS 1','B'),
  ('SS/2024/005','JSS 2','A'),
  ('SS/2024/006','SSS 1','A'),
  ('SS/2024/007','SSS 1','A'),
  ('SS/2024/008','SSS 2','B')
)
on conflict (student_id, class_id, academic_year) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Teacher assignments
-- ────────────────────────────────────────────────────────────────────────────
insert into public.teacher_assignments (teacher_profile_id, class_id, is_class_teacher, is_active)
select p.id, c.id, true, true
from public.profiles p
join public.classes c on c.session_id = (select id from public.academic_sessions where is_current limit 1)
where (p.email, c.name, c.section) in (
  ('teacher@greenfield.example',    'JSS 1','A'),
  ('teacher@greenfield.example',    'JSS 2','A'),
  ('teacher@greenfield.example',    'SSS 2','B'),
  ('aisha.abdullahi@greenfield.example','JSS 1','B'),
  ('aisha.abdullahi@greenfield.example','SSS 1','A'),
  ('aisha.abdullahi@greenfield.example','SSS 3','A')
)
on conflict (teacher_profile_id, class_id, subject_id) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Parent <-> student links
--    parent@greenfield.example (Mrs. Ngozi Okafor)  -> Chiamaka, Emeka, Adaeze, Uche Okafor
--    abdullahi.musa@greenfield.example (Mr. Abdullahi Musa) -> Ibrahim, Zainab, Amina, Yusuf Musa
-- ────────────────────────────────────────────────────────────────────────────
insert into public.parent_student_links (parent_profile_id, student_profile_id, relationship)
select pa.id, sp.id, v.rel
from public.profiles pa
join public.students s on s.admission_no = v.adm
left join public.profiles sp on sp.id = s.profile_id
join (values
  ('parent@greenfield.example', 'SS/2024/001', 'mother'),
  ('parent@greenfield.example', 'SS/2024/002', 'mother'),
  ('parent@greenfield.example', 'SS/2024/005', 'mother'),
  ('parent@greenfield.example', 'SS/2024/007', 'mother'),
  ('abdullahi.musa@greenfield.example', 'SS/2024/003', 'father'),
  ('abdullahi.musa@greenfield.example', 'SS/2024/004', 'father'),
  ('abdullahi.musa@greenfield.example', 'SS/2024/006', 'father'),
  ('abdullahi.musa@greenfield.example', 'SS/2024/008', 'father')
) as v(email, adm, rel) on v.email = pa.email
where sp.id is not null
on conflict (parent_profile_id, student_profile_id) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. Results (First Term 2024/2025)
--    Unique constraint blocks duplicates for the same student/subject/session/term
-- ────────────────────────────────────────────────────────────────────────────
insert into public.results (student_id, subject_id, session_id, term, ca_score, exam_score, remarks)
select s.id, sub.id, ses.id, 'First Term', v.ca, v.exam, null
from public.students s
join public.subjects sub on sub.code = v.code
join public.academic_sessions ses on ses.name = '2024/2025'
join (values
  ('SS/2024/001','MTH',28,62), ('SS/2024/001','ENG',25,58),
  ('SS/2024/001','BSC',24,55), ('SS/2024/001','SOS',26,52),
  ('SS/2024/001','CSC',27,60), ('SS/2024/001','FRE',22,48),
  ('SS/2024/002','MTH',22,48), ('SS/2024/002','ENG',20,45),
  ('SS/2024/002','BSC',19,42), ('SS/2024/002','SOS',21,44),
  ('SS/2024/005','MTH',30,65), ('SS/2024/005','ENG',28,61),
  ('SS/2024/005','BSC',27,59), ('SS/2024/006','MTH',18,38),
  ('SS/2024/006','ENG',20,41), ('SS/2024/007','MTH',25,55),
  ('SS/2024/008','MTH',16,32)
) as v(adm, code, ca, exam) on v.adm = s.admission_no
on conflict (student_id, subject_id, session_id, term) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. Attendance (last 5 weekdays)
-- ────────────────────────────────────────────────────────────────────────────
insert into public.attendance (student_id, class_id, session_id, record_date, status)
select s.id, e.class_id,
       (select id from public.academic_sessions where is_current limit 1),
       d.dt,
       case when (s.admission_no = 'SS/2024/003' and d.dt = current_date - 1) then 'absent'::attendance_status
            when (s.admission_no = 'SS/2024/002' and d.dt = current_date - 2) then 'late'::attendance_status
            else 'present'::attendance_status
       end
from public.students s
join public.enrollments e on e.student_id = s.id and e.is_active
cross join (
  select current_date - n as dt
  from generate_series(1,5) n
  where extract(dow from current_date - n) not in (0,6)
) d
on conflict (student_id, record_date) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 10. Announcements
-- ────────────────────────────────────────────────────────────────────────────
insert into public.announcements (title, content, audience, author_id, is_pinned, published_at)
select v.title, v.content, v.audience::announcement_audience, p.id, v.pinned, now() - (v.days_ago || ' days')::interval
from public.profiles p
join (values
  ('Mid-Term Break Announced',
   'Dear Parents and Students, please be informed that mid-term break will commence from the 24th to the 29th of this month. Boarding students are to be picked up by 2pm on the 24th. Classes resume fully on the 30th.',
   'all', 'admin@greenfield.example', true, 4),
  ('Inter-House Sports Competition',
   'The annual Inter-House Sports Competition will hold at the school sports complex. All houses should commence training immediately. Parents are warmly invited.',
   'all', 'admin@greenfield.example', false, 9),
  ('PTA Meeting',
   'This is to invite all parents/guardians to the PTA meeting at 10:00 AM in the school hall. Agenda includes academic progress and infrastructure development.',
   'parent', 'admin@greenfield.example', false, 11),
  ('Teachers Workshop',
   'All teaching staff are required to attend the professional development workshop on Modern Pedagogy at 9:00 AM in the conference room.',
   'teacher', 'admin@greenfield.example', false, 14),
  ('SSS 3 Mock Examination',
   'SSS 3 mock examinations will commence shortly. Students are advised to prepare thoroughly. The timetable has been pasted on notice boards and sent to parents.',
   'student', 'admin@greenfield.example', false, 7)
) as v(title, content, audience, email, pinned, days_ago) on v.email = p.email
where not exists (select 1 from public.announcements a where a.title = v.title);

-- ────────────────────────────────────────────────────────────────────────────
-- 11. Timetable (JSS 1 A)
-- ────────────────────────────────────────────────────────────────────────────
insert into public.timetables (class_id, subject_id, day_of_week, start_time, end_time, room)
select c.id, sub.id, v.dow, v.st::time, v.et::time, v.room
from public.classes c
join public.subjects sub on sub.code = v.code
cross join (select 1) x
join (values
  (1,'MTH','08:00','08:40','Room 101'), (1,'ENG','08:40','09:20','Room 101'),
  (1,'BSC','09:20','10:00','Lab 1'),     (1,'SOS','10:30','11:10','Room 101'),
  (1,'ART','11:10','11:50','Room 102'),
  (2,'ENG','08:00','08:40','Room 101'), (2,'MTH','08:40','09:20','Room 101'),
  (2,'CSC','09:20','10:00','ICT Lab'),
  (3,'BST','08:00','08:40','Workshop'), (3,'MTH','08:40','09:20','Room 101'),
  (4,'FRE','08:00','08:40','Room 101'),
  (5,'BSC','08:00','08:40','Field')
) as v(dow, code, st, et, room) on true
where c.name = 'JSS 1' and c.section = 'A'
  and c.session_id = (select id from public.academic_sessions where is_current limit 1)
on conflict (class_id, day_of_week, start_time, subject_id) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- VERIFY
-- ────────────────────────────────────────────────────────────────────────────
select 'profiles'    as t, count(*) from public.profiles union all
select 'students',   count(*) from public.students union all
select 'teachers',   count(*) from public.teachers union all
select 'parents',    count(*) from public.parents union all
select 'links',      count(*) from public.parent_student_links union all
select 'classes',    count(*) from public.classes union all
select 'subjects',   count(*) from public.subjects union all
select 'assignments',count(*) from public.teacher_assignments union all
select 'enrollments',count(*) from public.enrollments union all
select 'results',    count(*) from public.results union all
select 'attendance', count(*) from public.attendance union all
select 'timetable',  count(*) from public.timetables union all
select 'announcements',count(*) from public.announcements;
