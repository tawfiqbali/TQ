-- =====================================================================
-- Quran International Institute - TEACHER DASHBOARD, ROLES & PORTAL DATA
-- Supabase -> SQL Editor -> New query -> paste EVERYTHING -> Run.
-- Run it AFTER complete-setup.sql. Safe to run again at any time.
--
-- Who can do what (enforced here, in the database, for every request):
--   Executive (Super Admin) - a Gmail in executive_emails, signed in with
--                   Google (see 7l Security). Everything.
--   Junior Admin  - an email listed in staff_roles, signed in with Google.
--                   Can ONLY read the teacher list and read/review the
--                   teachers' monthly reports. No salaries, no fees, no
--                   bank details, no editing of anything else.
--   Teacher       - signed in with Google (Gmail) and finished onboarding.
--                   Sees ONLY their own students, schedules, reports,
--                   salary history and support requests.
-- =====================================================================

-- 0. Helpers -------------------------------------------------------------

-- Executive accounts (normally made by complete-setup.sql; repeated here so
-- this file also works on its own)
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.admins enable row level security;
-- Email of the signed-in user, but only when THIS sign-in was through Google.
-- An account that also has a password (e.g. an Executive's old admin
-- password) does not count when it signed in with the password.
create or replace function public.google_email()
returns text language sql stable set search_path = public as $$
  select case
    when coalesce(auth.jwt() -> 'app_metadata' -> 'providers', '[]'::jsonb) ? 'google'
         and coalesce(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method": "oauth"}]'::jsonb
      then lower(coalesce(auth.jwt() ->> 'email', ''))
    -- Google-only accounts (no password at all)
    when coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
         and not coalesce(auth.jwt() -> 'app_metadata' -> 'providers', '[]'::jsonb) ? 'email'
         and not coalesce(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method": "password"}]'::jsonb
      then lower(coalesce(auth.jwt() ->> 'email', ''))
    else ''
  end;
$$;

create or replace function public.is_gmail(e text)
returns boolean language sql immutable as $$
  select coalesce(e, '') ~* '^[a-z0-9](?:[a-z0-9.+_-]{0,62}[a-z0-9])?@(?:gmail|googlemail)\.com$';
$$;

-- One Gmail can be written many ways: Jubayer.Hossain.FM@gmail.com,
-- jubayerhossainfm@gmail.com and jubayer.hossainfm+qit@googlemail.com are the
-- same inbox. gmail_key() gives every spelling the same key.
create or replace function public.gmail_key(e text)
returns text language sql immutable as $$
  select case
    when lower(btrim(coalesce(e, ''))) ~ '^[^@]+@(gmail|googlemail)\.com$'
      then replace(split_part(split_part(lower(btrim(e)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else lower(btrim(coalesce(e, '')))
  end;
$$;

-- Teacher IDs by category (since v104):
--   Residential              QIT-R001, QIT-R002 …
--   Non-Residential Male     QIT-M001 …
--   Non-Residential Female   QIT-F001 …
-- (Older IDs like QIT-007 keep working until an Executive gives the teacher a new one.)
create or replace function public.teacher_cat_letter(cat text)
returns text language sql immutable as $$
  select case
    when coalesce(cat, '') ~* 'female' then 'F'
    when coalesce(cat, '') ~* 'non.?resid' then 'M'
    when coalesce(cat, '') ~* '^\s*resid' then 'R'
    when upper(btrim(coalesce(cat, ''))) in ('R', 'M', 'F') then upper(btrim(cat))
  end;
$$;
create or replace function public.teacher_cat_name(letter text)
returns text language sql immutable as $$
  select case upper(letter) when 'R' then 'Residential' when 'M' then 'Non-Residential Male' when 'F' then 'Non-Residential Female' end;
$$;
create or replace function public.is_category_id(tid text)
returns boolean language sql immutable as $$
  select coalesce(tid, '') ~ '^QIT-[RMF][0-9]{3,}$';
$$;

-- The session this request belongs to (one per signed-in device)
create or replace function public.current_session_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'session_id', '')::uuid;
$$;

-- Executives: ONLY the Gmails in this list, and only when signed in with
-- Google. Executives add or remove each other (and themselves) in
-- Management Portal -> Security. The first list is set once; running this
-- file again never puts back someone who was removed.
create table if not exists public.executive_emails (
  email text primary key check (email = lower(email) and public.is_gmail(email)),
  added_by text,
  created_at timestamptz not null default now()
);
alter table public.executive_emails enable row level security;
insert into public.executive_emails (email, added_by)
select e, 'setup' from unnest(array['qitoffice.info@gmail.com', 'gmmuhit1632@gmail.com', 'jubayer.hossain.fm@gmail.com']) e
where not exists (select 1 from public.executive_emails);

-- Executive password: the second step after Google (stored only as a bcrypt
-- hash; set once, Executives can change it in Security)
create table if not exists public.executive_secret (
  id int primary key default 1 check (id = 1),
  hash text not null,
  changed_by text,
  changed_at timestamptz not null default now()
);
alter table public.executive_secret enable row level security;
insert into public.executive_secret (id, hash, changed_by)
values (1, '$2a$10$OQk7F7W4/rTsc7vNTyP0g./ILwN9angYIMrsNlyPtJ7H4VjUumONu', 'setup')
on conflict (id) do nothing;

-- Devices where an Executive gave the password (several devices allowed).
-- Signing out ends the session, which ends this too.
create table if not exists public.executive_sessions (
  session_id uuid primary key,
  email text not null,
  device text,
  created_at timestamptz not null default now()
);
alter table public.executive_sessions enable row level security;

-- An Executive Gmail signed in through Google (password step not checked)
create or replace function public.is_executive_gmail()
returns boolean language sql stable security definer set search_path = public as $$
  select public.google_email() <> ''
    and exists (select 1 from public.executive_emails x where public.gmail_key(x.email) = public.gmail_key(public.google_email()));
$$;

-- Executive = an approved Gmail through Google AND the Executive password on this device
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_executive_gmail()
    and exists (select 1 from public.executive_sessions es
                where es.session_id = public.current_session_id()
                  and public.gmail_key(es.email) = public.gmail_key(public.google_email()));
$$;

-- Last 10 digits of a phone number (Bangla digits are converted first)
create or replace function public.phone_key(p text)
returns text language sql immutable as $$
  select right(regexp_replace(translate(coalesce(p, ''), '০১২৩৪৫৬৭৮৯', '0123456789'), '\D', '', 'g'), 10);
$$;

-- 1. Staff roles (Junior Admins) -----------------------------------------
-- Executives add a Junior Admin by Gmail address, even before that person
-- has ever signed in. Removing the row removes the access immediately.
create table if not exists public.staff_roles (
  email text primary key check (email = lower(email) and public.is_gmail(email)),
  role text not null default 'junior' check (role in ('junior')),
  added_by text,
  created_at timestamptz not null default now()
);
alter table public.staff_roles enable row level security;

drop policy if exists "Executives manage staff roles" on public.staff_roles;
create policy "Executives manage staff roles" on public.staff_roles
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Staff can see their own role" on public.staff_roles;
create policy "Staff can see their own role" on public.staff_roles
  for select to authenticated using (public.gmail_key(email) = public.gmail_key((select public.google_email())));

-- v145: a Junior Admin has a personal PIN. After the first Google sign-in on a
-- device, "Sign out" only locks the portal: next time just the PIN is asked.
create table if not exists public.junior_secrets (
  email text primary key,
  hash text not null,
  changed_at timestamptz not null default now()
);
alter table public.junior_secrets enable row level security;
create table if not exists public.junior_sessions (
  session_id uuid primary key,
  email text not null,
  device text,
  created_at timestamptz not null default now()
);
alter table public.junior_sessions enable row level security;

-- v147: one Junior Admin password, set by an Executive (the same for every
-- Junior Admin). While none is set, each Junior Admin's own PIN is used.
create table if not exists public.junior_password (
  id int primary key check (id = 1),
  hash text not null,
  pin_length int not null default 0,
  changed_by text,
  changed_at timestamptz not null default now()
);
alter table public.junior_password enable row level security;

-- A Junior Admin Gmail signed in through Google (PIN step not checked)
create or replace function public.is_junior_gmail()
returns boolean language sql stable security definer set search_path = public as $$
  select public.google_email() <> ''
    and exists (select 1 from public.staff_roles where public.gmail_key(email) = public.gmail_key(public.google_email()) and role = 'junior');
$$;

-- Junior Admin = an approved Gmail through Google AND the PIN on this device
create or replace function public.is_junior()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_junior_gmail()
    and exists (select 1 from public.junior_sessions js
                where js.session_id = public.current_session_id()
                  and public.gmail_key(js.email) = public.gmail_key(public.google_email()));
$$;

-- Executives and Junior Admins
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_junior();
$$;

-- 2. Management Portal data (moved from the Google Sheet) -----------------
-- Each row keeps the whole record the portal uses in "data"; the columns
-- the security rules need are read out of it automatically.
create table if not exists public.portal_teachers (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  email text generated always as (nullif(lower(trim(data ->> 'email')), '')) stored,
  whatsapp text generated always as (nullif(trim(data ->> 'whatsapp'), '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists portal_teachers_email_key on public.portal_teachers (email) where email is not null;

create table if not exists public.portal_students (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  teacher_id text generated always as (nullif(data ->> 'teacherId', '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portal_students_teacher_idx on public.portal_students (teacher_id);

create table if not exists public.portal_payments (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  teacher_id text generated always as (nullif(data ->> 'teacherId', '')) stored,
  created_at timestamptz not null default now()
);
create index if not exists portal_payments_teacher_idx on public.portal_payments (teacher_id);

-- v152: Management Team Salary (office staff: profile, monthly salary, payments)
create table if not exists public.portal_team (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_reports (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  student_id text generated always as (nullif(data ->> 'studentId', '')) stored,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['portal_teachers', 'portal_students', 'portal_payments', 'portal_reports', 'portal_team'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Executives manage %s" on public.%I', t, t);
    execute format('create policy "Executives manage %s" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t, t);
  end loop;
end $$;

-- 3. Teacher accounts ------------------------------------------------------
create table if not exists public.teacher_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  teacher_id text not null unique,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  whatsapp text not null check (char_length(public.phone_key(whatsapp)) >= 7),
  email text not null,
  created_at timestamptz not null default now()
);
alter table public.teacher_profiles enable row level security;
-- A sign-up whose name matches an existing teacher waits for an Executive to
-- confirm it (link_status = 'pending'), so nobody can claim another teacher's
-- students or salary just by typing their name.
alter table public.teacher_profiles alter column teacher_id drop not null;
alter table public.teacher_profiles add column if not exists link_status text not null default 'active';
alter table public.teacher_profiles add column if not exists claim_teacher_id text;
-- How the account found its Teacher ID: gmail | whatsapp | name | new | office
alter table public.teacher_profiles add column if not exists linked_by text;
do $$ begin
  alter table public.teacher_profiles add constraint teacher_profiles_link_status_check check (link_status in ('active', 'pending'));
exception when duplicate_object then null; end $$;
-- When this Gmail first opened the dashboard. Until then the first sign-in
-- needs only Google (the first time); after it, Teacher ID + password too.
-- (Accounts that existed before this rule count as already used.)
alter table public.teacher_profiles add column if not exists first_unlock_at timestamptz default now();
alter table public.teacher_profiles alter column first_unlock_at drop default;
-- A Gmail linked with Teacher ID + password may have no WhatsApp on record yet
alter table public.teacher_profiles drop constraint if exists teacher_profiles_whatsapp_check;
do $$ begin
  alter table public.teacher_profiles add constraint teacher_profiles_whatsapp_check2 check (whatsapp = '' or char_length(public.phone_key(whatsapp)) >= 7);
exception when duplicate_object then null; end $$;

drop policy if exists "Teachers see their own profile" on public.teacher_profiles;
create policy "Teachers see their own profile" on public.teacher_profiles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Executives manage teacher profiles" on public.teacher_profiles;
create policy "Executives manage teacher profiles" on public.teacher_profiles
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Teacher ID + password sign-in accounts (see 7h). QIT-077 signs in as the
-- hidden Supabase Auth address qit-077@institute.local; this table links that
-- account to the Teacher ID.
create table if not exists public.teacher_logins (
  teacher_id text primary key,
  user_id uuid not null unique references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  password_changed_by text,
  password_changed_at timestamptz
);
-- disabled = the office switched this Teacher ID sign-in off
alter table public.teacher_logins add column if not exists disabled boolean not null default false;
alter table public.teacher_logins drop column if exists valid_after;
-- One device at a time: the session that opened the dashboard last.
-- Opening it on another device takes over and this one is signed out.
alter table public.teacher_logins add column if not exists active_session uuid;
alter table public.teacher_logins add column if not exists active_device text;
alter table public.teacher_logins add column if not exists active_since timestamptz;
alter table public.teacher_logins add column if not exists last_seen timestamptz;
-- New-style IDs (QIT-R001 …) get a random 6-digit starting password, kept here
-- so the office and the teacher can see it until it is changed
alter table public.teacher_logins add column if not exists initial_password text;
-- v149: the password in use (shown to the teacher and the office), and a
-- one-time grace: after the office changes the password or the Teacher ID,
-- the old ones open the dashboard once more, then a notice shows the new ones
alter table public.teacher_logins add column if not exists current_password text;
alter table public.teacher_logins add column if not exists old_password_hash text;
alter table public.teacher_logins add column if not exists old_teacher_id text;
alter table public.teacher_logins add column if not exists grace_left int not null default 0;
alter table public.teacher_logins add column if not exists login_notice jsonb;
-- v150: every earlier password and Teacher ID of a teacher (kept, so a teacher
-- whose ID or password changed more than once can still open the dashboard the
-- first time with what they know; then the notice shows the new ones)
create table if not exists public.teacher_old_logins (
  id bigserial primary key,
  teacher_id text not null,
  old_id text,
  pw_hash text,
  created_at timestamptz not null default now()
);
create index if not exists teacher_old_logins_tid on public.teacher_old_logins (teacher_id);
create index if not exists teacher_old_logins_oid on public.teacher_old_logins (old_id);
alter table public.teacher_old_logins enable row level security;
revoke all on public.teacher_old_logins from public, anon, authenticated;
alter table public.teacher_logins enable row level security;
drop policy if exists "Teachers see their own sign-in" on public.teacher_logins;
create policy "Teachers see their own sign-in" on public.teacher_logins
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Executives manage sign-ins" on public.teacher_logins;
create policy "Executives manage sign-ins" on public.teacher_logins
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- The signed-in teacher's ID. All three must hold:
--   1. signed in with Google, with the Gmail linked to the Teacher ID
--   2. this device opened the dashboard with Teacher ID + password (or it was
--      the very first sign-in), see teacher_unlock in 7l
--   3. the password was entered on this device (v146: several devices at a time)
create table if not exists public.teacher_sessions (
  session_id uuid primary key,
  user_id uuid not null,
  device text,
  created_at timestamptz not null default now()
);
alter table public.teacher_sessions enable row level security;
create index if not exists teacher_sessions_user on public.teacher_sessions (user_id);
create or replace function public.my_teacher_id()
returns text language sql stable security definer set search_path = public as $$
  select p.teacher_id
  from public.teacher_profiles p
  join public.teacher_logins l on l.teacher_id = p.teacher_id
  where p.user_id = auth.uid() and p.link_status = 'active'
    and public.gmail_key(p.email) = public.gmail_key(public.google_email())
    and not l.disabled
    -- v146: any device where the password was entered (several at a time)
    and exists (select 1 from public.teacher_sessions ts where ts.session_id = public.current_session_id() and ts.user_id = auth.uid())
  limit 1;
$$;

-- Security log (read by Executives in Management Portal -> Security)
create table if not exists public.security_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  kind text not null,
  email text,
  teacher_id text,
  user_id uuid,
  device text,
  detail text
);
create index if not exists security_events_at on public.security_events (at desc);
create index if not exists security_events_kind on public.security_events (kind, at desc);
alter table public.security_events enable row level security;
create or replace function public.log_security(p_kind text, p_teacher_id text default null, p_detail text default null, p_device text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.security_events (kind, email, teacher_id, user_id, device, detail)
  values (p_kind, nullif(lower(coalesce(auth.jwt() ->> 'email', '')), ''), p_teacher_id, auth.uid(), left(p_device, 160), left(p_detail, 300));
$$;

-- Opens the dashboard on this device. v146: the teacher's other devices stay
-- open (the same Gmail on each); active_* keeps the most recent device.
create or replace function public.activate_teacher_session(p_teacher_id text, p_device text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid := public.current_session_id(); dev text := left(nullif(btrim(coalesce(p_device, '')), ''), 160);
begin
  if sid is null then raise exception 'session_missing'; end if;
  update public.teacher_logins set active_session = sid, active_device = dev, active_since = now(), last_seen = now()
  where teacher_id = p_teacher_id;
  delete from public.teacher_sessions ts where not exists (select 1 from auth.sessions ss where ss.id = ts.session_id);
  insert into public.teacher_sessions (session_id, user_id, device) values (sid, auth.uid(), dev)
  on conflict (session_id) do update set user_id = excluded.user_id, device = excluded.device, created_at = now();
  update public.teacher_profiles set first_unlock_at = coalesce(first_unlock_at, now()) where user_id = auth.uid();
  perform public.log_security('signed_in', p_teacher_id, null, p_device);
  return jsonb_build_object('ok', true, 'teacherId', p_teacher_id, 'tookOver', false);
end $$;

-- Wherever the office locks a teacher out (new password, sign-in switched off,
-- Gmail changed, "sign out"), active_session is cleared: every device of that
-- teacher then needs the password again.
create or replace function public.teacher_logins_lock_all()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.active_session is null and old.active_session is not null then
    delete from public.teacher_sessions where user_id in (select user_id from public.teacher_profiles where teacher_id = new.teacher_id);
  end if;
  return new;
end $$;
drop trigger if exists teacher_logins_lock_all on public.teacher_logins;
create trigger teacher_logins_lock_all after update of active_session on public.teacher_logins
  for each row execute function public.teacher_logins_lock_all();
-- Devices that were open before this update stay open
insert into public.teacher_sessions (session_id, user_id, device)
  select l.active_session, p.user_id, l.active_device from public.teacher_logins l
  join public.teacher_profiles p on p.teacher_id = l.teacher_id and p.link_status = 'active'
  where l.active_session is not null and exists (select 1 from auth.sessions ss where ss.id = l.active_session and ss.user_id = p.user_id)
  on conflict (session_id) do nothing;


-- True when the signed-in teacher is the assigned teacher of that student
create or replace function public.teaches(p_student text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal_students s
    where s.id = p_student and s.teacher_id is not null and s.teacher_id = public.my_teacher_id()
  );
$$;

-- 4. Class schedules -------------------------------------------------------
create table if not exists public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null default public.my_teacher_id(),
  student_id text not null,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  duration_min int not null default 45 check (duration_min between 10 and 240),
  timezone text not null default 'Asia/Dhaka' check (char_length(timezone) <= 60),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists class_schedules_teacher_idx on public.class_schedules (teacher_id);
alter table public.class_schedules enable row level security;

drop policy if exists "Teachers read their schedules" on public.class_schedules;
create policy "Teachers read their schedules" on public.class_schedules
  for select to authenticated using (teacher_id = (select public.my_teacher_id()));

drop policy if exists "Teachers add schedules for their students" on public.class_schedules;
create policy "Teachers add schedules for their students" on public.class_schedules
  for insert to authenticated with check (teacher_id = (select public.my_teacher_id()) and public.teaches(student_id));

drop policy if exists "Teachers change their schedules" on public.class_schedules;
create policy "Teachers change their schedules" on public.class_schedules
  for update to authenticated
  using (teacher_id = (select public.my_teacher_id()))
  with check (teacher_id = (select public.my_teacher_id()) and public.teaches(student_id));

drop policy if exists "Teachers remove their schedules" on public.class_schedules;
create policy "Teachers remove their schedules" on public.class_schedules
  for delete to authenticated using (teacher_id = (select public.my_teacher_id()));

drop policy if exists "Executives manage schedules" on public.class_schedules;
create policy "Executives manage schedules" on public.class_schedules
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- 5. Monthly reports -------------------------------------------------------
create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null default public.my_teacher_id(),
  student_id text not null,
  student_name text,
  teacher_name text,
  month text not null check (month in ('January','February','March','April','May','June','July','August','September','October','November','December')),
  year int not null check (year between 2020 and 2100),
  total_classes int check (total_classes between 0 and 62),
  present int check (present between 0 and 62),
  absent int check (absent between 0 and 62),
  absence_reason text check (absence_reason is null or char_length(absence_reason) <= 500),
  status_level text check (status_level in ('excellent', 'veryGood', 'good', 'average', 'weak')),
  status_note text check (status_note is null or char_length(status_note) <= 1000),
  current_lesson text check (current_lesson is null or char_length(current_lesson) <= 1000),
  taught text check (taught is null or char_length(taught) <= 2000),
  next_target text check (next_target is null or char_length(next_target) <= 1000),
  remarks text not null check (char_length(trim(remarks)) between 1 and 2000),
  review_status text not null default 'submitted' check (review_status in ('submitted', 'reviewed', 'needs_changes')),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by text,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_reports_present_le_total check (present is null or total_classes is null or present <= total_classes),
  constraint monthly_reports_one_per_month unique (student_id, month, year)
);
create index if not exists monthly_reports_teacher_idx on public.monthly_reports (teacher_id);
alter table public.monthly_reports enable row level security;

-- Fills names, absent count and timestamps; stops teachers from touching
-- the review fields; a corrected report goes back to "submitted".
create or replace function public.monthly_reports_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select coalesce(nullif(data ->> 'name', ''), new.student_name) into new.student_name
    from public.portal_students where id = new.student_id;
  select coalesce(nullif(data ->> 'name', ''), new.teacher_name) into new.teacher_name
    from public.portal_teachers where id = new.teacher_id;
  if new.absent is null and new.total_classes is not null and new.present is not null then
    new.absent := greatest(new.total_classes - new.present, 0);
  end if;
  new.remarks := trim(new.remarks);
  new.updated_at := now();
  if not public.is_staff() then
    if tg_op = 'INSERT' then
      new.review_status := 'submitted';
      new.review_note := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.submitted_at := now();
    else
      new.review_status := 'submitted';
      new.review_note := old.review_note;
      new.reviewed_by := old.reviewed_by;
      new.reviewed_at := old.reviewed_at;
      new.submitted_at := now();
      new.teacher_id := old.teacher_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists monthly_reports_before_write on public.monthly_reports;
create trigger monthly_reports_before_write before insert or update on public.monthly_reports
  for each row execute function public.monthly_reports_before_write();

drop policy if exists "Teachers read their reports" on public.monthly_reports;
create policy "Teachers read their reports" on public.monthly_reports
  for select to authenticated using (teacher_id = (select public.my_teacher_id()));

drop policy if exists "Teachers submit reports for their students" on public.monthly_reports;
create policy "Teachers submit reports for their students" on public.monthly_reports
  for insert to authenticated with check (teacher_id = (select public.my_teacher_id()) and public.teaches(student_id));

-- A teacher can correct a report until it has been marked "reviewed"
drop policy if exists "Teachers correct unreviewed reports" on public.monthly_reports;
create policy "Teachers correct unreviewed reports" on public.monthly_reports
  for update to authenticated
  using (teacher_id = (select public.my_teacher_id()) and review_status <> 'reviewed')
  with check (teacher_id = (select public.my_teacher_id()) and public.teaches(student_id));

drop policy if exists "Staff read all reports" on public.monthly_reports;
create policy "Staff read all reports" on public.monthly_reports
  for select to authenticated using ((select public.is_staff()));

drop policy if exists "Executives manage reports" on public.monthly_reports;
create policy "Executives manage reports" on public.monthly_reports
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- 6. Teacher support & inquiries -------------------------------------------
create table if not exists public.teacher_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  teacher_id text not null default public.my_teacher_id(),
  teacher_name text,
  category text not null check (category in ('general', 'issue', 'leave', 'salary', 'other')),
  subject text not null check (char_length(trim(subject)) between 3 and 150),
  message text not null check (char_length(trim(message)) between 5 and 3000),
  leave_from date,
  leave_to date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  admin_reply text check (admin_reply is null or char_length(admin_reply) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_inquiries_leave_dates check (leave_to is null or leave_from is null or leave_to >= leave_from)
);
alter table public.teacher_inquiries enable row level security;

create or replace function public.teacher_inquiries_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select full_name into new.teacher_name from public.teacher_profiles where user_id = new.user_id;
    if new.teacher_name is null then
      select data ->> 'name' into new.teacher_name from public.portal_teachers where id = new.teacher_id;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists teacher_inquiries_before_write on public.teacher_inquiries;
create trigger teacher_inquiries_before_write before insert or update on public.teacher_inquiries
  for each row execute function public.teacher_inquiries_before_write();

drop policy if exists "Teachers read their inquiries" on public.teacher_inquiries;
create policy "Teachers read their inquiries" on public.teacher_inquiries
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Teachers send inquiries" on public.teacher_inquiries;
create policy "Teachers send inquiries" on public.teacher_inquiries
  for insert to authenticated
  with check (user_id = auth.uid() and teacher_id = (select public.my_teacher_id()) and status = 'open' and admin_reply is null);

drop policy if exists "Executives manage teacher inquiries" on public.teacher_inquiries;
create policy "Executives manage teacher inquiries" on public.teacher_inquiries
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- 7. Functions the website calls -------------------------------------------

-- Who is signed in and what they may open:
-- role = super | junior | teacher
--        | locked  (teacher's Gmail, but this device still needs Teacher ID
--                   + password, or another device took over)
--        | pending (waiting for office approval) | new (Gmail, not linked yet)
--        | none
create or replace function public.my_access()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  g text := public.google_email();
  p public.teacher_profiles;
  l public.teacher_logins;
  sid uuid := public.current_session_id();
begin
  if auth.uid() is null then return jsonb_build_object('role', 'none'); end if;
  -- An account the office removed is signed out straight away
  if not exists (select 1 from auth.users where id = auth.uid()) then return jsonb_build_object('role', 'none'); end if;
  -- Signed in without Google (e.g. an old Teacher ID or admin password sign-in): no access
  if g = '' then
    return jsonb_build_object('role', 'none', 'reason', 'google_required', 'email', lower(coalesce(auth.jwt() ->> 'email', '')));
  end if;
  if public.is_admin() then return jsonb_build_object('role', 'super', 'email', g); end if;
  -- Executive Gmail, but this device still needs the Executive password
  if public.is_executive_gmail() then return jsonb_build_object('role', 'exec_locked', 'email', g); end if;
  if public.is_junior() then return jsonb_build_object('role', 'junior', 'email', g); end if;
  -- Junior Admin Gmail, but this device still needs the PIN (hasPin = false: choose one now)
  if public.is_junior_gmail() then
    return jsonb_build_object('role', 'junior_locked', 'email', g,
      'shared', exists (select 1 from public.junior_password),
      'pinLength', coalesce((select pin_length from public.junior_password where id = 1), 0),
      'hasPin', exists (select 1 from public.junior_password)
             or exists (select 1 from public.junior_secrets js where public.gmail_key(js.email) = public.gmail_key(g)));
  end if;
  select * into p from public.teacher_profiles where user_id = auth.uid();
  if found and p.link_status = 'pending' then
    return jsonb_build_object('role', 'pending', 'email', p.email, 'fullName', p.full_name, 'whatsapp', p.whatsapp,
      'claimTeacherId', p.claim_teacher_id,
      'claimName', (select data ->> 'name' from public.portal_teachers where id = p.claim_teacher_id));
  end if;
  if found and public.gmail_key(p.email) = public.gmail_key(g) then
    select * into l from public.teacher_logins where teacher_id = p.teacher_id;
    if l.teacher_id is not null and not l.disabled and exists (select 1 from public.teacher_sessions ts where ts.session_id = sid and ts.user_id = auth.uid()) then
      return jsonb_build_object('role', 'teacher', 'email', p.email, 'teacherId', p.teacher_id, 'fullName', p.full_name,
        'whatsapp', p.whatsapp, 'via', 'google');
    end if;
    return jsonb_build_object('role', 'locked', 'email', p.email, 'fullName', p.full_name, 'teacherId', p.teacher_id,
      'firstTime', p.first_unlock_at is null,
      'off', l.teacher_id is null or l.disabled,
      -- another device has the dashboard open right now
      -- v146: other devices stay open, so there is nothing to warn about
      'elsewhere', false);
  end if;
  if public.is_gmail(g) then return jsonb_build_object('role', 'new', 'email', g); end if;
  return jsonb_build_object('role', 'none', 'email', g);
end $$;

-- Names compared without titles, dots, case or extra spaces
create or replace function public.norm_name(n text)
returns text language sql immutable as $$
  select trim(regexp_replace(
    regexp_replace(lower(coalesce(n, '')), '\m(mr|mrs|ms|md|mst|hafez|hafiz|hafeza|ustad|ustadh|ustadha|mawlana|maulana|moulana|sheikh|shaikh)\M\.?', ' ', 'g'),
    '[\s.]+', ' ', 'g'));
$$;

-- Loose name match: every word of the shorter name appears in the longer one
-- (at least 2 words; titles, dots and the word "QIT" ignored).
-- "Abdul Karim QIT" ~ "Hafez Abdul Karim"; "Karim" alone never matches.
create or replace function public.names_match(a text, b text)
returns boolean language sql immutable as $$
  with w as (
    select array(select x from unnest(string_to_array(public.norm_name(a), ' ')) x where char_length(x) > 1 and x <> 'qit') as wa,
           array(select x from unnest(string_to_array(public.norm_name(b), ' ')) x where char_length(x) > 1 and x <> 'qit') as wb)
  select case when cardinality(wa) <= cardinality(wb)
              then cardinality(wa) >= 2 and wa <@ wb
              else cardinality(wb) >= 2 and wb <@ wa end
  from w;
$$;

-- Creates a new teacher in the Teachers List / Salary Directory (QIT-###)
drop function if exists public.create_portal_teacher(text, text, text);
-- Next free ID in a category: QIT-R007 … (numbers of deleted teachers that
-- still have reports or attendance are never reused)
create or replace function public.next_category_teacher_id(p_category text)
returns text language plpgsql security definer set search_path = public as $$
declare l text := public.teacher_cat_letter(p_category); n int;
begin
  if l is null then raise exception 'Choose a category: Residential, Non-Residential Male or Non-Residential Female.'; end if;
  perform pg_advisory_xact_lock(hashtext('qit_teacher_id'));
  select coalesce(max(substring(x from '^QIT-' || l || '([0-9]+)$')::int), 0) + 1 into n
  from (select id as x from public.portal_teachers
        union all select teacher_id from public.monthly_reports
        union all select teacher_id from public.daily_attendance
        union all select teacher_id from public.teacher_logins) ids
  where x ~ ('^QIT-' || l || '[0-9]+$');
  return 'QIT-' || l || lpad(n::text, 3, '0');
end $$;

-- A new teacher in the Teachers List / Salary Directory, with the next ID of
-- their category
create or replace function public.create_portal_teacher(p_name text, p_gmail text, p_whatsapp text, p_category text)
returns text language plpgsql security definer set search_path = public as $$
declare tid text;
begin
  tid := public.next_category_teacher_id(p_category);
  insert into public.portal_teachers (id, data) values (tid, jsonb_build_object(
    'id', tid, 'name', regexp_replace(trim(p_name), '\s+', ' ', 'g'), 'category', public.teacher_cat_name(public.teacher_cat_letter(p_category)), 'department', '',
    'salaryType', 'Per-Student', 'packageAmount', 0, 'method', '',
    'email', nullif(lower(trim(coalesce(p_gmail, ''))), ''), 'whatsapp', trim(coalesce(p_whatsapp, '')),
    'status', 'Active', 'selfRegistered', true));
  return tid;
end $$;

-- First sign-in: saves the name and WhatsApp number and links the teacher to
-- ONE record in the Teachers List / Salary Directory (single source of truth):
--   1. Gmail already on a teacher's record       -> that Teacher ID
--   2. Same WhatsApp number, or else same name   -> that Teacher ID, and the
--      (teacher with no Gmail / account yet)        Gmail is saved on the record
--      (a name shared by several teachers waits for an Executive to choose)
--   3. Nothing matches                           -> a new teacher entry (QIT-###)
create or replace function public.teacher_complete_profile(p_full_name text, p_whatsapp text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  g text := public.google_email();
  existing public.teacher_profiles;
  tid text;
  claim_id text;
  claim_name text;
  how text;
  n int;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not public.is_gmail(g) then raise exception 'Teachers must sign in with a Gmail account through Google.'; end if;
  if public.is_staff() or public.is_executive_gmail() then raise exception 'This Google account belongs to an admin, not a teacher.'; end if;
  if char_length(trim(coalesce(p_full_name, ''))) < 2 then raise exception 'Please enter your full name.'; end if;
  if char_length(public.phone_key(p_whatsapp)) < 7 then raise exception 'Please enter a valid WhatsApp number.'; end if;

  select * into existing from public.teacher_profiles where user_id = auth.uid();
  if found then
    return jsonb_build_object('teacherId', existing.teacher_id, 'fullName', existing.full_name, 'linked', true,
      'pending', existing.link_status = 'pending');
  end if;
  if public.current_session_id() is null then raise exception 'Please sign in again.'; end if;

  perform pg_advisory_xact_lock(hashtext('qit_teacher_link'));

  -- 1. An Executive entered this Gmail on the teacher's record
  select t.id into tid from public.portal_teachers t
    where public.gmail_key(t.email) = public.gmail_key(g) and not exists (select 1 from public.teacher_profiles x where x.teacher_id = t.id)
    limit 1;
  if tid is not null then
    update public.portal_teachers
      set data = data || jsonb_build_object('whatsapp', coalesce(nullif(nullif(data ->> 'whatsapp', ''), 'N/A'), trim(p_whatsapp))), updated_at = now()
      where id = tid;
    insert into public.teacher_profiles (user_id, teacher_id, full_name, whatsapp, email, linked_by)
      values (auth.uid(), tid, trim(p_full_name), trim(p_whatsapp), g, 'gmail');
    -- The very first sign-in: this device opens the dashboard now
    perform public.activate_teacher_session(tid, null);
    perform public.log_security('gmail_linked', tid, 'Gmail on the teacher record (first sign-in)');
    return jsonb_build_object('teacherId', tid, 'fullName', trim(p_full_name), 'linked', true);
  end if;

  -- 2. An existing teacher (no Gmail and no account yet) with the same
  --    WhatsApp number, or else the same name: linked straight away, no
  --    approval needed. The Gmail is locked to that Teacher ID and the
  --    dashboard opens. Only when the name matches SEVERAL teachers does it
  --    wait for an Executive to choose (Teacher Dashboards).
  select t.id into tid from public.portal_teachers t
    where char_length(public.phone_key(p_whatsapp)) >= 7
      and public.phone_key(t.data ->> 'whatsapp') = public.phone_key(p_whatsapp)
      and t.email is null
      and not exists (select 1 from public.teacher_profiles x where x.teacher_id = t.id)
    order by t.id limit 1;
  if tid is not null then
    how := 'whatsapp';
  else
    select count(*), min(t.id) into n, tid from public.portal_teachers t
      where public.norm_name(t.data ->> 'name') = public.norm_name(p_full_name)
        and public.norm_name(p_full_name) <> ''
        and t.email is null
        and not exists (select 1 from public.teacher_profiles x where x.teacher_id = t.id);
    -- No exact match: allow an extra or missing word ("Abdul Karim QIT" ~ "Abdul Karim")
    if n = 0 then
      select count(*), min(t.id) into n, tid from public.portal_teachers t
        where public.names_match(t.data ->> 'name', p_full_name)
          and t.email is null
          and not exists (select 1 from public.teacher_profiles x where x.teacher_id = t.id);
    end if;
    if n = 1 then
      how := 'name';
    elsif n > 1 then
      select t.data ->> 'name' into claim_name from public.portal_teachers t where t.id = tid;
      insert into public.teacher_profiles (user_id, teacher_id, full_name, whatsapp, email, link_status, claim_teacher_id, linked_by)
        values (auth.uid(), null, trim(p_full_name), trim(p_whatsapp), g, 'pending', tid, 'name');
      perform public.log_security('link_requested', tid, 'Name matches several teachers; waiting for an Executive');
      return jsonb_build_object('pending', true, 'fullName', trim(p_full_name), 'claimTeacherId', tid, 'claimName', claim_name);
    else
      tid := null;
    end if;
  end if;
  if tid is not null then
    perform set_config('qit.keep_password', 'on', true);
    update public.portal_teachers
      set data = data || jsonb_build_object('email', g,
            'whatsapp', coalesce(nullif(nullif(data ->> 'whatsapp', ''), 'N/A'), trim(p_whatsapp))), updated_at = now()
      where id = tid;
    insert into public.teacher_profiles (user_id, teacher_id, full_name, whatsapp, email, linked_by)
      values (auth.uid(), tid, trim(p_full_name), trim(p_whatsapp), g, how);
    perform public.activate_teacher_session(tid, null);
    perform public.log_security('gmail_linked', tid, 'Matched by ' || how || ' at first sign-in (no approval needed)');
    return jsonb_build_object('teacherId', tid, 'fullName', trim(p_full_name), 'linked', true, 'matchedBy', how);
  end if;

  -- 3. Completely new teacher
  --    Waits for an Executive to approve and choose the category; the Teacher
  --    ID (QIT-R… / QIT-M… / QIT-F…) and password are made then.
  insert into public.teacher_profiles (user_id, teacher_id, full_name, whatsapp, email, link_status, claim_teacher_id, linked_by)
    values (auth.uid(), null, trim(p_full_name), trim(p_whatsapp), g, 'pending', null, 'new');
  perform public.log_security('link_requested', null, 'New teacher ' || trim(p_full_name) || '; waiting for an Executive to choose the category');
  return jsonb_build_object('pending', true, 'fullName', trim(p_full_name), 'newTeacher', true);
end $$;

-- Which teacher a request is about: the signed-in teacher, or any teacher
-- when an Executive opens that teacher's dashboard
create or replace function public.resolve_teacher(p_teacher_id text)
returns text language plpgsql stable security definer set search_path = public as $$
declare mine text := public.my_teacher_id();
begin
  if p_teacher_id is null or p_teacher_id = mine then
    if mine is null then raise exception 'Complete your teacher profile first.'; end if;
    return mine;
  end if;
  if public.is_admin() then return p_teacher_id; end if;
  raise exception 'Not allowed.';
end $$;

-- The teacher's own record and students (no fees, shares or bank details).
-- Executives may pass a Teacher ID to open that teacher's dashboard.
drop function if exists public.teacher_home();
create or replace function public.teacher_home(p_teacher_id text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare tid text := public.resolve_teacher(p_teacher_id);
begin
  return jsonb_build_object(
    'teacher', (select jsonb_build_object(
        'id', t.id, 'name', t.data ->> 'name', 'category', t.data ->> 'category', 'department', t.data ->> 'department',
        'salaryType', t.data ->> 'salaryType', 'whatsapp', coalesce(p.whatsapp, nullif(t.data ->> 'whatsapp', 'N/A')),
        'email', coalesce(p.email, t.email), 'fullName', coalesce(p.full_name, t.data ->> 'name'),
        'hasAccount', p.user_id is not null, 'userId', p.user_id)
      from public.portal_teachers t left join public.teacher_profiles p on p.teacher_id = t.id and p.link_status = 'active'
      where t.id = tid),
    'students', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.data ->> 'name', 'phone', s.data ->> 'phone', 'course', s.data ->> 'course',
        'status', s.data ->> 'status', 'classTime', s.data ->> 'classTime', 'since', s.created_at,
        'scheduleType', case when s.data ->> 'scheduleType' = 'flexible' then 'flexible' else 'fixed' end,
        'medium', s.data ->> 'medium', 'assignDate', s.data ->> 'assignDate',
        'deleteRequested', s.data -> 'deleteRequest' is not null and s.data -> 'deleteRequest' <> 'null'::jsonb)
        order by s.data ->> 'name')
      from public.portal_students s where s.teacher_id = tid), '[]'::jsonb));
end $$;

-- Teachers edit their own students (name, WhatsApp, course, class time,
-- fixed / flexible schedule). Only these fields: never the fee, the share or
-- the assigned teacher. Writes to portal_students, so the Management Portal
-- shows the change at once. Executives may pass a Teacher ID (admin mode).
create or replace function public.teacher_update_student(p_student_id text, p_patch jsonb, p_teacher_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid text := public.resolve_teacher(p_teacher_id);
  cur public.portal_students;
  v jsonb := '{}'::jsonb;
  x text;
begin
  select * into cur from public.portal_students where id = p_student_id;
  if not found or cur.teacher_id is distinct from tid then raise exception 'Not allowed.'; end if;
  if p_patch ? 'name' then
    x := regexp_replace(btrim(coalesce(p_patch ->> 'name', '')), '\s+', ' ', 'g');
    if char_length(x) < 2 or char_length(x) > 120 then raise exception 'student_name_invalid'; end if;
    v := v || jsonb_build_object('name', x);
  end if;
  if p_patch ? 'phone' then
    x := btrim(coalesce(p_patch ->> 'phone', ''));
    if char_length(x) > 300 then raise exception 'student_phone_invalid'; end if;
    v := v || jsonb_build_object('phone', coalesce(nullif(x, ''), 'N/A'));
  end if;
  if p_patch ? 'course' then
    x := btrim(coalesce(p_patch ->> 'course', ''));
    if char_length(x) > 120 then raise exception 'student_course_invalid'; end if;
    v := v || jsonb_build_object('course', x);
  end if;
  if p_patch ? 'classTime' then
    x := btrim(coalesce(p_patch ->> 'classTime', ''));
    if char_length(x) > 120 then raise exception 'student_time_invalid'; end if;
    v := v || jsonb_build_object('classTime', x);
  end if;
  if p_patch ? 'scheduleType' then
    x := p_patch ->> 'scheduleType';
    if x not in ('fixed', 'flexible') then raise exception 'student_schedule_invalid'; end if;
    v := v || jsonb_build_object('scheduleType', x);
    -- A flexible student has no fixed weekly times
    if x = 'flexible' then delete from public.class_schedules where student_id = p_student_id; end if;
  end if;
  -- Active / Hold / Inactive: the teacher can pause a student or bring them back
  if p_patch ? 'status' then
    x := p_patch ->> 'status';
    if x not in ('Active', 'Hold', 'Inactive') then raise exception 'student_status_invalid'; end if;
    v := v || jsonb_build_object('status', x);
    -- v149: a dated change (salary and revenue are counted by days)
    if x is distinct from coalesce(nullif(cur.data ->> 'status', ''), 'Active') then
      v := v || jsonb_build_object('statusLog', coalesce(cur.data -> 'statusLog', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'status', x, 'date', coalesce(case when (p_patch ->> 'statusDate') ~ '^\d{4}-\d{2}-\d{2}$' then p_patch ->> 'statusDate' end, public.bd_today()::text),
        'from', coalesce(nullif(cur.data ->> 'status', ''), 'Active'), 'by', 'teacher')));
    end if;
  end if;
  -- v149: Bangla Medium / English Medium
  if p_patch ? 'medium' then
    x := p_patch ->> 'medium';
    if x not in ('Bangla Medium', 'English Medium') then raise exception 'student_medium_invalid'; end if;
    v := v || jsonb_build_object('medium', x);
  end if;
  update public.portal_students set data = data || v, updated_at = now() where id = p_student_id;
  return (select jsonb_build_object('id', s.id, 'name', s.data ->> 'name', 'phone', s.data ->> 'phone', 'course', s.data ->> 'course',
    'status', coalesce(nullif(s.data ->> 'status', ''), 'Active'),
    'classTime', s.data ->> 'classTime', 'scheduleType', coalesce(s.data ->> 'scheduleType', 'fixed'), 'medium', s.data ->> 'medium') from public.portal_students s where s.id = p_student_id);
end $$;
-- Switching a student to "flexible" (from the Teacher Dashboard or the
-- Management Portal) removes their fixed weekly class times.
create or replace function public.portal_students_flexible_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.data ->> 'scheduleType' = 'flexible' and coalesce(old.data ->> 'scheduleType', 'fixed') <> 'flexible' then
    delete from public.class_schedules where student_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists portal_students_flexible_sync on public.portal_students;
create trigger portal_students_flexible_sync after update on public.portal_students
  for each row execute function public.portal_students_flexible_sync();
revoke all on function public.portal_students_flexible_sync() from public, anon, authenticated;
revoke all on function public.teacher_update_student(text, jsonb, text) from public, anon;
grant execute on function public.teacher_update_student(text, jsonb, text) to authenticated;

-- Salary history: the monthly amount and every payment
drop function if exists public.teacher_salary();
create or replace function public.teacher_salary(p_teacher_id text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  tid text := public.resolve_teacher(p_teacher_id);
  t public.portal_teachers;
begin
  select * into t from public.portal_teachers where id = tid;
  return jsonb_build_object(
    'salaryType', coalesce(t.data ->> 'salaryType', 'Per-Student'),
    'monthlySalary', case when t.data ->> 'salaryType' = 'Package'
      then coalesce(nullif(t.data ->> 'packageAmount', '')::numeric, 0)
      else coalesce((select sum(coalesce(nullif(s.data ->> 'cut', '')::numeric, 0)) from public.portal_students s
                     where s.teacher_id = tid and public.student_status_of(s.data ->> 'status') = 'Active'), 0) end,
    'since', coalesce(t.created_at, now()),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'month', p.data ->> 'month', 'year', p.data ->> 'year',
        'amount', coalesce(nullif(p.data ->> 'amount', '')::numeric, 0), 'date', p.data ->> 'date')
        order by p.data ->> 'date' desc)
      from public.portal_payments p where p.teacher_id = tid), '[]'::jsonb));
end $$;

-- Teacher list for Junior Admins and Executives (no salary or bank data)
create or replace function public.staff_teacher_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.data ->> 'name', 'category', t.data ->> 'category', 'department', t.data ->> 'department',
      'whatsapp', coalesce(p.whatsapp, t.whatsapp), 'email', coalesce(p.email, t.email),
      'hasAccount', p.user_id is not null, 'selfRegistered', coalesce((t.data ->> 'selfRegistered')::boolean, false),
      'students', (select count(*) from public.portal_students s where s.teacher_id = t.id),
      'lastReport', (select max(r.submitted_at) from public.monthly_reports r where r.teacher_id = t.id))
      order by t.id)
    from public.portal_teachers t left join public.teacher_profiles p on p.teacher_id = t.id), '[]'::jsonb);
end $$;

-- Junior Admins and Executives mark a monthly report reviewed / needs changes
create or replace function public.review_monthly_report(p_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  if p_status not in ('submitted', 'reviewed', 'needs_changes') then raise exception 'Unknown review status.'; end if;
  update public.monthly_reports
    set review_status = p_status,
        review_note = nullif(trim(coalesce(p_note, '')), ''),
        reviewed_by = lower(auth.jwt() ->> 'email'),
        reviewed_at = now()
    where id = p_id;
  if not found then raise exception 'Report not found.'; end if;
end $$;

-- Executives: connect a teacher's Google account to an existing portal
-- teacher (e.g. they signed in before their Gmail was entered). The empty
-- record created at sign-up is removed.
create or replace function public.admin_link_teacher_account(p_user uuid, p_teacher_id text)
returns void language plpgsql security definer set search_path = public as $$
declare old_tid text;
begin
  if not public.is_admin() then raise exception 'Only an Executive can do this.'; end if;
  if not exists (select 1 from public.portal_teachers where id = p_teacher_id) then raise exception 'Teacher % not found.', p_teacher_id; end if;
  if exists (select 1 from public.teacher_profiles where teacher_id = p_teacher_id and user_id <> p_user) then
    raise exception 'Teacher % is already linked to another account.', p_teacher_id;
  end if;
  if not exists (select 1 from public.teacher_profiles where user_id = p_user) then raise exception 'That account has not finished onboarding.'; end if;
  select teacher_id into old_tid from public.teacher_profiles where user_id = p_user;
  if old_tid is null then
    -- A pending claim: connect it to the chosen record
    update public.teacher_profiles set teacher_id = p_teacher_id, link_status = 'active', claim_teacher_id = null, first_unlock_at = null where user_id = p_user;
    perform public.log_security('link_approved', p_teacher_id, 'Linked by an Executive');
    update public.portal_teachers t
      set data = t.data || jsonb_build_object(
        'email', coalesce(nullif(t.data ->> 'email', ''), (select email from public.teacher_profiles where user_id = p_user)),
        'whatsapp', coalesce(nullif(nullif(t.data ->> 'whatsapp', ''), 'N/A'), (select whatsapp from public.teacher_profiles where user_id = p_user))),
        updated_at = now()
      where t.id = p_teacher_id;
    return;
  end if;
  if old_tid = p_teacher_id then return; end if;
  -- Free the sign-up record first (its Gmail moves to the real record)
  delete from public.portal_teachers t
    where t.id = old_tid and coalesce((t.data ->> 'selfRegistered')::boolean, false)
      and not exists (select 1 from public.portal_students s where s.teacher_id = old_tid)
      and not exists (select 1 from public.portal_payments p where p.teacher_id = old_tid);
  update public.portal_teachers set data = data - 'email', updated_at = now() where id = old_tid;
  update public.teacher_profiles set teacher_id = p_teacher_id, first_unlock_at = null where user_id = p_user;
  perform public.log_security('link_approved', p_teacher_id, 'Moved to this Teacher ID by an Executive');
  update public.class_schedules set teacher_id = p_teacher_id where teacher_id = old_tid;
  update public.monthly_reports set teacher_id = p_teacher_id where teacher_id = old_tid;
  update public.teacher_inquiries set teacher_id = p_teacher_id where teacher_id = old_tid;
  update public.portal_teachers t
    set data = t.data || jsonb_build_object(
      'email', coalesce(nullif(t.data ->> 'email', ''), (select email from public.teacher_profiles where user_id = p_user)),
      'whatsapp', coalesce(nullif(t.data ->> 'whatsapp', ''), (select whatsapp from public.teacher_profiles where user_id = p_user))),
      updated_at = now()
    where t.id = p_teacher_id;
end $$;

-- Only signed-in users may call these
do $$
declare f text;
begin
  foreach f in array array['my_access()', 'teacher_complete_profile(text, text)', 'teacher_home(text)', 'teacher_salary(text)',
    'staff_teacher_list()', 'review_monthly_report(uuid, text, text)', 'admin_link_teacher_account(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 7b. Encryption of bank / account details ---------------------------------
-- Supabase encrypts the whole database on disk. On top of that, each teacher's
-- bank name, branch and account number are stored encrypted (pgcrypto,
-- AES) with a key kept in Supabase Vault, and only an Executive's request can
-- decrypt them (admin_portal_teachers). Salary amounts stay readable to the
-- database so it can add them up, and are protected by the rules above.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.qit_keys (name text primary key, key text not null);
alter table private.qit_keys enable row level security;  -- no policies: only the database itself can read it
revoke all on private.qit_keys from public, anon, authenticated;

do $$
declare have_key boolean := false;
begin
  begin
    execute 'select exists (select 1 from vault.secrets where name = $1)' into have_key using 'qit_data_key';
    if not have_key then
      execute 'select vault.create_secret($1, $2, $3)' using encode(extensions.gen_random_bytes(32), 'hex'), 'qit_data_key', 'QIT: key for teacher bank details';
    end if;
  exception when others then
    -- Vault not available: keep the key in a private, non-public table instead
    insert into private.qit_keys (name, key) values ('qit_data_key', encode(extensions.gen_random_bytes(32), 'hex'))
      on conflict (name) do nothing;
  end;
end $$;

create or replace function public.qit_data_key()
returns text language plpgsql stable security definer set search_path = public as $$
declare k text;
begin
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into k using 'qit_data_key';
  exception when others then k := null;
  end;
  if k is null then select key into k from private.qit_keys where name = 'qit_data_key'; end if;
  if k is null then raise exception 'Encryption key missing - run teacher-dashboard.sql again.'; end if;
  return k;
end $$;
revoke all on function public.qit_data_key() from public, anon, authenticated;

alter table public.portal_teachers add column if not exists bank_enc bytea;

create or replace function public.portal_teachers_encrypt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.data ?| array['account', 'bankName', 'branchName'] then
    new.bank_enc := extensions.pgp_sym_encrypt(jsonb_build_object(
      'account', coalesce(new.data ->> 'account', ''),
      'bankName', coalesce(new.data ->> 'bankName', ''),
      'branchName', coalesce(new.data ->> 'branchName', ''))::text, public.qit_data_key());
    new.data := new.data - 'account' - 'bankName' - 'branchName';
  end if;
  return new;
end $$;
drop trigger if exists portal_teachers_encrypt on public.portal_teachers;
create trigger portal_teachers_encrypt before insert or update on public.portal_teachers
  for each row execute function public.portal_teachers_encrypt();
-- Encrypt anything saved before this existed
update public.portal_teachers set data = data where data ?| array['account', 'bankName', 'branchName'];

-- Executives: every teacher with bank details decrypted (for the portal)
create or replace function public.admin_portal_teachers()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare k text;
begin
  if not public.is_admin() then raise exception 'Not allowed.'; end if;
  k := public.qit_data_key();
  return coalesce((select jsonb_agg(
      t.data || jsonb_build_object('id', t.id)
        || coalesce(case when t.bank_enc is not null then extensions.pgp_sym_decrypt(t.bank_enc, k)::jsonb end, '{}'::jsonb)
      order by t.id)
    from public.portal_teachers t), '[]'::jsonb);
end $$;

-- 7c. Helpers for dates -------------------------------------------------------
create or replace function public.bd_today()
returns date language sql stable as $$ select (now() at time zone 'Asia/Dhaka')::date; $$;

create or replace function public.month_index(m text)
returns int language sql immutable as $$
  select array_position(array['January','February','March','April','May','June','July','August','September','October','November','December'], m);
$$;

-- 7d. Daily attendance (each student, each class day) -----------------------
-- Regular class: one entry per student per day. Recovery (make-up) class:
-- tagged is_recovery, any number of days, up to 3 per student per day.
-- Every entry needs "Today's lesson". Once a teacher submits an entry it is
-- locked for them: only Executives can change or delete it.
create table if not exists public.daily_attendance (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null default public.my_teacher_id(),
  student_id text not null,
  day date not null,
  status text not null check (status in ('present', 'absent')),
  note text check (note is null or char_length(note) <= 300),
  is_recovery boolean not null default false,
  lesson text check (lesson is null or char_length(lesson) <= 1000),
  recorded_by text,
  edited_by text,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Older installs: add the new columns
alter table public.daily_attendance add column if not exists is_recovery boolean not null default false;
alter table public.daily_attendance add column if not exists lesson text;
alter table public.daily_attendance add column if not exists recorded_by text;
alter table public.daily_attendance add column if not exists edited_by text;
alter table public.daily_attendance add column if not exists edited_at timestamptz;
-- v149: a recovery class of an earlier month waits for approval (pending / approved / rejected)
alter table public.daily_attendance add column if not exists approval text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'daily_attendance_lesson_len') then
    alter table public.daily_attendance add constraint daily_attendance_lesson_len check (lesson is null or char_length(lesson) <= 1000);
  end if;
end $$;
-- One REGULAR entry per student per day (recovery classes are not limited by this)
alter table public.daily_attendance drop constraint if exists daily_attendance_one_per_day;
create unique index if not exists daily_attendance_one_regular_per_day
  on public.daily_attendance (student_id, day) where not is_recovery;
create index if not exists daily_attendance_teacher_day_idx on public.daily_attendance (teacher_id, day);
create index if not exists daily_attendance_day_idx on public.daily_attendance (day);
alter table public.daily_attendance enable row level security;

-- The database, not the browser, enforces the rules
-- Teachers can't read portal_students directly, so the check runs as the owner
create or replace function public.student_is_flexible(p_student_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.portal_students s where s.id = p_student_id and s.data ->> 'scheduleType' = 'flexible');
$$;
revoke execute on function public.student_is_flexible(text) from public, anon;
grant execute on function public.student_is_flexible(text) to authenticated;

create or replace function public.daily_attendance_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  -- Executives, and the SQL Editor / server (not a signed-in teacher)
  v_admin boolean := current_user not in ('authenticated', 'anon') or public.is_admin();
  v_who text := coalesce(auth.jwt() ->> 'email', current_user);
  v_form text;
begin
  new.lesson := nullif(btrim(coalesce(new.lesson, '')), '');
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    new.recorded_by := v_who;
    new.edited_by := null;
    new.edited_at := null;
    if not v_admin then
      -- Which entry form this is: regular, recovery or a flexible student's class.
      -- The Executives choose which fields are required (Dashboard Editor, 7k).
      v_form := case when new.is_recovery then 'rec'
        when public.student_is_flexible(new.student_id) then 'flex'
        else 'att' end;
      if new.status = 'absent' then
        -- Absent: no lesson was taught; the reason for the absence is required
        new.lesson := null;
        if new.note is null or char_length(new.note) < 2 then
          raise exception 'attendance_reason_required' using hint = 'Write the reason for the absence.';
        end if;
      else
        if public.field_required(v_form || '.lesson', true) and (new.lesson is null or char_length(new.lesson) < 2) then
          raise exception 'attendance_lesson_required' using hint = 'Write what was taught in today''s lesson.';
        end if;
        if v_form <> 'att' and public.field_required(v_form || '.note', false) and new.note is null then
          raise exception 'required_fields_missing';
        end if;
      end if;
      if new.is_recovery and (select count(*) from public.daily_attendance
          where student_id = new.student_id and day = new.day and is_recovery) >= 3 then
        raise exception 'attendance_recovery_limit';
      end if;
    end if;
  else
    if not v_admin then
      raise exception 'attendance_locked';
    end if;
    new.created_at := old.created_at;
    new.recorded_by := old.recorded_by;
    new.updated_at := now();
    new.edited_at := now();
    new.edited_by := v_who;
  end if;
  return new;
end $$;
drop trigger if exists daily_attendance_guard on public.daily_attendance;
create trigger daily_attendance_guard before insert or update on public.daily_attendance
  for each row execute function public.daily_attendance_guard();

-- Teachers: read their own entries; add new ones for today and the previous
-- 31 days (never the future). No edit or delete rules for teachers, so a
-- submitted entry is read-only for them.
drop policy if exists "Teachers read their attendance" on public.daily_attendance;
create policy "Teachers read their attendance" on public.daily_attendance
  for select to authenticated using (teacher_id = (select public.my_teacher_id()));
drop policy if exists "Teachers mark attendance" on public.daily_attendance;
create policy "Teachers mark attendance" on public.daily_attendance
  for insert to authenticated with check (
    teacher_id = (select public.my_teacher_id()) and public.teaches(student_id)
    and day <= public.bd_today() and day >= public.bd_today() - 31);
drop policy if exists "Teachers correct attendance" on public.daily_attendance;
drop policy if exists "Teachers remove attendance" on public.daily_attendance;
drop policy if exists "Executives manage attendance" on public.daily_attendance;
create policy "Executives manage attendance" on public.daily_attendance
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- 7e. Points & levels (editable by Executives) --------------------------------
create table if not exists public.gamification_settings (
  id int primary key default 1 check (id = 1),
  config jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.gamification_settings enable row level security;
insert into public.gamification_settings (id, config) values (1, '{
  "points": {
    "presentMark": 2, "dailyLogDay": 1, "monthlyReport": 20, "reportOnTimeBonus": 10, "reportDeadlineDay": 5,
    "reviewedReport": 5, "perfectAttendanceStudent": 15,
    "excellent": 10, "veryGood": 7, "good": 5, "average": 2, "weak": 0
  },
  "levels": [
    {"min": 0, "en": "Starter", "bn": "সূচনা"},
    {"min": 150, "en": "Committed", "bn": "নিবেদিত"},
    {"min": 400, "en": "Hardworking", "bn": "পরিশ্রমী"},
    {"min": 800, "en": "Excellent", "bn": "অসাধারণ"},
    {"min": 1500, "en": "Star Teacher", "bn": "তারকা শিক্ষক"}
  ],
  "rewards": [
    {"level": "Hardworking", "en": "Certificate of appreciation", "bn": "প্রশংসাপত্র"},
    {"level": "Excellent", "en": "Monthly bonus", "bn": "মাসিক বোনাস"},
    {"level": "Star Teacher", "en": "Star Teacher award and priority for new students", "bn": "তারকা শিক্ষক সম্মাননা ও নতুন শিক্ষার্থীতে অগ্রাধিকার"}
  ]
}'::jsonb) on conflict (id) do nothing;

-- Progress baseline: points, levels, streaks and report counts start from this
-- month; older (test) entries are left out of the progress numbers.
update public.gamification_settings set config = config || '{"baselineMonth": "2026-09-01"}'::jsonb
  where id = 1 and not (config ? 'baselineMonth');
create or replace function public.progress_baseline()
returns date language sql stable security definer set search_path = public as $$
  select coalesce((select (config ->> 'baselineMonth')::date from public.gamification_settings where id = 1), date '2026-09-01');
$$;
grant execute on function public.progress_baseline() to authenticated;

drop policy if exists "Signed-in users read point rules" on public.gamification_settings;
create policy "Signed-in users read point rules" on public.gamification_settings
  for select to authenticated using (true);
drop policy if exists "Executives edit point rules" on public.gamification_settings;
create policy "Executives edit point rules" on public.gamification_settings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Manual bonus / deduction by an Executive
create table if not exists public.points_adjustments (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null,
  month text not null check (month in ('January','February','March','April','May','June','July','August','September','October','November','December')),
  year int not null check (year between 2020 and 2100),
  points int not null check (points between -10000 and 10000),
  reason text check (reason is null or char_length(reason) <= 300),
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.points_adjustments enable row level security;
drop policy if exists "Teachers see their adjustments" on public.points_adjustments;
create policy "Teachers see their adjustments" on public.points_adjustments
  for select to authenticated using (teacher_id = (select public.my_teacher_id()));
drop policy if exists "Executives manage adjustments" on public.points_adjustments;
create policy "Executives manage adjustments" on public.points_adjustments
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Points a teacher earned between two dates (reports count in their own month)
create or replace function public.teacher_points(p_tid text, p_start date, p_end date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  pt jsonb := coalesce((select config -> 'points' from public.gamification_settings where id = 1), '{}'::jsonb);
  deadline int := coalesce((pt ->> 'reportDeadlineDay')::int, 5);
  v_present int; v_days int; v_reports int; v_ontime int; v_reviewed int; v_perfect int; v_level int; v_adj int;
  r jsonb;
begin
  p_start := greatest(p_start, public.progress_baseline());
  select count(*) filter (where status = 'present'), count(distinct day) into v_present, v_days
    from public.daily_attendance where teacher_id = p_tid and day between p_start and p_end;
  select count(*),
         count(*) filter (where submitted_at::date <= (mdate + interval '1 month')::date + (deadline - 1)),
         count(*) filter (where review_status = 'reviewed'),
         count(*) filter (where total_classes > 0 and present = total_classes),
         coalesce(sum(coalesce((pt ->> status_level)::int, 0)), 0)
    into v_reports, v_ontime, v_reviewed, v_perfect, v_level
    from (select *, make_date(year, public.month_index(month), 1) as mdate from public.monthly_reports where teacher_id = p_tid) x
    where mdate between date_trunc('month', p_start)::date and p_end;
  select coalesce(sum(points), 0) into v_adj from public.points_adjustments
    where teacher_id = p_tid and make_date(year, public.month_index(month), 1) between date_trunc('month', p_start)::date and p_end;
  r := jsonb_build_object(
    'present', v_present * coalesce((pt ->> 'presentMark')::int, 0),
    'daysLogged', v_days * coalesce((pt ->> 'dailyLogDay')::int, 0),
    'reports', v_reports * coalesce((pt ->> 'monthlyReport')::int, 0),
    'onTime', v_ontime * coalesce((pt ->> 'reportOnTimeBonus')::int, 0),
    'reviewed', v_reviewed * coalesce((pt ->> 'reviewedReport')::int, 0),
    'perfectAttendance', v_perfect * coalesce((pt ->> 'perfectAttendanceStudent')::int, 0),
    'studentLevels', v_level,
    'adjustments', v_adj);
  return r || jsonb_build_object('total', (select sum(value::int) from jsonb_each_text(r)));
end $$;
revoke all on function public.teacher_points(text, date, date) from public, anon, authenticated;

-- Everything the "My Progress" page shows, for one month
create or replace function public.teacher_stats(p_teacher_id text default null, p_month text default null, p_year int default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  tid text := public.resolve_teacher(p_teacher_id);
  today date := public.bd_today();
  m text := coalesce(p_month, to_char(today, 'FMMonth'));
  y int := coalesce(p_year, extract(year from today)::int);
  m_start date := make_date(y, public.month_index(m), 1);
  m_end date := (make_date(y, public.month_index(m), 1) + interval '1 month - 1 day')::date;
  base date := public.progress_baseline();
  m_from date := greatest(make_date(y, public.month_index(m), 1), public.progress_baseline());
  cfg jsonb := (select config from public.gamification_settings where id = 1);
  v_students int; v_present int; v_absent int; v_days int; v_recovery int; v_expected int; v_reports int; v_avg numeric;
  month_pts jsonb; all_pts jsonb; total int; lvl jsonb; nxt jsonb; rank_pos int; rank_of int;
  streak int := 0; d date; wdays int[]; hist jsonb := '[]'::jsonb; hm date;
begin
  select count(*) into v_students from public.portal_students where teacher_id = tid;
  -- Regular classes give the attendance rate; recovery classes held are added to "classes conducted"
  select count(*) filter (where status = 'present' and not is_recovery), count(*) filter (where status = 'absent' and not is_recovery),
         count(distinct day) filter (where not is_recovery), count(*) filter (where status = 'present' and is_recovery and coalesce(approval, 'approved') = 'approved')
    into v_present, v_absent, v_days, v_recovery
    from public.daily_attendance where teacher_id = tid and day between m_from and m_end;
  -- Class slots in the schedule from the 1st up to today (or month end)
  select count(*) into v_expected
    from public.class_schedules c
    join generate_series(m_from, least(m_end, today), interval '1 day') g(day) on extract(dow from g.day) = c.weekday
    where c.teacher_id = tid and exists (select 1 from public.portal_students s where s.id = c.student_id and s.teacher_id = tid);
  select count(*), avg(case status_level when 'excellent' then 5 when 'veryGood' then 4 when 'good' then 3 when 'average' then 2 when 'weak' then 1 end)
    into v_reports, v_avg
    from public.monthly_reports where teacher_id = tid and month = m and year = y and m_start >= date_trunc('month', base)::date;

  month_pts := public.teacher_points(tid, m_start, m_end);
  all_pts := public.teacher_points(tid, date '2000-01-01', today);
  total := (all_pts ->> 'total')::int;
  select l into lvl from jsonb_array_elements(cfg -> 'levels') l where (l ->> 'min')::int <= total order by (l ->> 'min')::int desc limit 1;
  select l into nxt from jsonb_array_elements(cfg -> 'levels') l where (l ->> 'min')::int > total order by (l ->> 'min')::int limit 1;

  -- Rank this month among teachers who have students
  select count(*) + 1, (select count(*) from public.portal_teachers pt2 where exists (select 1 from public.portal_students s where s.teacher_id = pt2.id))
    into rank_pos, rank_of
    from public.portal_teachers o
    where o.id <> tid and exists (select 1 from public.portal_students s where s.teacher_id = o.id)
      and (public.teacher_points(o.id, m_start, m_end) ->> 'total')::int > (month_pts ->> 'total')::int;

  -- Streak: class days in a row with attendance marked (days without classes are skipped)
  select array_agg(distinct weekday) into wdays from public.class_schedules where teacher_id = tid;
  d := today;
  for i in 0..120 loop
    exit when d < base;
    if exists (select 1 from public.daily_attendance where teacher_id = tid and day = d) then
      streak := streak + 1;
    elsif d < today and wdays is not null and extract(dow from d)::int = any (wdays) then
      exit;
    end if;
    d := d - 1;
  end loop;

  -- Points of the last 6 months
  for i in reverse 5..0 loop
    hm := (date_trunc('month', m_start) - make_interval(months => i))::date;
    continue when hm < date_trunc('month', base)::date;
    hist := hist || jsonb_build_array(jsonb_build_object('month', to_char(hm, 'FMMonth'), 'year', extract(year from hm)::int,
      'points', (public.teacher_points(tid, hm, (hm + interval '1 month - 1 day')::date) ->> 'total')::int));
  end loop;

  return jsonb_build_object(
    'teacherId', tid, 'month', m, 'year', y, 'students', v_students,
    'attendance', jsonb_build_object('present', v_present, 'absent', v_absent, 'daysLogged', v_days, 'expected', v_expected,
      'recovery', v_recovery, 'conducted', v_present + v_recovery,
      'rate', case when v_present + v_absent > 0 then round(100.0 * v_present / (v_present + v_absent)) end,
      'logRate', case when v_expected > 0 then least(100, round(100.0 * (v_present + v_absent) / v_expected)) end),
    'reports', jsonb_build_object('submitted', v_reports, 'expected', v_students, 'avgLevel', round(coalesce(v_avg, 0), 1)),
    'points', jsonb_build_object('month', month_pts, 'allTime', all_pts),
    'level', lvl, 'nextLevel', nxt,
    'levelProgress', case when nxt is null then 100
      else round(100.0 * (total - coalesce((lvl ->> 'min')::int, 0)) / greatest(1, (nxt ->> 'min')::int - coalesce((lvl ->> 'min')::int, 0))) end,
    'rank', jsonb_build_object('position', rank_pos, 'of', rank_of),
    'streak', streak, 'history', hist);
end $$;

-- Executives: points of every teacher for a month
create or replace function public.admin_leaderboard(p_month text, p_year int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m_start date := make_date(p_year, public.month_index(p_month), 1);
begin
  if not public.is_admin() then raise exception 'Not allowed.'; end if;
  return coalesce((select jsonb_agg(x order by (x ->> 'points')::int desc) from (
    select jsonb_build_object('id', t.id, 'name', t.data ->> 'name',
      'students', (select count(*) from public.portal_students s where s.teacher_id = t.id),
      'points', (public.teacher_points(t.id, m_start, (m_start + interval '1 month - 1 day')::date) ->> 'total')::int,
      'allTime', (public.teacher_points(t.id, date '2000-01-01', public.bd_today()) ->> 'total')::int) as x
    from public.portal_teachers t
    where exists (select 1 from public.portal_students s where s.teacher_id = t.id)
       or exists (select 1 from public.teacher_profiles p where p.teacher_id = t.id)) q), '[]'::jsonb);
end $$;

-- 7f. Claims: approve a name match, or give the person a new Teacher ID ------
-- p_approve = true: it IS the matched teacher. false: a new teacher, who gets
-- the next ID in p_category and a random 6-digit password.
-- Returns { teacherId, password (new teachers only) }.
drop function if exists public.admin_resolve_claim(uuid, boolean);
create or replace function public.admin_resolve_claim(p_user uuid, p_approve boolean, p_category text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pr public.teacher_profiles; tid text;
begin
  if not public.is_admin() then raise exception 'Only an Executive can do this.'; end if;
  select * into pr from public.teacher_profiles where user_id = p_user;
  if not found or pr.link_status <> 'pending' then raise exception 'There is no pending request for that account.'; end if;
  if p_approve and pr.claim_teacher_id is null then raise exception 'Choose a category to give this teacher a new ID.'; end if;
  if p_approve then
    if exists (select 1 from public.teacher_profiles where teacher_id = pr.claim_teacher_id) then
      raise exception 'Teacher % is already linked to another account.', pr.claim_teacher_id;
    end if;
    tid := pr.claim_teacher_id;
    update public.portal_teachers t
      set data = t.data || jsonb_build_object('email', coalesce(nullif(t.data ->> 'email', ''), pr.email),
        'whatsapp', coalesce(nullif(nullif(t.data ->> 'whatsapp', ''), 'N/A'), pr.whatsapp)), updated_at = now()
      where t.id = tid;
  else
    tid := public.create_portal_teacher(pr.full_name, pr.email, pr.whatsapp, p_category);
  end if;
  update public.teacher_profiles set teacher_id = tid, link_status = 'active', claim_teacher_id = null, first_unlock_at = null where user_id = p_user;
  perform public.log_security(case when p_approve then 'link_approved' else 'new_teacher' end, tid, 'Approved by an Executive');
  return jsonb_build_object('teacherId', tid,
    'password', case when p_approve then null else public.teacher_default_password(tid) end);
end $$;

-- 7g. Teacher requests stay on the admin screen until resolved or dismissed ---
alter table public.teacher_inquiries add column if not exists admin_dismissed boolean not null default false;

-- 7h. Teacher ID + password sign-in ------------------------------------------
-- Every teacher in the Teachers List / Salary Directory can sign in with their
-- Teacher ID and a password made from it: 1009 + the ID number
-- (QIT-001 = 1010, QIT-002 = 1011, QIT-050 = 1059). Set automatically when a
-- teacher is added (and for everyone already in the list), stored hashed
-- (bcrypt) by Supabase Auth. Teachers cannot change it.
-- Since v102 the password alone never opens the dashboard: a teacher signs in
-- with the Google account linked to their Teacher ID AND gives the Teacher ID
-- + password (see 7l Security). The hidden qit-###@institute.local accounts
-- below only keep the password (hashed); they are blocked from signing in.
-- Executives can reset the password, set their own, switch the sign-in off,
-- hand a Teacher ID to a new person (change the Gmail on the record) and
-- remove a sign-up account (Team & Roles).
drop function if exists public.teacher_login_ids();
drop function if exists public.ensure_teacher_login(text, text);
drop function if exists public.ensure_teacher_login(text, text, text);
drop function if exists public.disable_teacher_login(text, boolean);

create or replace function public.teacher_login_email(p_teacher_id text)
returns text language sql immutable as $$
  select regexp_replace(lower(trim(coalesce(p_teacher_id, ''))), '[^a-z0-9._-]+', '-', 'g') || '@institute.local';
$$;

-- The automatic password (v149), by category and the number of the ID:
--   Residential            QIT-R001 -> 1010 … QIT-R990 -> 1999
--   Non-Residential Male   QIT-M001 -> 2020 … QIT-M980 -> 2999
--   Non-Residential Female QIT-F001 -> 3030 … QIT-F970 -> 3999
--   old IDs (QIT-001):     1009 + the number (QIT-001 -> 1010)
create or replace function public.teacher_default_password(p_teacher_id text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when public.is_category_id(p_teacher_id) then
      ((case substring(p_teacher_id from 5 for 1) when 'R' then 1009 when 'M' then 2019 else 3029 end)
        + substring(p_teacher_id from '([0-9]+)$')::int)::text
    when substring(coalesce(p_teacher_id, '') from '(\d+)\s*$') is null then '1010'
    else (1009 + substring(p_teacher_id from '(\d+)\s*$')::bigint)::text end;
$$;

-- Creates (or repairs) the Teacher ID sign-in for one teacher.
--   p_password: null keeps the current password (1009 + number for a new one)
--   p_by:       who set the password (an Executive's email), for the record
--   p_force:    true = switch it back on even if the office switched it off
create or replace function public.ensure_teacher_login(p_teacher_id text, p_password text default null,
  p_by text default null, p_force boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  em text := public.teacher_login_email(p_teacher_id);
  ip text := null; -- v149: every ID has its automatic password (no random ones)
  pw text := coalesce(p_password, ip, public.teacher_default_password(p_teacher_id));
  uid uuid;
  ours boolean;
begin
  if not exists (select 1 from public.portal_teachers where id = p_teacher_id) then
    raise exception 'No teacher with ID %', p_teacher_id;
  end if;
  -- Switched off by the office: stays off unless an Executive switches it on
  if not p_force and exists (select 1 from public.teacher_logins where teacher_id = p_teacher_id and disabled) then
    return null;
  end if;
  perform set_config('qit.teacher_login', 'on', true);

  select id, coalesce(raw_app_meta_data ->> 'qit_teacher', '') = p_teacher_id into uid, ours
    from auth.users where lower(email) = em limit 1;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
      extensions.crypt(pw, extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'qit_teacher', p_teacher_id),
      jsonb_build_object('teacher_id', p_teacher_id), now(), now(), '', '', '', '', '', '', '', '');
    update auth.users set banned_until = '2999-12-31' where id = uid;
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid::text, uid,
      jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now());
  elsif p_password is not null or not ours then
    update auth.users set
      encrypted_password = extensions.crypt(pw, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()), banned_until = '2999-12-31',
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('qit_teacher', p_teacher_id),
      updated_at = now()
    where id = uid;
    -- Devices already signed in must sign in again with the new password
    delete from auth.sessions where user_id = uid;
    delete from auth.refresh_tokens where user_id = uid::text;
  else
    -- The password account itself never signs in (Google + Teacher ID + password does)
    update auth.users set banned_until = '2999-12-31' where id = uid and (banned_until is null or banned_until < '2999-01-01');
    delete from auth.sessions where user_id = uid;
  end if;

  insert into public.teacher_logins (teacher_id, user_id, disabled, password_changed_by, password_changed_at, initial_password, current_password)
  values (p_teacher_id, uid, false, p_by, case when p_by is not null then now() end, ip, pw)
  on conflict (teacher_id) do update set user_id = excluded.user_id, disabled = false,
    current_password = case when p_password is not null or teacher_logins.current_password is null then excluded.current_password else teacher_logins.current_password end,
    initial_password = coalesce(teacher_logins.initial_password, excluded.initial_password),
    password_changed_by = coalesce(excluded.password_changed_by, teacher_logins.password_changed_by),
    password_changed_at = coalesce(excluded.password_changed_at, teacher_logins.password_changed_at);
  -- A new password: the teacher's device must sign in again with it
  if p_password is not null then
    update public.teacher_logins set active_session = null where teacher_id = p_teacher_id;
  end if;
  return uid;
end $$;

-- Switches the Teacher ID sign-in off: signed out everywhere, cannot sign in.
-- p_forget: the teacher was deleted (no record kept)
create or replace function public.disable_teacher_login(p_teacher_id text, p_forget boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  perform set_config('qit.teacher_login', 'on', true);
  select id into uid from auth.users where lower(email) = public.teacher_login_email(p_teacher_id);
  if p_forget then
    delete from public.teacher_logins where teacher_id = p_teacher_id;
  elsif uid is not null then
    insert into public.teacher_logins (teacher_id, user_id, disabled) values (p_teacher_id, uid, true)
    on conflict (teacher_id) do update set disabled = true;
  end if;
  update public.teacher_logins set active_session = null where teacher_id = p_teacher_id;
  if uid is null then return; end if;
  update auth.users set banned_until = '2999-12-31', updated_at = now() where id = uid;
  delete from auth.sessions where user_id = uid;
  delete from auth.refresh_tokens where user_id = uid::text;
end $$;

-- Teachers List changes:
--   teacher added                 -> Teacher ID sign-in with 1009 + number
--   Gmail replaced by an Executive -> the Teacher ID moves to the new person:
--     the previous Google account is unlinked, everyone is signed out and the
--     password goes back to 1009 + number
--   teacher removed               -> sign-in switched off (past reports stay)
--   name edited                   -> the linked profile follows
create or replace function public.portal_teachers_login_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_mail text; new_mail text;
begin
  if tg_op = 'DELETE' then
    perform public.disable_teacher_login(old.id, true);
    delete from public.teacher_profiles where teacher_id = old.id;
    return old;
  end if;
  if tg_op = 'INSERT' then
    perform public.ensure_teacher_login(new.id);
    return new;
  end if;
  old_mail := lower(nullif(trim(coalesce(old.data ->> 'email', '')), ''));
  new_mail := lower(nullif(trim(coalesce(new.data ->> 'email', '')), ''));
  if old_mail is not null and public.gmail_key(old_mail) is distinct from public.gmail_key(new_mail) then
    -- The Teacher ID moves to the new Gmail: the old Google account is unlinked
    -- and its device signed out
    delete from auth.sessions where user_id in (select user_id from public.teacher_profiles where teacher_id = new.id
      and public.gmail_key(email) is distinct from public.gmail_key(coalesce(new_mail, '')));
    delete from public.teacher_profiles where teacher_id = new.id and public.gmail_key(email) is distinct from public.gmail_key(coalesce(new_mail, ''));
    update public.teacher_logins set active_session = null where teacher_id = new.id;
    -- (Security -> Edit Gmail keeps the password; a hand-over in the list resets it)
    if coalesce(current_setting('qit.keep_password', true), '') <> 'on' then
      perform public.ensure_teacher_login(new.id, public.teacher_default_password(new.id));
    end if;
  end if;
  if new.data is distinct from old.data then
    update public.teacher_profiles set
      full_name = coalesce(nullif(regexp_replace(trim(coalesce(new.data ->> 'name', '')), '\s+', ' ', 'g'), ''), full_name)
    where teacher_id = new.id and char_length(trim(coalesce(new.data ->> 'name', ''))) >= 2;
  end if;
  return new;
end $$;
drop trigger if exists portal_teachers_login_sync on public.portal_teachers;
create trigger portal_teachers_login_sync after insert or update or delete on public.portal_teachers
  for each row execute function public.portal_teachers_login_sync();
-- (Google sign-up no longer needs its own trigger: every teacher already has a sign-in)
drop trigger if exists teacher_profiles_login_sync on public.teacher_profiles;
drop function if exists public.teacher_profiles_login_sync();

-- Nobody can create a teacher sign-in address themselves, and a teacher
-- cannot change their own password or address (only the office can)
create or replace function public.guard_teacher_logins()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qit.teacher_login', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT' and lower(new.email) like '%@institute.local' then
    raise exception 'This address is reserved for QIT teacher sign-in.';
  end if;
  if tg_op = 'UPDATE' and lower(old.email) like '%@institute.local' then
    new.encrypted_password := old.encrypted_password;
    new.email := old.email;
    new.email_change := old.email_change;
  end if;
  return new;
end $$;
do $$
begin
  execute 'drop trigger if exists qit_guard_teacher_logins on auth.users';
  execute 'create trigger qit_guard_teacher_logins before insert or update on auth.users
    for each row execute function public.guard_teacher_logins()';
exception when insufficient_privilege then
  raise notice 'Could not add the password lock on auth.users (not allowed here). Sign-in still works.';
end $$;

-- Everyone already in the Teachers List gets their Teacher ID sign-in now
-- (passwords the office set, and sign-ins it switched off, are kept)
do $$
declare r record;
begin
  for r in select id from public.portal_teachers loop
    perform public.ensure_teacher_login(r.id);
  end loop;
end $$;

-- The signed-in teacher: their Teacher ID and, while it is still the
-- automatic one, their password
create or replace function public.my_login_info()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare tid text := public.my_teacher_id(); l public.teacher_logins; u auth.users; dpw text;
begin
  if tid is null then return null; end if;
  select * into l from public.teacher_logins where teacher_id = tid;
  select * into u from auth.users where id = l.user_id;
  if u.id is null or l.disabled then return jsonb_build_object('teacherId', tid, 'active', false); end if;
  dpw := public.teacher_default_password(tid);
  -- v149: the password is always shown to the teacher (their own dashboard only)
  return jsonb_build_object('teacherId', tid, 'active', not l.disabled,
    'password', coalesce(l.current_password,
      case when u.encrypted_password = extensions.crypt(dpw, u.encrypted_password) then dpw end),
    'notice', l.login_notice);
end $$;

-- v149: the teacher closed the "new ID / password" notice
create or replace function public.teacher_ack_login_notice()
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare tid text := public.my_teacher_id();
begin
  if tid is null then return false; end if;
  -- v150: the teacher has seen the new ID / password: earlier ones stop working
  update public.teacher_logins set login_notice = null, grace_left = 0 where teacher_id = tid;
  return true;
end $$;
revoke all on function public.teacher_ack_login_notice() from public, anon;
grant execute on function public.teacher_ack_login_notice() to authenticated;

-- Executives: sign-in status of every teacher
create or replace function public.admin_teacher_logins()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only Executives can see teacher sign-ins.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'teacherId', t.id,
      'autoPassword', public.teacher_default_password(t.id),
      'active', l.user_id is not null and not l.disabled,
      'switchedOff', coalesce(l.disabled, false),
      'defaultPassword', u.id is not null and u.encrypted_password = extensions.crypt(public.teacher_default_password(t.id), u.encrypted_password),
      'changedBy', l.password_changed_by, 'changedAt', l.password_changed_at,
      'currentPassword', l.current_password, 'graceLeft', coalesce(l.grace_left, 0), 'oldId', l.old_teacher_id,
      'lastSignIn', u.last_sign_in_at,
      'googleEmail', p.email, 'googleLastSignIn', gu.last_sign_in_at) order by t.id)
    from public.portal_teachers t
    left join public.teacher_logins l on l.teacher_id = t.id
    left join auth.users u on u.id = l.user_id
    left join public.teacher_profiles p on p.teacher_id = t.id and p.link_status = 'active'
    left join auth.users gu on gu.id = p.user_id
  ), '[]'::jsonb);
end $$;

-- Executives: reset a teacher's password. Empty = back to 1009 + ID number.
-- Also switches the sign-in back on if it was off.
create or replace function public.admin_set_teacher_password(p_teacher_id text, p_password text default null)
returns text language plpgsql security definer set search_path = public as $$
declare pw text := nullif(trim(coalesce(p_password, '')), '');
begin
  if not public.is_admin() then raise exception 'Only Executives can change teacher passwords.'; end if;
  if pw is not null and char_length(pw) not between 4 and 64 then
    raise exception 'The password must be 4 to 64 characters.';
  end if;
  -- switched off? switch it back on first (keeps the old password for the grace)
  if exists (select 1 from public.teacher_logins where teacher_id = p_teacher_id and disabled) then
    perform public.ensure_teacher_login(p_teacher_id, null, lower(coalesce(auth.jwt() ->> 'email', 'executive')), true);
  end if;
  -- v149: the old password opens once more, then the teacher sees the new one
  perform public.rotate_teacher_password(p_teacher_id, coalesce(pw, public.teacher_default_password(p_teacher_id)), null,
    lower(coalesce(auth.jwt() ->> 'email', 'executive')));
  return coalesce(pw, public.teacher_default_password(p_teacher_id));
end $$;

-- Executives: switch a teacher's ID sign-in off (e.g. they left)
create or replace function public.admin_disable_teacher_login(p_teacher_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only Executives can change teacher sign-ins.'; end if;
  perform public.disable_teacher_login(p_teacher_id);
  return true;
end $$;

-- Executives: remove a Google sign-up account (e.g. a test, or a wrong Gmail).
-- The Gmail is unlinked and its account deleted. If the sign-up created a new
-- teacher that has no students, payments or reports yet, that entry is
-- removed from the Teachers List too. Real teachers' records are never
-- deleted here - only unlinked.
create or replace function public.admin_remove_teacher_account(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pr public.teacher_profiles; t public.portal_teachers; removed text; empty boolean;
begin
  if not public.is_admin() then raise exception 'Only Executives can remove teacher accounts.'; end if;
  select * into pr from public.teacher_profiles where user_id = p_user;
  if not found then raise exception 'That account was not found.'; end if;
  if exists (select 1 from auth.users u join public.executive_emails x on public.gmail_key(x.email) = public.gmail_key(u.email) where u.id = p_user) then
    raise exception 'That is an Executive account.';
  end if;
  delete from public.teacher_profiles where user_id = p_user;
  if pr.teacher_id is not null then
    select * into t from public.portal_teachers where id = pr.teacher_id;
    empty := found and coalesce((t.data ->> 'selfRegistered')::boolean, false)
      and not exists (select 1 from public.portal_students s where s.teacher_id = t.id)
      and not exists (select 1 from public.portal_payments pp where pp.teacher_id = t.id)
      and not exists (select 1 from public.monthly_reports m where m.teacher_id = t.id);
    if empty then
      delete from public.portal_teachers where id = t.id;
      removed := t.id;
    end if;
  end if;
  -- The Google account itself (and anything only it sent) goes too
  delete from auth.users where id = p_user and lower(coalesce(email, '')) not like '%@institute.local';
  return jsonb_build_object('removedTeacherId', removed, 'unlinkedTeacherId', pr.teacher_id, 'email', pr.email);
end $$;

-- A teacher sees all their requests, whichever way they signed in
drop policy if exists "Teachers read their inquiries" on public.teacher_inquiries;
create policy "Teachers read their inquiries" on public.teacher_inquiries
  for select to authenticated using (user_id = auth.uid() or (teacher_id is not null and teacher_id = (select public.my_teacher_id())));

-- 7i. Junior Admins inside the Management Portal ------------------------------
-- Juniors can open: Students (without the teacher's share), Enroll Teacher,
-- Enroll Student, Progress Reports and Teacher Reports. They never see
-- salaries, payments, bank details or teacher shares.
drop policy if exists "Junior Admins read progress reports" on public.portal_reports;
create policy "Junior Admins read progress reports" on public.portal_reports
  for select to authenticated using ((select public.is_junior()));
drop policy if exists "Junior Admins add progress reports" on public.portal_reports;
create policy "Junior Admins add progress reports" on public.portal_reports
  for insert to authenticated with check ((select public.is_junior()));

-- Everything a Junior Admin's portal shows, with the money taken out
create or replace function public.staff_portal_data()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  return jsonb_build_object(
    'teachers', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.data ->> 'name', 'category', coalesce(t.data ->> 'category', ''),
        'department', coalesce(t.data ->> 'department', ''), 'whatsapp', coalesce(t.data ->> 'whatsapp', ''),
        'email', coalesce(t.data ->> 'email', ''), 'status', coalesce(t.data ->> 'status', 'Active'),
        'salaryType', 'Per-Student', 'packageAmount', 0, 'account', '', 'bankName', '', 'branchName', '', 'method', '') order by t.id)
      from public.portal_teachers t), '[]'::jsonb),
    'students', coalesce((select jsonb_agg((s.data - 'cut') || jsonb_build_object('id', s.id, 'cut', 0) order by s.id)
      from public.portal_students s), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(r.data || jsonb_build_object('id', r.id) order by r.created_at desc)
      from public.portal_reports r), '[]'::jsonb),
    'payments', '[]'::jsonb);
end $$;

-- Next number for an ID prefix (QIT-### / QIT-S###)
create or replace function public.next_portal_number(p_table text, p_prefix text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  execute format('select coalesce(max((substring(id from %L))::int), 0) from public.%I where id ~ %L',
    '^' || p_prefix || '(\d+)$', p_table, '^' || p_prefix || '\d+$') into n;
  return n + 1;
end $$;
revoke all on function public.next_portal_number(text, text) from public, anon, authenticated;

-- Enroll teachers (Juniors and Executives): IDs are given here
create or replace function public.staff_add_teachers(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; tid text; out jsonb := '[]'::jsonb; n int;
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    -- The ID comes from the category: QIT-R… / QIT-M… / QIT-F…
    tid := public.next_category_teacher_id(r ->> 'category');
    insert into public.portal_teachers (id, data)
      values (tid, (r - 'id' - 'selfRegistered') || jsonb_build_object('id', tid,
        'category', public.teacher_cat_name(public.teacher_cat_letter(r ->> 'category'))));
    out := out || jsonb_build_object('id', tid, 'name', r ->> 'name', 'category', coalesce(r ->> 'category', ''),
      'password', public.teacher_default_password(tid),
      'department', coalesce(r ->> 'department', ''), 'whatsapp', coalesce(r ->> 'whatsapp', ''), 'email', coalesce(r ->> 'email', ''));
  end loop;
  return out;
end $$;

-- Enroll students (Juniors cannot set the teacher's share)
create or replace function public.staff_add_students(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; sid text; out jsonb := '[]'::jsonb; n int; junior boolean := not public.is_admin();
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  perform pg_advisory_xact_lock(hashtext('qit_student_id'));
  n := public.next_portal_number('portal_students', 'QIT-S');
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    sid := 'QIT-S' || lpad(n::text, 3, '0'); n := n + 1;
    if junior then r := r || jsonb_build_object('cut', 0); end if;
    -- v151: same number + same name = the same child (allowed only as a second class)
    if nullif(r ->> 'sameStudentOf', '') is null and public.same_student_of(r ->> 'name', r ->> 'phone') is not null then
      raise exception 'same_student: % (%) already has this WhatsApp number and name. Brothers and sisters need different names. For the same student in a second class, choose "Same student, 2 different classes".',
        r ->> 'name', public.same_student_of(r ->> 'name', r ->> 'phone');
    end if;
    insert into public.portal_students (id, data) values (sid, (r - 'id') || jsonb_build_object('id', sid));
    out := out || ((r - 'cut') || jsonb_build_object('id', sid, 'cut', 0));
  end loop;
  return out;
end $$;

-- Edit a student (a Junior's edit never changes the teacher's share)
create or replace function public.staff_update_student(p_id text, p_patch jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  update public.portal_students
    set data = data || (case when public.is_admin() then p_patch else p_patch - 'cut' end) - 'id' || jsonb_build_object('id', p_id),
        updated_at = now()
    where id = p_id;
  if not found then raise exception 'Student not found.'; end if;
  return true;
end $$;

-- 7j. One place to edit ---------------------------------------------------------
-- A student's or teacher's name is stored once (portal_students /
-- portal_teachers). Copies kept elsewhere follow automatically.
create or replace function public.sync_student_name()
returns trigger language plpgsql security definer set search_path = public as $$
declare nm text := nullif(btrim(new.data ->> 'name'), '');
begin
  if nm is not null and nm is distinct from (old.data ->> 'name') then
    update public.monthly_reports set student_name = nm where student_id = new.id and student_name is distinct from nm;
  end if;
  return new;
end $$;
drop trigger if exists portal_students_name_sync on public.portal_students;
create trigger portal_students_name_sync after update on public.portal_students
  for each row execute function public.sync_student_name();

create or replace function public.sync_teacher_name()
returns trigger language plpgsql security definer set search_path = public as $$
declare nm text := nullif(btrim(new.data ->> 'name'), '');
begin
  if nm is not null and nm is distinct from (old.data ->> 'name') then
    update public.monthly_reports set teacher_name = nm where teacher_id = new.id and teacher_name is distinct from nm;
    update public.teacher_inquiries set teacher_name = nm where teacher_id = new.id and teacher_name is distinct from nm;
    if char_length(nm) between 2 and 120 then
      update public.teacher_profiles set full_name = nm
        where teacher_id = new.id and link_status = 'active' and full_name is distinct from nm;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists portal_teachers_name_sync on public.portal_teachers;
create trigger portal_teachers_name_sync after update on public.portal_teachers
  for each row execute function public.sync_teacher_name();

-- A teacher (or an Executive) changing the name on the teacher's account
-- changes it in the Teachers List / Salary Directory too
create or replace function public.sync_profile_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.teacher_id is not null and new.link_status = 'active' and new.full_name is distinct from old.full_name then
    update public.portal_teachers set data = data || jsonb_build_object('name', new.full_name), updated_at = now()
      where id = new.teacher_id and (data ->> 'name') is distinct from new.full_name;
  end if;
  return new;
end $$;
drop trigger if exists teacher_profiles_name_sync on public.teacher_profiles;
create trigger teacher_profiles_name_sync after update of full_name on public.teacher_profiles
  for each row execute function public.sync_profile_name();
do $$ declare f text; begin
  foreach f in array array['sync_student_name()', 'sync_teacher_name()', 'sync_profile_name()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- Bring existing copies in line once (the Teachers List / student list wins)
update public.monthly_reports r set student_name = s.data ->> 'name'
  from public.portal_students s
  where s.id = r.student_id and nullif(btrim(s.data ->> 'name'), '') is not null and r.student_name is distinct from s.data ->> 'name';
update public.monthly_reports r set teacher_name = t.data ->> 'name'
  from public.portal_teachers t
  where t.id = r.teacher_id and nullif(btrim(t.data ->> 'name'), '') is not null and r.teacher_name is distinct from t.data ->> 'name';
update public.teacher_inquiries q set teacher_name = t.data ->> 'name'
  from public.portal_teachers t
  where t.id = q.teacher_id and nullif(btrim(t.data ->> 'name'), '') is not null and q.teacher_name is distinct from t.data ->> 'name';
update public.teacher_profiles p set full_name = t.data ->> 'name'
  from public.portal_teachers t
  where t.id = p.teacher_id and p.link_status = 'active' and char_length(btrim(t.data ->> 'name')) between 2 and 120
    and p.full_name is distinct from t.data ->> 'name';

-- Teachers add a new student themselves. It goes into the one student list,
-- so it appears in the Management Portal (fee and share start at 0 for the
-- office to fill in) and everywhere on the Teacher Dashboard.
create or replace function public.teacher_add_student(p_row jsonb, p_teacher_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid text := public.resolve_teacher(p_teacher_id);
  nm text := regexp_replace(btrim(coalesce(p_row ->> 'name', '')), '\s+', ' ', 'g');
  sched text := case when p_row ->> 'scheduleType' = 'flexible' then 'flexible' else 'fixed' end;
  sid text; n int;
begin
  if char_length(nm) < 2 or char_length(nm) > 120 then raise exception 'student_name_invalid'; end if;
  -- v151: same number + same name = the same child: only as "Same student, 2 different classes"
  if coalesce(p_row ->> 'sameStudent', '') <> 'true' and public.same_student_of(nm, p_row ->> 'phone') is not null then
    raise exception 'same_student';
  end if;
  if char_length(coalesce(p_row ->> 'phone', '')) > 300 or char_length(coalesce(p_row ->> 'course', '')) > 120
     or char_length(coalesce(p_row ->> 'classTime', '')) > 120 then raise exception 'student_phone_invalid'; end if;
  -- a sensible cap against mistakes (e.g. pressing Add many times)
  if (select count(*) from public.portal_students s where s.teacher_id = tid and s.data ->> 'addedByTeacher' = 'true'
        and s.created_at > now() - interval '1 day') >= 15 then
    raise exception 'student_add_limit';
  end if;
  perform pg_advisory_xact_lock(hashtext('qit_student_id'));
  n := public.next_portal_number('portal_students', 'QIT-S');
  sid := 'QIT-S' || lpad(n::text, 3, '0');
  insert into public.portal_students (id, data) values (sid, jsonb_build_object(
    'id', sid, 'name', nm, 'phone', coalesce(nullif(btrim(p_row ->> 'phone'), ''), 'N/A'), 'teacherId', tid,
    'course', coalesce(nullif(btrim(p_row ->> 'course'), ''), 'Quran & Tajweed'), 'status', 'Active',
    'classTime', case when sched = 'flexible' then '' else coalesce(btrim(p_row ->> 'classTime'), '') end,
    'scheduleType', sched, 'fee', 0, 'cut', 0, 'addedByTeacher', true, 'addedAt', now())
    -- v149: Bangla / English Medium and the first class date (optional)
    || case when p_row ->> 'medium' in ('Bangla Medium', 'English Medium') then jsonb_build_object('medium', p_row ->> 'medium') else '{}'::jsonb end
    || case when (p_row ->> 'assignDate') ~ '^\d{4}-\d{2}-\d{2}$' then jsonb_build_object('assignDate', p_row ->> 'assignDate') else '{}'::jsonb end
    -- v151: the same child's other class
    || case when coalesce(p_row ->> 'sameStudent', '') = 'true' and public.same_student_of(nm, p_row ->> 'phone') is not null
         then jsonb_build_object('sameStudentOf', public.same_student_of(nm, p_row ->> 'phone')) else '{}'::jsonb end);
  -- v149: a brother / sister (same WhatsApp number) gets the ID right after
  if exists (select 1 from public.portal_students o where o.id <> sid
             and public.student_phone_keys(o.data ->> 'phone') && array(select x from unnest(public.student_phone_keys(p_row ->> 'phone')) x where char_length(x) >= 7)) then
    sid := coalesce((select r ->> 'newId' from jsonb_array_elements(public.renumber_students_core()) r where r ->> 'oldId' = sid), sid);
  end if;
  return jsonb_build_object('id', sid, 'name', nm);
end $$;
revoke all on function public.teacher_add_student(jsonb, text) from public, anon;
grant execute on function public.teacher_add_student(jsonb, text) to authenticated;

-- Sign-in page: is a remembered Teacher ID still active? ('active' | 'off' | 'missing')
create or replace function public.teacher_login_state(p_teacher_id text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from public.portal_teachers t where t.id = upper(btrim(p_teacher_id))) then 'missing'
    when exists (select 1 from public.teacher_logins l where l.teacher_id = upper(btrim(p_teacher_id)) and not l.disabled) then 'active'
    else 'off' end;
$$;
revoke all on function public.teacher_login_state(text) from public;
grant execute on function public.teacher_login_state(text) to anon, authenticated;

-- 7k. Dashboard Editor (Executives) -----------------------------------------
-- One settings row for the Teacher Dashboard:
--   config.text     = { "en": { "home.hello": "…" }, "bn": { … } }  text overrides
--   config.required = { "report.remarks": true, "att.lesson": false, … }
-- Everyone may read it (the sign-in page uses the texts too); only Executives
-- may change it. Required fields are checked here in the database as well,
-- so a form can't be sent with a required entry left empty.
create table if not exists public.dashboard_config (
  id int primary key default 1 check (id = 1),
  config jsonb not null default '{"text": {"en": {}, "bn": {}}, "required": {}}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.dashboard_config enable row level security;
insert into public.dashboard_config (id) values (1) on conflict (id) do nothing;
grant select on public.dashboard_config to anon, authenticated;
grant insert, update on public.dashboard_config to authenticated;
drop policy if exists "Anyone reads dashboard settings" on public.dashboard_config;
create policy "Anyone reads dashboard settings" on public.dashboard_config
  for select to anon, authenticated using (true);
drop policy if exists "Executives edit dashboard settings" on public.dashboard_config;
create policy "Executives edit dashboard settings" on public.dashboard_config
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Is this entry required? (the Executives' choice, else the built-in default)
create or replace function public.field_required(p_key text, p_default boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when jsonb_typeof(config -> 'required' -> p_key) = 'boolean'
                               then (config -> 'required' ->> p_key)::boolean end
                   from public.dashboard_config where id = 1), p_default);
$$;
grant execute on function public.field_required(text, boolean) to anon, authenticated;

-- Remarks and the support subject can now be made optional
alter table public.monthly_reports alter column remarks drop not null;
alter table public.monthly_reports drop constraint if exists monthly_reports_remarks_check;
alter table public.monthly_reports add constraint monthly_reports_remarks_check
  check (remarks is null or char_length(remarks) <= 2000);
alter table public.teacher_inquiries drop constraint if exists teacher_inquiries_subject_check;
alter table public.teacher_inquiries add constraint teacher_inquiries_subject_check
  check (char_length(subject) <= 150);

-- Monthly report: every field the Executives marked as required must be filled
create or replace function public.monthly_reports_required_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  e text := '';
  blank text := '^\s*$';
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then return new; end if;
  new.remarks := nullif(btrim(coalesce(new.remarks, '')), '');
  if public.field_required('report.total', true) and new.total_classes is null then e := e || ' total'; end if;
  if public.field_required('report.present', true) and new.present is null then e := e || ' present'; end if;
  if public.field_required('report.reason', false) and coalesce(new.absent, 0) > 0 and coalesce(new.absence_reason, '') ~ blank then e := e || ' reason'; end if;
  if public.field_required('report.level', true) and new.status_level is null then e := e || ' level'; end if;
  if public.field_required('report.notes', false) and coalesce(new.status_note, '') ~ blank then e := e || ' notes'; end if;
  if public.field_required('report.taught', false) and coalesce(new.taught, '') ~ blank then e := e || ' taught'; end if;
  if public.field_required('report.lesson', false) and coalesce(new.current_lesson, '') ~ blank then e := e || ' lesson'; end if;
  if public.field_required('report.target', false) and coalesce(new.next_target, '') ~ blank then e := e || ' target'; end if;
  if public.field_required('report.remarks', true) and new.remarks is null then e := e || ' remarks'; end if;
  if e <> '' then raise exception 'required_fields_missing' using detail = btrim(e); end if;
  return new;
end $$;
drop trigger if exists monthly_reports_required_guard on public.monthly_reports;
create trigger monthly_reports_required_guard before insert or update on public.monthly_reports
  for each row execute function public.monthly_reports_required_guard();

-- 7l. Security ------------------------------------------------------------------
-- Who can sign in, and how:
--   Executives   ONLY the Gmails in executive_emails, signed in with Google,
--                AND the Executive password on each device (several devices
--                allowed). A password alone, or another Gmail, never opens it.
--   Junior Admin ONLY the Gmails in staff_roles, signed in with Google.
--   Teachers     1st time: Google (their Gmail is linked to their Teacher ID).
--                After that: the SAME Gmail through Google + Teacher ID +
--                password. Another Gmail with the right ID and password is
--                refused and written to the security log.
--                One device at a time: opening the dashboard on a new device
--                signs the old one out. Executives and Junior Admins may use
--                several devices.
--   5 wrong passwords from one Google account (or 10 on one Teacher ID) in
--   15 minutes pause sign-in for 15 minutes.
-- Executives manage all of it in Management Portal -> Security.

-- "qit 77", "77", "QIT-077" -> QIT-077
create or replace function public.norm_teacher_id(p text)
returns text language sql immutable as $$
  select case
    when upper(regexp_replace(translate(coalesce(p, ''), '০১২৩৪৫৬৭৮৯', '0123456789'), '\s+', '', 'g')) ~ '^(QIT)?-?\d{1,6}$'
      then 'QIT-' || lpad(substring(translate(p, '০১২৩৪৫৬৭৮৯', '0123456789') from '(\d+)\s*$'), 3, '0')
    else upper(btrim(coalesce(p, '')))
  end;
$$;

-- What a Gmail is already used for (so one Gmail has one role)
create or replace function public.gmail_in_use(e text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select 'executive' from public.executive_emails where public.gmail_key(email) = public.gmail_key(e) limit 1),
    (select 'junior' from public.staff_roles where public.gmail_key(email) = public.gmail_key(e) limit 1),
    (select 'teacher ' || teacher_id from public.teacher_profiles where public.gmail_key(email) = public.gmail_key(e) and teacher_id is not null limit 1),
    (select 'teacher ' || id from public.portal_teachers where public.gmail_key(email) = public.gmail_key(e) limit 1));
$$;

-- Signs out every device of a Gmail (used when access is removed)
create or replace function public.end_sessions_of(e text)
returns void language sql security definer set search_path = public as $$
  delete from auth.sessions where user_id in (select id from auth.users where public.gmail_key(email) = public.gmail_key(e));
$$;

-- Executive: the password step after Google. Returns { ok } or
-- { ok: false, error: wrong | too_many | not_executive, left, minutes }.
create or replace function public.admin_unlock(p_password text, p_device text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare sid uuid := public.current_session_id(); h text; fails int; last_fail timestamptz;
begin
  if not public.is_executive_gmail() then
    if auth.uid() is not null then perform public.log_security('admin_blocked', null, 'Not an Executive Gmail', p_device); end if;
    return jsonb_build_object('ok', false, 'error', 'not_executive');
  end if;
  if sid is null then return jsonb_build_object('ok', false, 'error', 'session'); end if;
  select count(*), max(at) into fails, last_fail from public.security_events
    where kind = 'bad_admin_password' and at > now() - interval '15 minutes' and user_id = auth.uid();
  if fails >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many',
      'minutes', greatest(1, ceil(extract(epoch from (last_fail + interval '15 minutes' - now())) / 60)));
  end if;
  select hash into h from public.executive_secret where id = 1;
  if h is null or h <> extensions.crypt(coalesce(p_password, ''), h) then
    perform public.log_security('bad_admin_password', null, 'Wrong Executive password', p_device);
    return jsonb_build_object('ok', false, 'error', 'wrong', 'left', greatest(0, 4 - fails));
  end if;
  -- forget devices that have signed out
  delete from public.executive_sessions es where not exists (select 1 from auth.sessions ss where ss.id = es.session_id);
  insert into public.executive_sessions (session_id, email, device) values (sid, public.google_email(), left(p_device, 160))
  on conflict (session_id) do update set email = excluded.email, device = excluded.device, created_at = now();
  perform public.log_security('admin_signed_in', null, 'Executive', p_device);
  return jsonb_build_object('ok', true);
end $$;

-- Executive "Sign out": this device needs the Executive password again (the
-- Google sign-in stays, so next time only the password is asked)
create or replace function public.admin_sign_out()
returns void language sql security definer set search_path = public as $$
  delete from public.executive_sessions where session_id = public.current_session_id();
$$;

-- Executives: change the Executive password (needs the current one)
create or replace function public.admin_set_executive_password(p_current text, p_new text)
returns void language plpgsql security definer set search_path = public as $$
declare h text;
begin
  if not public.is_admin() then raise exception 'Only Executives can change the Executive password.'; end if;
  select hash into h from public.executive_secret where id = 1;
  if h <> extensions.crypt(coalesce(p_current, ''), h) then raise exception 'The current Executive password is not correct.'; end if;
  if char_length(coalesce(p_new, '')) not between 6 and 64 then raise exception 'The new password must be 6 to 64 characters.'; end if;
  update public.executive_secret set hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)), changed_by = public.google_email(), changed_at = now() where id = 1;
  perform public.log_security('admin_password_changed', null, null);
end $$;

-- Teacher: open the dashboard on this device with Teacher ID + password.
-- Returns { ok: true } or { ok: false, error: <code>, ... }; nothing is
-- raised, so failed attempts stay in the security log.
-- v150: all earlier Teacher IDs of a teacher
create or replace function public.teacher_old_ids(p_tid text)
returns setof text language sql stable security definer set search_path = public as $$
  select distinct x from (
    select old_teacher_id as x from public.teacher_logins where teacher_id = p_tid
    union all select old_id from public.teacher_old_logins where teacher_id = p_tid
    union all select btrim(split_part(detail, ' -> ', 1)) from public.security_events
      where kind = 'teacher_id_changed' and teacher_id = p_tid and detail like '% -> %'
  ) o where x is not null and x <> '' and x <> p_tid;
$$;
revoke all on function public.teacher_old_ids(text) from public, anon, authenticated;

-- v150: does this password open this teacher's dashboard?
--   'current' = the password now; 'old' = an earlier one (accepted until the
--   teacher has closed the "new ID / password" notice); null = no
create or replace function public.teacher_password_check(p_tid text, p_pw text)
returns text language plpgsql stable security definer set search_path = public as $$
declare l public.teacher_logins; u auth.users; pw text := coalesce(p_pw, '');
begin
  select * into l from public.teacher_logins where teacher_id = p_tid;
  if l.teacher_id is null or pw = '' then return null; end if;
  select * into u from auth.users where id = l.user_id;
  if u.encrypted_password is not null and u.encrypted_password = extensions.crypt(pw, u.encrypted_password) then return 'current'; end if;
  if l.login_notice is null and coalesce(l.grace_left, 0) <= 0 then return null; end if;
  if l.old_password_hash is not null and l.old_password_hash = extensions.crypt(pw, l.old_password_hash) then return 'old'; end if;
  if l.initial_password is not null and l.initial_password = pw then return 'old'; end if;
  if exists (select 1 from public.teacher_old_logins o where o.teacher_id = p_tid and o.pw_hash is not null
             and o.created_at > now() - interval '180 days' and o.pw_hash = extensions.crypt(pw, o.pw_hash)) then return 'old'; end if;
  if exists (select 1 from public.teacher_old_ids(p_tid) x where public.teacher_default_password(x) = pw) then return 'old'; end if;
  return null;
end $$;
revoke all on function public.teacher_password_check(text, text) from public, anon, authenticated;

create or replace function public.teacher_unlock(p_teacher_id text, p_password text, p_device text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  g text := public.google_email();
  sid uuid := public.current_session_id();
  tid text := public.norm_teacher_id(p_teacher_id);
  pr public.teacher_profiles;
  l public.teacher_logins;
  u auth.users;
  t public.portal_teachers;
  fails_me int; fails_id int; last_fail timestamptz;
  used_old boolean := false; how text; typed text; cand text;
begin
  if auth.uid() is null or g = '' or not public.is_gmail(g) then return jsonb_build_object('ok', false, 'error', 'google_required'); end if;
  if sid is null then return jsonb_build_object('ok', false, 'error', 'session'); end if;
  if public.is_staff() or public.is_executive_gmail() then return jsonb_build_object('ok', false, 'error', 'admin_account'); end if;
  select * into pr from public.teacher_profiles where user_id = auth.uid();

  -- The very first sign-in after the office linked this Gmail: Google is enough
  if pr.user_id is not null and pr.link_status = 'active' and pr.first_unlock_at is null
     and (tid = '' or tid = pr.teacher_id) then
    if exists (select 1 from public.teacher_logins where teacher_id = pr.teacher_id and not disabled) then
      return public.activate_teacher_session(pr.teacher_id, p_device);
    end if;
  end if;
  if tid = '' then return jsonb_build_object('ok', false, 'error', 'id_required'); end if;

  -- Too many wrong passwords?
  select count(*), max(at) into fails_me, last_fail from public.security_events
    where kind = 'bad_password' and at > now() - interval '15 minutes' and user_id = auth.uid();
  select count(*) into fails_id from public.security_events
    where kind = 'bad_password' and at > now() - interval '15 minutes' and teacher_id = tid;
  if fails_me >= 5 or fails_id >= 10 then
    select max(at) into last_fail from public.security_events
      where kind = 'bad_password' and at > now() - interval '15 minutes' and (user_id = auth.uid() or teacher_id = tid);
    return jsonb_build_object('ok', false, 'error', 'too_many',
      'minutes', greatest(1, ceil(extract(epoch from (last_fail + interval '15 minutes' - now())) / 60)));
  end if;

  -- v150: who is signing in? With a linked Gmail we know the teacher: their
  -- current or any earlier Teacher ID works, with the current or an earlier
  -- password (earlier ones until they close the "new ID / password" notice).
  typed := tid;
  if pr.user_id is not null and pr.link_status = 'active' and pr.teacher_id is not null
     and (tid = pr.teacher_id or exists (select 1 from public.teacher_old_ids(pr.teacher_id) x where x = tid)) then
    how := public.teacher_password_check(pr.teacher_id, p_password);
    if how is not null then tid := pr.teacher_id; end if;
  end if;
  if how is null then
    how := public.teacher_password_check(tid, p_password);
    -- an earlier ID (changed, or a gap closed) of another teacher
    if how is null then
      select t2.id into cand from public.portal_teachers t2
        where t2.id <> tid and exists (select 1 from public.teacher_old_ids(t2.id) x where x = tid)
          and public.teacher_password_check(t2.id, p_password) is not null
        order by t2.id limit 1;
      if cand is not null then tid := cand; how := 'old'; end if;
    end if;
  end if;
  used_old := how = 'old' or typed <> tid;
  select * into l from public.teacher_logins where teacher_id = tid;
  select * into t from public.portal_teachers where id = tid;
  if l.teacher_id is null or t.id is null or how is null then
    perform public.log_security('bad_password', typed, case when l.teacher_id is null then 'Unknown Teacher ID' else 'Wrong password' end, p_device);
    return jsonb_build_object('ok', false, 'error', 'wrong', 'left', greatest(0, 4 - fails_me));
  end if;
  if l.disabled then return jsonb_build_object('ok', false, 'error', 'id_off'); end if;
  -- an earlier ID or password was used: the dashboard shows the new ones
  if used_old then
    update public.teacher_logins set login_notice = coalesce(login_notice, jsonb_build_object(
        'kind', case when typed <> tid then 'id' else 'password' end, 'teacherId', tid,
        'oldId', case when typed <> tid then typed end,
        'password', coalesce(current_password, public.teacher_default_password(tid)), 'at', now()))
      where teacher_id = tid;
    perform public.log_security('old_login_used', tid, 'Signed in with ' || case when typed <> tid then 'the earlier ID ' || typed else 'an earlier password' end, p_device);
  end if;

  -- Right ID and password: now the Gmail must be the one linked to this ID
  if pr.user_id is not null and pr.link_status = 'active' then
    if pr.teacher_id is distinct from tid then
      perform public.log_security('wrong_gmail', tid, 'Right password, but this Gmail belongs to ' || coalesce(pr.teacher_id, '?'), p_device);
      return jsonb_build_object('ok', false, 'error', 'not_your_id');
    end if;
    return public.activate_teacher_session(tid, p_device);
  end if;

  -- This Gmail is not linked yet: it may link to the ID only if the ID has no
  -- Gmail yet (the teacher's first Google sign-in)
  if exists (select 1 from public.teacher_profiles x where x.teacher_id = tid and x.link_status = 'active')
     or (t.email is not null and public.gmail_key(t.email) <> public.gmail_key(g)) then
    perform public.log_security('wrong_gmail', tid, 'Blocked: this Teacher ID is locked to another Gmail', p_device);
    return jsonb_build_object('ok', false, 'error', 'gmail_mismatch');
  end if;
  delete from public.teacher_profiles where user_id = auth.uid();  -- a pending request, if any
  insert into public.teacher_profiles (user_id, teacher_id, full_name, whatsapp, email, linked_by, first_unlock_at)
  values (auth.uid(), tid,
    coalesce(nullif(regexp_replace(btrim(coalesce(t.data ->> 'name', '')), '\s+', ' ', 'g'), ''), pr.full_name, tid),
    case when char_length(public.phone_key(t.data ->> 'whatsapp')) >= 7 then t.data ->> 'whatsapp'
         when char_length(public.phone_key(pr.whatsapp)) >= 7 then pr.whatsapp else '' end,
    g, 'id', now());
  perform set_config('qit.keep_password', 'on', true);
  update public.portal_teachers set data = data || jsonb_build_object('email', g), updated_at = now() where id = tid;
  perform public.log_security('gmail_linked', tid, 'Gmail linked with Teacher ID + password (first Google sign-in)', p_device);
  return public.activate_teacher_session(tid, p_device);
end $$;

-- A teacher the office just approved: their Teacher ID and password, shown on
-- the sign-in screen BEFORE the dashboard opens the first time (also when
-- they come back later). Nothing is returned once the first sign-in is done.
create or replace function public.my_first_login()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pr public.teacher_profiles; pw text;
begin
  select * into pr from public.teacher_profiles where user_id = auth.uid();
  if pr.user_id is null or pr.link_status <> 'active' or pr.first_unlock_at is not null
     or public.gmail_key(pr.email) <> public.gmail_key(public.google_email()) then return null; end if;
  pw := public.teacher_default_password(pr.teacher_id);
  return jsonb_build_object('teacherId', pr.teacher_id, 'fullName', pr.full_name,
    'password', (select case when u.encrypted_password = extensions.crypt(coalesce(pw, ''), u.encrypted_password) then pw end
                 from public.teacher_logins l join auth.users u on u.id = l.user_id where l.teacher_id = pr.teacher_id and not l.disabled));
end $$;
revoke all on function public.my_first_login() from public, anon;
grant execute on function public.my_first_login() to authenticated;

-- Teacher: "still here" every minute; false when another device took over
create or replace function public.teacher_touch()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare tid text := public.my_teacher_id();
begin
  if tid is null then return jsonb_build_object('active', false); end if;
  update public.teacher_logins set last_seen = now() where teacher_id = tid;
  return jsonb_build_object('active', true);
end $$;

-- Teacher: sign out of this device
create or replace function public.teacher_sign_out()
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  -- only this device; the teacher's other devices stay open
  delete from public.teacher_sessions where session_id = public.current_session_id();
end $$;

-- Executives: everything on the Security page
create or replace function public.admin_security_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me text := public.gmail_key(public.google_email());
begin
  if not public.is_admin() then raise exception 'Only Executives can open Security.'; end if;
  return jsonb_build_object(
    'me', public.google_email(),
    'passwordChangedAt', (select changed_at from public.executive_secret where id = 1),
    'passwordChangedBy', (select changed_by from public.executive_secret where id = 1),
    'executives', coalesce((select jsonb_agg(jsonb_build_object('email', x.email, 'addedBy', x.added_by, 'createdAt', x.created_at,
        'you', public.gmail_key(x.email) = me,
        'lastSignIn', (select max(u.last_sign_in_at) from auth.users u where public.gmail_key(u.email) = public.gmail_key(x.email)))
        order by x.created_at) from public.executive_emails x), '[]'::jsonb),
    'juniors', coalesce((select jsonb_agg(jsonb_build_object('email', j.email, 'addedBy', j.added_by, 'createdAt', j.created_at,
        'lastSignIn', (select max(u.last_sign_in_at) from auth.users u where public.gmail_key(u.email) = public.gmail_key(j.email)))
        order by j.created_at) from public.staff_roles j), '[]'::jsonb),
    'teachers', coalesce((select jsonb_agg(jsonb_build_object(
        'teacherId', t.id, 'name', t.data ->> 'name',
        'gmail', coalesce(p.email, t.email),
        'linked', p.user_id is not null,
        'firstSignInDone', p.first_unlock_at is not null,
        'off', coalesce(l.disabled, true),
        'online', exists (select 1 from public.teacher_sessions ts join auth.sessions ss on ss.id = ts.session_id where ts.user_id = p.user_id),
        'devices', (select count(*) from public.teacher_sessions ts join auth.sessions ss on ss.id = ts.session_id where ts.user_id = p.user_id),
        'device', l.active_device, 'since', l.active_since, 'lastSeen', l.last_seen,
        'failed24h', (select count(*) from public.security_events e where e.teacher_id = t.id and e.kind in ('bad_password', 'wrong_gmail') and e.at > now() - interval '24 hours'),
        'pending', (select count(*) from public.teacher_profiles q where q.claim_teacher_id = t.id and q.link_status = 'pending'))
        order by t.id)
      from public.portal_teachers t
      left join public.teacher_logins l on l.teacher_id = t.id
      left join public.teacher_profiles p on p.teacher_id = t.id and p.link_status = 'active'), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.at desc) from
        (select id, at, kind, email, teacher_id, device, detail from public.security_events order by at desc limit 200) e), '[]'::jsonb));
end $$;

-- Executives: add / change / remove an Executive (yourself too). The last
-- Executive can't be removed, so the institute is never locked out.
create or replace function public.admin_add_executive(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare e text := lower(btrim(coalesce(p_email, ''))); used text;
begin
  if not public.is_admin() then raise exception 'Only Executives can add Executives.'; end if;
  if not public.is_gmail(e) then raise exception 'Enter a Gmail address (…@gmail.com).'; end if;
  used := public.gmail_in_use(e);
  if used = 'executive' then raise exception '% is already an Executive.', e; end if;
  if used is not null then raise exception '% is already used by a % account. Remove it there first.', e, used; end if;
  insert into public.executive_emails (email, added_by) values (e, public.google_email());
  perform public.log_security('executive_added', null, e);
end $$;

create or replace function public.admin_remove_executive(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare e text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.is_admin() then raise exception 'Only Executives can remove Executives.'; end if;
  if not exists (select 1 from public.executive_emails where public.gmail_key(email) = public.gmail_key(e)) then
    raise exception '% is not an Executive.', e;
  end if;
  if (select count(*) from public.executive_emails) <= 1 then
    raise exception 'This is the last Executive. Add another Executive first.';
  end if;
  perform public.log_security('executive_removed', null, e);
  delete from public.executive_emails where public.gmail_key(email) = public.gmail_key(e);
  delete from public.executive_sessions where public.gmail_key(email) = public.gmail_key(e);
  perform public.end_sessions_of(e);
end $$;

create or replace function public.admin_change_executive(p_old text, p_new text)
returns void language plpgsql security definer set search_path = public as $$
declare o text := lower(btrim(coalesce(p_old, ''))); n text := lower(btrim(coalesce(p_new, ''))); used text;
begin
  if not public.is_admin() then raise exception 'Only Executives can change Executives.'; end if;
  if not public.is_gmail(n) then raise exception 'Enter a Gmail address (…@gmail.com).'; end if;
  if public.gmail_key(o) = public.gmail_key(n) then
    update public.executive_emails set email = n where public.gmail_key(email) = public.gmail_key(o);
    return;
  end if;
  used := public.gmail_in_use(n);
  if used is not null then raise exception '% is already used by a % account.', n, used; end if;
  update public.executive_emails set email = n, added_by = public.google_email(), created_at = now() where public.gmail_key(email) = public.gmail_key(o);
  if not found then raise exception '% is not an Executive.', o; end if;
  perform public.log_security('executive_changed', null, o || ' -> ' || n);
  perform public.end_sessions_of(o);
end $$;

-- Executives: Junior Admins (only these Gmails can open the Junior Admin area)
create or replace function public.admin_add_junior(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare e text := lower(btrim(coalesce(p_email, ''))); used text;
begin
  if not public.is_admin() then raise exception 'Only Executives can add Junior Admins.'; end if;
  if not public.is_gmail(e) then raise exception 'Enter a Gmail address (…@gmail.com).'; end if;
  used := public.gmail_in_use(e);
  if used = 'junior' then raise exception '% is already a Junior Admin.', e; end if;
  if used is not null then raise exception '% is already used by a % account. Remove it there first.', e, used; end if;
  insert into public.staff_roles (email, role, added_by) values (e, 'junior', public.google_email());
  perform public.log_security('junior_added', null, e);
end $$;

create or replace function public.admin_remove_junior(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare e text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.is_admin() then raise exception 'Only Executives can remove Junior Admins.'; end if;
  delete from public.staff_roles where public.gmail_key(email) = public.gmail_key(e);
  if not found then raise exception '% is not a Junior Admin.', e; end if;
  perform public.log_security('junior_removed', null, e);
  perform public.end_sessions_of(e);
end $$;

create or replace function public.admin_change_junior(p_old text, p_new text)
returns void language plpgsql security definer set search_path = public as $$
declare o text := lower(btrim(coalesce(p_old, ''))); n text := lower(btrim(coalesce(p_new, ''))); used text;
begin
  if not public.is_admin() then raise exception 'Only Executives can change Junior Admins.'; end if;
  if not public.is_gmail(n) then raise exception 'Enter a Gmail address (…@gmail.com).'; end if;
  if public.gmail_key(o) <> public.gmail_key(n) then
    used := public.gmail_in_use(n);
    if used is not null then raise exception '% is already used by a % account.', n, used; end if;
  end if;
  update public.staff_roles set email = n where public.gmail_key(email) = public.gmail_key(o);
  if not found then raise exception '% is not a Junior Admin.', o; end if;
  if public.gmail_key(o) <> public.gmail_key(n) then
    perform public.log_security('junior_changed', null, o || ' -> ' || n);
    perform public.end_sessions_of(o);
  end if;
end $$;

-- Executives: change or remove the Gmail a Teacher ID is locked to.
--   new Gmail -> only that Gmail can sign in (its first Google sign-in opens
--                the dashboard; after that Teacher ID + password too)
--   empty     -> no Gmail: the next Gmail that signs in with the right
--                Teacher ID + password is locked to it
-- The password stays the same; the teacher's device is signed out.
create or replace function public.admin_set_teacher_gmail(p_teacher_id text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tid text := public.norm_teacher_id(p_teacher_id); e text := nullif(lower(btrim(coalesce(p_email, ''))), ''); used text; old text;
begin
  if not public.is_admin() then raise exception 'Only Executives can change a teacher''s Gmail.'; end if;
  if not exists (select 1 from public.portal_teachers where id = tid) then raise exception 'Teacher % not found.', tid; end if;
  if e is not null then
    if not public.is_gmail(e) then raise exception 'Enter a Gmail address (…@gmail.com).'; end if;
    used := public.gmail_in_use(e);
    if used is not null and used <> 'teacher ' || tid then raise exception '% is already used by a % account.', e, used; end if;
  end if;
  select coalesce((select email from public.teacher_profiles where teacher_id = tid and link_status = 'active'),
                  (select email from public.portal_teachers where id = tid)) into old;
  perform set_config('qit.keep_password', 'on', true);
  -- Unlink the old Google account and sign its device out
  delete from auth.sessions where user_id in (select user_id from public.teacher_profiles where teacher_id = tid
    and public.gmail_key(email) is distinct from public.gmail_key(coalesce(e, '')));
  delete from public.teacher_profiles where teacher_id = tid and public.gmail_key(email) is distinct from public.gmail_key(coalesce(e, ''));
  update public.teacher_logins set active_session = null where teacher_id = tid;
  update public.portal_teachers set data = case when e is null then data - 'email' else data || jsonb_build_object('email', e) end,
    updated_at = now() where id = tid;
  perform public.log_security(case when e is null then 'gmail_removed' else 'gmail_changed' end, tid,
    coalesce(old, '(none)') || ' -> ' || coalesce(e, '(none)'));
  return jsonb_build_object('teacherId', tid, 'gmail', e);
end $$;

-- Executives: sign a teacher out of their device now
create or replace function public.admin_sign_out_teacher(p_teacher_id text)
returns void language plpgsql security definer set search_path = public as $$
declare tid text := public.norm_teacher_id(p_teacher_id); s uuid;
begin
  if not public.is_admin() then raise exception 'Only Executives can do this.'; end if;
  -- every device of this teacher is signed out of Google and locked
  delete from auth.sessions where id in (select ts.session_id from public.teacher_sessions ts
    where ts.user_id in (select user_id from public.teacher_profiles where teacher_id = tid));
  delete from public.teacher_sessions where user_id in (select user_id from public.teacher_profiles where teacher_id = tid);
  update public.teacher_logins set active_session = null where teacher_id = tid;
  perform public.log_security('signed_out_by_office', tid, null);
end $$;

-- Old ways in are closed now: Teacher ID + password sessions (no Google)
-- are signed out, and the Junior Admin table accepts the executive list's rules
update auth.users set banned_until = '2999-12-31'
where lower(email) like '%@institute.local' and (banned_until is null or banned_until < '2999-01-01');
delete from auth.sessions where user_id in (select id from auth.users where lower(email) like '%@institute.local');
-- Old security log entries (older than a year) are cleared
delete from public.security_events where at < now() - interval '365 days';

do $$
declare f text;
begin
  foreach f in array array['admin_sign_out()', 'admin_unlock(text, text)', 'admin_set_executive_password(text, text)', 'teacher_unlock(text, text, text)', 'teacher_touch()', 'teacher_sign_out()', 'admin_security_overview()',
    'admin_add_executive(text)', 'admin_remove_executive(text)', 'admin_change_executive(text, text)',
    'admin_add_junior(text)', 'admin_remove_junior(text)', 'admin_change_junior(text, text)',
    'admin_set_teacher_gmail(text, text)', 'admin_sign_out_teacher(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['log_security(text, text, text, text)', 'activate_teacher_session(text, text)',
    'end_sessions_of(text)', 'gmail_in_use(text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- 7m. New Teacher IDs by category, and moving / copying students ---------------
-- Executives: give an existing teacher the new-style ID of a category
-- (QIT-007 -> QIT-R004). Everything moves with them: students, salary and
-- payments, reports, attendance, schedules, requests, points, Gmail lock and
-- password. The teacher signs in with the new ID next time.
-- v149: change a teacher's password; the old password works once more, then
-- the dashboard shows a notice with the new ID and password
create or replace function public.rotate_teacher_password(p_tid text, p_new text, p_old_id text default null, p_by text default null)
returns void language plpgsql security definer set search_path = public as $$
declare oldhash text; uid uuid;
begin
  select l.user_id into uid from public.teacher_logins l where l.teacher_id = p_tid;
  select u.encrypted_password into oldhash from auth.users u where u.id = uid;
  if p_old_id is null and oldhash is not null and oldhash = extensions.crypt(p_new, oldhash) then
    update public.teacher_logins set current_password = p_new where teacher_id = p_tid;
    return; -- the same password: nothing changes
  end if;
  -- v150: the earlier password and ID are kept (also older ones, not only the last)
  if oldhash is not null or p_old_id is not null then
    insert into public.teacher_old_logins (teacher_id, old_id, pw_hash) values (p_tid, p_old_id, oldhash);
  end if;
  perform public.ensure_teacher_login(p_tid, p_new, p_by, false);
  update public.teacher_logins set
      current_password = p_new,
      old_password_hash = oldhash,
      old_teacher_id = coalesce(p_old_id, old_teacher_id),
      grace_left = case when oldhash is not null or p_old_id is not null then 1 else 0 end,
      login_notice = jsonb_build_object('kind', case when p_old_id is not null then 'id' else 'password' end,
        'teacherId', p_tid, 'oldId', p_old_id, 'password', p_new, 'at', now())
    where teacher_id = p_tid;
end $$;
revoke all on function public.rotate_teacher_password(text, text, text, text) from public, anon, authenticated;

-- v149: move a teacher to another Teacher ID; everything moves with them
create or replace function public.rename_teacher_core(p_old text, p_new text, p_cat text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if p_old = p_new then return; end if;
  if exists (select 1 from public.portal_teachers where id = p_new) then raise exception 'Teacher ID % is already used.', p_new; end if;
  perform set_config('qit.teacher_login', 'on', true);
  perform set_config('qit.keep_password', 'on', true);
  select l2.user_id into uid from public.teacher_logins l2 where l2.teacher_id = p_old;
  -- a sign-in left over from a teacher who had this ID before steps aside
  delete from public.teacher_logins where teacher_id = p_new;
  update auth.users set email = replace(lower(email), '@institute.local', '-old' || to_char(now(), 'YYYYMMDDHH24MISSMS') || '@institute.local'),
      updated_at = now()
    where lower(email) = public.teacher_login_email(p_new) and id is distinct from uid;
  update public.portal_teachers
    set id = p_new, data = data || jsonb_build_object('id', p_new) || case when p_cat is not null then jsonb_build_object('category', p_cat) else '{}'::jsonb end, updated_at = now()
    where id = p_old;
  update public.portal_students set data = data || jsonb_build_object('teacherId', p_new), updated_at = now() where teacher_id = p_old;
  update public.portal_payments set data = data || jsonb_build_object('teacherId', p_new) where teacher_id = p_old;
  update public.portal_reports set data = data || jsonb_build_object('teacherId', p_new) where data ->> 'teacherId' = p_old;
  update public.class_schedules set teacher_id = p_new where teacher_id = p_old;
  update public.daily_attendance set teacher_id = p_new where teacher_id = p_old;
  update public.monthly_reports set teacher_id = p_new where teacher_id = p_old;
  update public.points_adjustments set teacher_id = p_new where teacher_id = p_old;
  update public.teacher_inquiries set teacher_id = p_new where teacher_id = p_old;
  update public.teacher_profiles set teacher_id = p_new where teacher_id = p_old;
  update public.teacher_profiles set claim_teacher_id = p_new where claim_teacher_id = p_old;
  -- v150: the earlier passwords move with the teacher (the first password too)
  update public.teacher_old_logins set teacher_id = p_new where teacher_id = p_old;
  insert into public.teacher_old_logins (teacher_id, old_id, pw_hash)
    select p_new, p_old, extensions.crypt(l3.initial_password, extensions.gen_salt('bf'))
    from public.teacher_logins l3 where l3.teacher_id = p_old and nullif(l3.initial_password, '') is not null;
  update public.teacher_logins set teacher_id = p_new, initial_password = null where teacher_id = p_old;
  -- (the teacher's open session keeps working: it now belongs to the new ID)
  if uid is not null then
    update auth.users set email = public.teacher_login_email(p_new),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('qit_teacher', p_new),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('teacher_id', p_new),
      updated_at = now()
    where id = uid;
    update auth.identities set identity_data = identity_data || jsonb_build_object('email', public.teacher_login_email(p_new)),
      provider_id = case when provider = 'email' then uid::text else provider_id end
    where user_id = uid;
  end if;
  update public.security_events set teacher_id = p_new where teacher_id = p_old;
end $$;
revoke all on function public.rename_teacher_core(text, text, text) from public, anon, authenticated;

create or replace function public.change_teacher_id_core(p_teacher_id text, p_category text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  old_id text := public.norm_teacher_id(p_teacher_id);
  l text := public.teacher_cat_letter(p_category);
  new_id text; pw text;
begin
  if not exists (select 1 from public.portal_teachers where id = old_id) then raise exception 'Teacher % not found.', old_id; end if;
  if l is null then raise exception 'Choose a category: Residential, Non-Residential Male or Non-Residential Female.'; end if;
  if public.is_category_id(old_id) and substring(old_id from 5 for 1) = l then
    raise exception '% already has a % ID.', old_id, public.teacher_cat_name(l);
  end if;
  new_id := public.next_category_teacher_id(l);
  perform public.rename_teacher_core(old_id, new_id, public.teacher_cat_name(l));
  -- v149: the new ID has its own automatic password; the old ID + password work once more
  pw := public.teacher_default_password(new_id);
  perform public.rotate_teacher_password(new_id, pw, old_id, 'office');
  perform public.log_security('teacher_id_changed', new_id, old_id || ' -> ' || new_id);
  return jsonb_build_object('oldId', old_id, 'teacherId', new_id, 'password', pw);
end $$;
revoke all on function public.change_teacher_id_core(text, text) from public, anon, authenticated;

create or replace function public.admin_change_teacher_id(p_teacher_id text, p_category text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only Executives can change Teacher IDs.'; end if;
  return public.change_teacher_id_core(p_teacher_id, p_category);
end $$;

-- Every teacher with an old ID (QIT-007) and a category gets the ID of their
-- category now, in the order of their old numbers: Residential QIT-R…,
-- Non-Residential Male QIT-M…, Non-Residential Female QIT-F…. Their
-- students, salary, reports, attendance, Gmail lock and password move with
-- them. Teachers with no category keep their old ID until one is set (then
-- use "New ID" in Teacher Dashboards).
do $$
declare r record;
begin
  for r in select id, data ->> 'category' as cat from public.portal_teachers
           where id ~ '^QIT-[0-9]+$' and public.teacher_cat_letter(data ->> 'category') is not null
           order by substring(id from '[0-9]+$')::int loop
    perform public.change_teacher_id_core(r.id, r.cat);
  end loop;
end $$;

-- Phone numbers of a student ("01711…, 01822…") as last-10-digit keys
create or replace function public.student_phone_keys(p text)
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct k), '{}') from (
    select public.phone_key(x) k from unnest(regexp_split_to_array(coalesce(p, ''), '\s*(?:,|/|;|\||\s+or\s+)\s*')) x
  ) t where char_length(k) >= 7;
$$;

-- v151: a student with the same WhatsApp number AND the same name as another
-- student is the same child. Brothers and sisters on one number need different
-- names; the same child in a second class (another teacher) is marked with
-- "sameStudentOf" (Same student, 2 different classes).
create or replace function public.same_student_of(p_name text, p_phone text, p_except text default null)
returns text language sql stable security definer set search_path = public as $$
  select o.id from public.portal_students o
  where o.id is distinct from p_except
    and lower(regexp_replace(btrim(coalesce(o.data ->> 'name', '')), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'))
    and public.student_phone_keys(o.data ->> 'phone') && public.student_phone_keys(p_phone)
  order by o.id limit 1;
$$;
revoke all on function public.same_student_of(text, text, text) from public, anon, authenticated;

-- One student record takes over another (same child): class times,
-- attendance and reports of the old record move to the new one, then the old
-- record is removed. (If both have attendance on the same day or a report
-- for the same month, the new record's entry is kept.)
create or replace function public.merge_student_into(p_old text, p_new text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_old = p_new then return; end if;
  update public.class_schedules set student_id = p_new,
    teacher_id = (select teacher_id from public.portal_students where id = p_new)
    where student_id = p_old;
  delete from public.daily_attendance o where o.student_id = p_old and not o.is_recovery
    and exists (select 1 from public.daily_attendance n where n.student_id = p_new and n.day = o.day and not n.is_recovery);
  update public.daily_attendance set student_id = p_new where student_id = p_old;
  delete from public.monthly_reports o where o.student_id = p_old
    and exists (select 1 from public.monthly_reports n where n.student_id = p_new and n.month = o.month and n.year = o.year);
  update public.monthly_reports set student_id = p_new where student_id = p_old;
  update public.portal_reports set data = data || jsonb_build_object('studentId', p_new) where data ->> 'studentId' = p_old;
  delete from public.portal_students where id = p_old;
end $$;
revoke all on function public.merge_student_into(text, text) from public, anon, authenticated;

-- Executives: put students under another teacher.
--   mode 'cut'  : the students move (their weekly class times move too; past
--                 attendance and reports stay with the teacher who taught them)
--   mode 'copy' : a copy of each student is made for the other teacher, with
--                 a new Student ID; the original stays where it is
--   p_replace   : { "<incoming student id>": ["<student id at the new teacher>", …] }
--                 the same child already with the new teacher (same name, or
--                 the same number when it is not a brother/sister) is replaced
--                 by the incoming record; their history moves with it
drop function if exists public.admin_transfer_students(text[], text, text);
create or replace function public.admin_transfer_students(p_student_ids text[], p_to_teacher text, p_mode text, p_replace jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  to_id text := public.norm_teacher_id(p_to_teacher);
  sid text; nid text; dest text; n int; moved int := 0; copies jsonb := '[]'::jsonb; replaced jsonb := '[]'::jsonb;
  st public.portal_students; old_id text;
begin
  if not public.is_admin() then raise exception 'Only Executives can move or copy students.'; end if;
  if p_mode not in ('cut', 'copy') then raise exception 'Choose Copy or Cut.'; end if;
  if not exists (select 1 from public.portal_teachers where id = to_id) then raise exception 'Teacher % not found.', to_id; end if;
  perform pg_advisory_xact_lock(hashtext('qit_student_id'));
  n := public.next_portal_number('portal_students', 'QIT-S');
  foreach sid in array coalesce(p_student_ids, '{}') loop
    select * into st from public.portal_students where id = sid;
    if st.id is null or st.teacher_id is not distinct from to_id then continue; end if;
    if p_mode = 'cut' then
      update public.portal_students set data = data || jsonb_build_object('teacherId', to_id), updated_at = now() where id = sid;
      update public.class_schedules set teacher_id = to_id where student_id = sid;
      moved := moved + 1;
      dest := sid;
    else
      nid := 'QIT-S' || lpad(n::text, 3, '0'); n := n + 1;
      insert into public.portal_students (id, data)
        values (nid, st.data || jsonb_build_object('id', nid, 'teacherId', to_id, 'copiedFrom', sid));
      copies := copies || jsonb_build_object('from', sid, 'to', nid);
      dest := nid;
    end if;
    -- replace the same child already with this teacher
    for old_id in select jsonb_array_elements_text(coalesce(p_replace -> sid, '[]'::jsonb)) loop
      if old_id = sid or old_id = any(p_student_ids)
         or not exists (select 1 from public.portal_students where id = old_id and teacher_id = to_id) then continue; end if;
      replaced := replaced || jsonb_build_object('old', old_id, 'by', dest,
        'name', (select data ->> 'name' from public.portal_students where id = old_id));
      perform public.merge_student_into(old_id, dest);
    end loop;
  end loop;
  return jsonb_build_object('moved', moved, 'copied', copies, 'replaced', replaced);
end $$;

do $$
declare f text;
begin
  foreach f in array array['admin_change_teacher_id(text, text)', 'admin_transfer_students(text[], text, text, jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 7n. Student status, weekly times in the office's view, unique teacher numbers --

-- Student status: Active / Hold / Inactive (anything else is read as one of
-- these: "on hold", "paused" -> Hold; "left", "discontinued", "completed" ->
-- Inactive; empty -> Active). Delete still removes a student for good.
do $$ begin
  create type public.student_status as enum ('Active', 'Hold', 'Inactive');
exception when duplicate_object then null; end $$;
create or replace function public.student_status_of(v text)
returns public.student_status language sql immutable as $$
  select (case
    when lower(btrim(coalesce(v, ''))) in ('hold', 'on hold', 'on-hold', 'paused', 'pause', 'break') then 'Hold'
    when lower(btrim(coalesce(v, ''))) in ('inactive', 'left', 'discontinued', 'stopped', 'completed', 'closed', 'off') then 'Inactive'
    else 'Active' end)::public.student_status;
$$;
alter table public.portal_students add column if not exists status public.student_status
  generated always as (public.student_status_of(data ->> 'status')) stored;
create index if not exists portal_students_status_idx on public.portal_students (teacher_id, status);
create or replace function public.portal_students_status_norm()
returns trigger language plpgsql as $$
begin
  new.data := new.data || jsonb_build_object('status', public.student_status_of(new.data ->> 'status')::text);
  if tg_op = 'UPDATE' and (old.data ->> 'status') is distinct from (new.data ->> 'status') then
    new.data := new.data || jsonb_build_object('statusChangedAt', now());
  end if;
  return new;
end $$;
drop trigger if exists portal_students_status_norm on public.portal_students;
create trigger portal_students_status_norm before insert or update on public.portal_students
  for each row execute function public.portal_students_status_norm();
update public.portal_students set data = data || jsonb_build_object('status', public.student_status_of(data ->> 'status')::text)
  where (data ->> 'status') is distinct from public.student_status_of(data ->> 'status')::text;

-- Teachers mark attendance only for Active students
create or replace function public.daily_attendance_active_only()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null and not public.is_admin()
     and exists (select 1 from public.portal_students s where s.id = new.student_id and s.status <> 'Active') then
    raise exception 'student_not_active' using hint = 'This student is on hold or inactive.';
  end if;
  return new;
end $$;
drop trigger if exists daily_attendance_active_only on public.daily_attendance;
create trigger daily_attendance_active_only before insert on public.daily_attendance
  for each row execute function public.daily_attendance_active_only();

-- The teacher's page: every student with their status, and the numbers
-- (active now, on hold, inactive, and all students ever taught - including
-- ones since moved to another teacher who have attendance or reports here)
create or replace function public.teacher_home(p_teacher_id text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare tid text := public.resolve_teacher(p_teacher_id);
begin
  return jsonb_build_object(
    'teacher', (select jsonb_build_object(
        'id', t.id, 'name', t.data ->> 'name', 'category', t.data ->> 'category', 'department', t.data ->> 'department',
        'salaryType', t.data ->> 'salaryType', 'whatsapp', coalesce(p.whatsapp, nullif(t.data ->> 'whatsapp', 'N/A')),
        'email', coalesce(p.email, t.email), 'fullName', coalesce(p.full_name, t.data ->> 'name'),
        'hasAccount', p.user_id is not null, 'userId', p.user_id)
      from public.portal_teachers t left join public.teacher_profiles p on p.teacher_id = t.id and p.link_status = 'active'
      where t.id = tid),
    'students', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.data ->> 'name', 'phone', s.data ->> 'phone', 'course', s.data ->> 'course',
        'status', s.status::text, 'statusChangedAt', s.data ->> 'statusChangedAt', 'classTime', s.data ->> 'classTime', 'since', s.created_at,
        'scheduleType', case when s.data ->> 'scheduleType' = 'flexible' then 'flexible' else 'fixed' end,
        -- v149: class division, first class date, and a delete request waiting for the office
        'medium', s.data ->> 'medium', 'assignDate', s.data ->> 'assignDate',
        'deleteRequested', s.data -> 'deleteRequest' is not null and s.data -> 'deleteRequest' <> 'null'::jsonb)
        order by s.data ->> 'name')
      from public.portal_students s where s.teacher_id = tid), '[]'::jsonb),
    'stats', jsonb_build_object(
      'active', (select count(*) from public.portal_students where teacher_id = tid and status = 'Active'),
      'hold', (select count(*) from public.portal_students where teacher_id = tid and status = 'Hold'),
      'inactive', (select count(*) from public.portal_students where teacher_id = tid and status = 'Inactive'),
      'allTime', (select count(distinct x) from (
          select id as x from public.portal_students where teacher_id = tid
          union select student_id from public.daily_attendance where teacher_id = tid
          union select student_id from public.monthly_reports where teacher_id = tid) a)));
end $$;

-- The weekly class times a teacher sets (Schedule) are written into the
-- student's "Class Time" too, so the office sees them at once
-- (e.g. "Sun, Tue, Thu 7:00 PM"). A time the office typed by hand is only
-- replaced while the student has weekly times.
create or replace function public.class_time_summary(p_student text)
returns text language sql stable security definer set search_path = public as $$
  select string_agg(days || ' ' || tm, '; ' order by first_day, st)
  from (
    select start_time as st, min(weekday) as first_day,
      string_agg((array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[weekday + 1], ', ' order by weekday) as days,
      to_char(start_time, 'FMHH12:MI AM') as tm
    from public.class_schedules where student_id = p_student
    group by start_time
  ) g;
$$;
create or replace function public.class_schedules_sync_student()
returns trigger language plpgsql security definer set search_path = public as $$
declare sid text := coalesce(new.student_id, old.student_id); summary text;
begin
  summary := public.class_time_summary(sid);
  if summary is not null then
    update public.portal_students set data = data || jsonb_build_object('classTime', summary, 'classTimeAuto', true), updated_at = now()
      where id = sid and (data ->> 'classTime') is distinct from summary;
  else
    update public.portal_students set data = (data - 'classTimeAuto') || jsonb_build_object('classTime', ''), updated_at = now()
      where id = sid and coalesce((data ->> 'classTimeAuto')::boolean, false);
  end if;
  if tg_op = 'UPDATE' and old.student_id is distinct from new.student_id then
    summary := public.class_time_summary(old.student_id);
    update public.portal_students set data = data || jsonb_build_object('classTime', coalesce(summary, '')), updated_at = now()
      where id = old.student_id and coalesce((data ->> 'classTimeAuto')::boolean, false);
  end if;
  return null;
end $$;
drop trigger if exists class_schedules_sync_student on public.class_schedules;
create trigger class_schedules_sync_student after insert or update or delete on public.class_schedules
  for each row execute function public.class_schedules_sync_student();
-- existing weekly times -> Class Time now
update public.portal_students s set data = data || jsonb_build_object('classTime', public.class_time_summary(s.id), 'classTimeAuto', true)
  where exists (select 1 from public.class_schedules c where c.student_id = s.id)
    and (data ->> 'classTime') is distinct from public.class_time_summary(s.id);

-- Teacher WhatsApp numbers are unique (compared by the last 10 digits, so
-- "+880 1711-000000" and "01711000000" are the same). Names may repeat.
create or replace function public.portal_teachers_phone_unique()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text := public.phone_key(new.data ->> 'whatsapp'); other record;
begin
  if char_length(k) < 7 then return new; end if;
  if tg_op = 'UPDATE' and public.phone_key(old.data ->> 'whatsapp') = k then return new; end if;
  select id, data ->> 'name' as name into other from public.portal_teachers
    where id <> new.id and public.phone_key(data ->> 'whatsapp') = k limit 1;
  if other.id is not null then
    raise exception 'teacher_phone_taken: This WhatsApp number is already used by % (%).', other.name, other.id
      using hint = other.id;
  end if;
  return new;
end $$;
drop trigger if exists portal_teachers_phone_unique on public.portal_teachers;
create trigger portal_teachers_phone_unique before insert or update on public.portal_teachers
  for each row execute function public.portal_teachers_phone_unique();
-- Also a unique index, when the numbers already saved allow it
do $$ begin
  create unique index if not exists portal_teachers_phone_key on public.portal_teachers (public.phone_key(data ->> 'whatsapp'))
    where char_length(public.phone_key(data ->> 'whatsapp')) >= 7;
exception when unique_violation then
  raise notice 'Some teachers already share a WhatsApp number (see duplicate_teacher_phones below); new duplicates are still refused.';
end $$;

-- 7o. One teacher, one ID: merging a duplicate --------------------------------
-- A teacher who signed up under a different spelling of their name can end up
-- with a second, new Teacher ID. Executives merge that duplicate into the
-- teacher's real record: the Gmail lock, students, payments, schedules,
-- attendance, reports, requests and points move to the real ID, the duplicate
-- is removed, and the teacher uses the real ID and ITS password from then on.
-- Their open session keeps working (it now belongs to the real ID).
create or replace function public.admin_merge_teacher(p_from text, p_into text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f text := public.norm_teacher_id(p_from); t text := public.norm_teacher_id(p_into);
  fp public.teacher_profiles; tp public.teacher_profiles; fl public.teacher_logins; fr public.portal_teachers; pw text; gaps jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'Only Executives can merge teachers.'; end if;
  if f = t then raise exception 'Choose two different teachers.'; end if;
  select * into fr from public.portal_teachers where id = f;
  if fr.id is null then raise exception 'Teacher % not found.', f; end if;
  if not exists (select 1 from public.portal_teachers where id = t) then raise exception 'Teacher % not found.', t; end if;
  select * into fp from public.teacher_profiles where teacher_id = f and link_status = 'active';
  select * into tp from public.teacher_profiles where teacher_id = t and link_status = 'active';
  if fp.user_id is not null and tp.user_id is not null then
    raise exception '% is already locked to %. Remove that Gmail in Security first, or merge the other way.', t, tp.email;
  end if;
  perform set_config('qit.teacher_login', 'on', true);
  perform set_config('qit.keep_password', 'on', true);
  select * into fl from public.teacher_logins where teacher_id = f;

  -- everything the duplicate owns moves to the real ID
  update public.portal_students set data = data || jsonb_build_object('teacherId', t), updated_at = now() where teacher_id = f;
  update public.portal_payments set data = data || jsonb_build_object('teacherId', t) where teacher_id = f;
  update public.portal_reports set data = data || jsonb_build_object('teacherId', t) where data ->> 'teacherId' = f;
  update public.class_schedules set teacher_id = t where teacher_id = f;
  update public.daily_attendance set teacher_id = t where teacher_id = f;
  update public.monthly_reports set teacher_id = t where teacher_id = f;
  update public.points_adjustments set teacher_id = t where teacher_id = f;
  update public.teacher_inquiries set teacher_id = t where teacher_id = f;
  update public.teacher_profiles set claim_teacher_id = t where claim_teacher_id = f;
  update public.security_events set teacher_id = t where teacher_id = f;

  -- the duplicate's record goes first (frees its Gmail and number), then the
  -- Gmail lock and the open session move to the real ID
  update public.teacher_profiles set teacher_id = null, link_status = 'pending' where teacher_id = f;
  delete from public.portal_teachers where id = f;   -- (also removes its sign-in)
  if fp.user_id is not null then
    update public.portal_teachers set data = data || jsonb_build_object('email', fp.email,
        'whatsapp', coalesce(nullif(nullif(data ->> 'whatsapp', ''), 'N/A'), nullif(fr.data ->> 'whatsapp', 'N/A'), fp.whatsapp)),
      updated_at = now() where id = t;
    insert into public.teacher_profiles (user_id, teacher_id, full_name, whatsapp, email, link_status, linked_by, first_unlock_at)
      values (fp.user_id, t, (select coalesce(nullif(data ->> 'name', ''), fp.full_name) from public.portal_teachers where id = t),
              fp.whatsapp, fp.email, 'active', 'office', fp.first_unlock_at)
      on conflict (user_id) do update set teacher_id = excluded.teacher_id, link_status = 'active', claim_teacher_id = null,
        full_name = excluded.full_name, linked_by = 'office';
    update public.teacher_logins set active_session = fl.active_session, active_device = fl.active_device,
      active_since = fl.active_since, last_seen = fl.last_seen where teacher_id = t and fl.active_session is not null;
  end if;
  perform public.log_security('teacher_merged', t, f || ' merged into ' || t);
  -- v149: no gap in the IDs: later IDs of that category move down by one
  -- (their old ID + password open once more, then they see the new ones)
  if public.is_category_id(f) then
    gaps := public.fill_teacher_id_gaps_core(substring(f from 5 for 1));
    t := coalesce((select g ->> 'teacherId' from jsonb_array_elements(gaps) g where g ->> 'oldId' = t), t);
  end if;
  pw := public.teacher_default_password(t);
  return jsonb_build_object('teacherId', t, 'removedId', f, 'renumbered', gaps,
    'password', (select case when u.encrypted_password = extensions.crypt(coalesce(pw, ''), u.encrypted_password) then pw end
                 from public.teacher_logins l join auth.users u on u.id = l.user_id where l.teacher_id = t));
end $$;
revoke all on function public.admin_merge_teacher(text, text) from public, anon;
grant execute on function public.admin_merge_teacher(text, text) to authenticated;

-- v149: Teacher IDs without gaps (R023, R024, R025 … never R023 → R025).
-- Teachers after a gap move down; their old ID + password open the dashboard
-- once more, then a notice shows the new ID and password.
create or replace function public.teacher_id_gap_plan(p_letter text default null)
returns table (old_id text, new_id text) language plpgsql stable security definer set search_path = public as $$
declare lt text; r record; k int; held int[];
begin
  foreach lt in array case when p_letter is null then array['R', 'M', 'F'] else array[upper(p_letter)] end loop
    -- an ID that still has the history of a deleted teacher (reports,
    -- attendance, payments) stays taken, so that history never mixes with
    -- someone else's
    select coalesce(array_agg(distinct substring(x from '([0-9]+)$')::int), '{}') into held from (
      select teacher_id as x from public.monthly_reports
      union select teacher_id from public.daily_attendance
      union select teacher_id from public.portal_payments) h
      where x ~ ('^QIT-' || lt || '[0-9]{3,}$') and not exists (select 1 from public.portal_teachers p where p.id = h.x);
    k := 0;
    for r in select id, substring(id from '([0-9]+)$')::int as n from public.portal_teachers
             where id ~ ('^QIT-' || lt || '[0-9]{3,}$') order by 2 loop
      k := k + 1;
      while k = any(held) loop k := k + 1; end loop;
      if k < r.n then old_id := r.id; new_id := 'QIT-' || lt || lpad(k::text, 3, '0'); return next;
      else k := r.n; end if;
    end loop;
  end loop;
end $$;
revoke all on function public.teacher_id_gap_plan(text) from public, anon, authenticated;

create or replace function public.fill_teacher_id_gaps_core(p_letter text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; res jsonb := '[]'::jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('qit_teacher_id'));
  for r in select * from public.teacher_id_gap_plan(p_letter) loop
    perform public.rename_teacher_core(r.old_id, r.new_id, null);
    perform public.rotate_teacher_password(r.new_id, public.teacher_default_password(r.new_id), r.old_id, 'office');
    perform public.log_security('teacher_id_changed', r.new_id, r.old_id || ' -> ' || r.new_id || ' (no gap)');
    res := res || jsonb_build_array(jsonb_build_object('oldId', r.old_id, 'teacherId', r.new_id, 'password', public.teacher_default_password(r.new_id)));
  end loop;
  return res;
end $$;
revoke all on function public.fill_teacher_id_gaps_core(text) from public, anon, authenticated;

-- Executives: see the gaps first, then close them
create or replace function public.admin_teacher_id_gaps()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only Executives can change Teacher IDs.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('oldId', old_id, 'teacherId', new_id,
    'name', (select data ->> 'name' from public.portal_teachers where id = old_id))) from public.teacher_id_gap_plan(null)), '[]'::jsonb);
end $$;
create or replace function public.admin_fill_teacher_id_gaps()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only Executives can change Teacher IDs.'; end if;
  return public.fill_teacher_id_gaps_core(null);
end $$;
revoke all on function public.admin_teacher_id_gaps(), public.admin_fill_teacher_id_gaps() from public, anon;
grant execute on function public.admin_teacher_id_gaps(), public.admin_fill_teacher_id_gaps() to authenticated;

-- 7p. Speed ---------------------------------------------------------------------
-- Security rules are written as (select public.is_admin()) so the database
-- works out "is this an Executive?" once per request instead of once for every
-- row it reads. (With hundreds of students, payments and reports that check
-- was running thousands of times per page.) The website rules made by
-- complete-setup.sql get the same treatment here.
do $$
begin
  if to_regclass('public.site_content') is not null then
    drop policy if exists "Admins can change site content" on public.site_content;
    create policy "Admins can change site content" on public.site_content
      for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
  end if;
  if to_regclass('public.inquiries') is not null then
    drop policy if exists "Admins can add any inquiry" on public.inquiries;
    create policy "Admins can add any inquiry" on public.inquiries for insert to authenticated with check ((select public.is_admin()));
    drop policy if exists "Admins can read inquiries" on public.inquiries;
    create policy "Admins can read inquiries" on public.inquiries for select to authenticated using ((select public.is_admin()));
    drop policy if exists "Admins can update inquiries" on public.inquiries;
    create policy "Admins can update inquiries" on public.inquiries for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
    drop policy if exists "Admins can delete inquiries" on public.inquiries;
    create policy "Admins can delete inquiries" on public.inquiries for delete to authenticated using ((select public.is_admin()));
  end if;
end $$;
create index if not exists security_events_teacher on public.security_events (teacher_id, at desc);
create index if not exists daily_attendance_teacher_day on public.daily_attendance (teacher_id, day);
create index if not exists monthly_reports_teacher on public.monthly_reports (teacher_id, year, month);
analyze public.portal_students; analyze public.portal_teachers; analyze public.portal_payments;

-- 8. Live updates for the admin screens -----------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.monthly_reports; exception when duplicate_object or undefined_object then null; end;
  begin alter publication supabase_realtime add table public.teacher_inquiries; exception when duplicate_object or undefined_object then null; end;
  -- The Management Portal updates instantly when a teacher signs up or a record changes
  begin alter publication supabase_realtime add table public.portal_teachers; exception when duplicate_object or undefined_object then null; end;
  begin alter publication supabase_realtime add table public.portal_students; exception when duplicate_object or undefined_object then null; end;
  begin alter publication supabase_realtime add table public.portal_payments; exception when duplicate_object or undefined_object then null; end;
  begin alter publication supabase_realtime add table public.teacher_profiles; exception when duplicate_object or undefined_object then null; end;
  begin alter publication supabase_realtime add table public.daily_attendance; exception when duplicate_object or undefined_object then null; end;
end $$;

-- Grants for the functions added in 7b-7f
do $$
declare f text;
begin
  foreach f in array array['admin_portal_teachers()', 'teacher_stats(text, text, int)', 'admin_leaderboard(text, int)',
    'admin_resolve_claim(uuid, boolean, text)', 'admin_teacher_logins()', 'admin_set_teacher_password(text, text)',
    'admin_disable_teacher_login(text)', 'my_login_info()', 'admin_remove_teacher_account(uuid)',
    'staff_portal_data()', 'staff_add_teachers(jsonb)', 'staff_add_students(jsonb)', 'staff_update_student(text, jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['create_portal_teacher(text, text, text, text)', 'next_category_teacher_id(text)', 'resolve_teacher(text)', 'ensure_teacher_login(text, text, text, boolean)',
    'disable_teacher_login(text, boolean)', 'portal_teachers_login_sync()', 'guard_teacher_logins()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- 7q. Office edits of weekly class times (v112) -------------------------------
-- Executives AND Junior Admins add, change and remove a student's weekly class
-- times from Management Portal -> Students -> Edit.
drop policy if exists "Executives manage schedules" on public.class_schedules;
drop policy if exists "Staff manage schedules" on public.class_schedules;
create policy "Staff manage schedules" on public.class_schedules
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- When the office gives a student to another teacher from the Edit pop-up,
-- the weekly class times go with the student (the new teacher sees them).
create or replace function public.portal_students_teacher_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.data ->> 'teacherId', '') <> '' and (new.data ->> 'teacherId') is distinct from (old.data ->> 'teacherId') then
    update public.class_schedules set teacher_id = new.data ->> 'teacherId', updated_at = now()
      where student_id = new.id and teacher_id is distinct from (new.data ->> 'teacherId');
  end if;
  return new;
end $$;
drop trigger if exists portal_students_teacher_sync on public.portal_students;
create trigger portal_students_teacher_sync after update on public.portal_students
  for each row execute function public.portal_students_teacher_sync();
-- repair: class times left with a previous teacher
update public.class_schedules c set teacher_id = s.data ->> 'teacherId'
  from public.portal_students s
  where s.id = c.student_id and coalesce(s.data ->> 'teacherId', '') <> '' and c.teacher_id is distinct from (s.data ->> 'teacherId');

-- v113: a student with weekly class times always shows them as Class Time,
-- whoever saves the student afterwards (a typed note can no longer replace them).
create or replace function public.portal_students_class_time_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare summary text;
begin
  if coalesce(new.data ->> 'scheduleType', 'fixed') = 'flexible' then return new; end if;
  summary := public.class_time_summary(new.id);
  if summary is not null and (new.data ->> 'classTime') is distinct from summary then
    new.data := new.data || jsonb_build_object('classTime', summary, 'classTimeAuto', true);
  end if;
  return new;
end $$;
drop trigger if exists portal_students_class_time_guard on public.portal_students;
create trigger portal_students_class_time_guard before update on public.portal_students
  for each row execute function public.portal_students_class_time_guard();

-- v114: one call sets a student's whole weekly timetable (add, change and
-- remove together, all or nothing). p_slots = [{weekday, start_time, duration_min, note}].
-- The student's teacher, Executives and Junior Admins may call it.
create or replace function public.set_student_schedule(p_student_id text, p_slots jsonb, p_teacher_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  st public.portal_students;
  staff boolean := public.is_staff();
  tid text;
  slot jsonb;
  wd int; tm time; dur int; nt text;
  keep uuid[] := '{}';
  rid uuid;
begin
  select * into st from public.portal_students where id = p_student_id;
  if not found then raise exception 'student_missing'; end if;
  if not staff and not public.teaches(p_student_id) then raise exception 'Not allowed.'; end if;
  if coalesce(st.data ->> 'scheduleType', 'fixed') = 'flexible' then raise exception 'schedule_flexible'; end if;
  tid := coalesce(nullif(st.data ->> 'teacherId', ''), case when staff then nullif(btrim(coalesce(p_teacher_id, '')), '') end);
  if tid is null then raise exception 'schedule_no_teacher'; end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then raise exception 'schedule_invalid'; end if;
  if jsonb_array_length(p_slots) > 28 then raise exception 'schedule_invalid'; end if;

  for slot in select * from jsonb_array_elements(p_slots) loop
    begin
      wd := (slot ->> 'weekday')::int;
      tm := (slot ->> 'start_time')::time;
      dur := coalesce(nullif(slot ->> 'duration_min', '')::int, 45);
    exception when others then raise exception 'schedule_invalid';
    end;
    nt := nullif(btrim(coalesce(slot ->> 'note', '')), '');
    if wd is null or wd < 0 or wd > 6 or tm is null or dur < 10 or dur > 240 or char_length(coalesce(nt, '')) > 300 then
      raise exception 'schedule_invalid';
    end if;
    select id into rid from public.class_schedules
      where student_id = p_student_id and weekday = wd and start_time = tm and not (id = any(keep)) limit 1;
    if rid is null then
      if exists (select 1 from public.class_schedules where student_id = p_student_id and weekday = wd and start_time = tm) then
        raise exception 'schedule_clash';
      end if;
      insert into public.class_schedules (teacher_id, student_id, weekday, start_time, duration_min, note)
        values (tid, p_student_id, wd, tm, dur, nt) returning id into rid;
    else
      update public.class_schedules set duration_min = dur, note = nt, teacher_id = tid, updated_at = now()
        where id = rid and (duration_min <> dur or note is distinct from nt or teacher_id <> tid);
    end if;
    keep := keep || rid;
  end loop;
  delete from public.class_schedules where student_id = p_student_id and not (id = any(keep));
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.weekday, c.start_time) from public.class_schedules c where c.student_id = p_student_id), '[]'::jsonb);
end $$;
revoke all on function public.set_student_schedule(text, jsonb, text) from public, anon;
grant execute on function public.set_student_schedule(text, jsonb, text) to authenticated;

-- v118: a student's attendance for a period, for the progress report forms.
-- Regular classes marked + recovery classes held; a flexible student has no
-- absences. The student's teacher, Executives and Junior Admins may read it.
create or replace function public.student_attendance_summary(p_student_id text, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare flex boolean; x record;
begin
  if not public.is_staff() and not public.teaches(p_student_id) then raise exception 'Not allowed.'; end if;
  select coalesce(data ->> 'scheduleType', 'fixed') = 'flexible' into flex from public.portal_students where id = p_student_id;
  select count(*) filter (where not is_recovery) as regular,
         count(*) filter (where not is_recovery and status = 'present') as present,
         count(*) filter (where not is_recovery and status <> 'present') as absent,
         count(*) filter (where is_recovery and status = 'present' and coalesce(approval, 'approved') = 'approved') as recovery,
         string_agg(nullif(btrim(note), ''), '; ' order by day) filter (where not is_recovery and status <> 'present') as reasons
    into x from public.daily_attendance where student_id = p_student_id and day between p_from and p_to;
  return jsonb_build_object(
    'regular', x.regular, 'present', x.present, 'absent', case when coalesce(flex, false) then 0 else x.absent end, 'recovery', x.recovery,
    'total', case when coalesce(flex, false) then x.present + x.recovery else x.regular + x.recovery end,
    'attended', x.present + x.recovery,
    'reasons', case when coalesce(flex, false) then null else x.reasons end);
end $$;
revoke all on function public.student_attendance_summary(text, date, date) from public, anon;
grant execute on function public.student_attendance_summary(text, date, date) to authenticated;

-- v121: the Executive password can be a PIN (digits only, 6 to 8). The sign-in
-- screen then shows that many boxes and checks the PIN as soon as it is typed.
-- Only the LENGTH is stored next to the hash, and only an Executive Gmail that
-- is signed in with Google can read it.
alter table public.executive_secret add column if not exists pin_length int;
create or replace function public.admin_set_executive_password(p_current text, p_new text)
returns void language plpgsql security definer set search_path = public as $$
declare h text;
begin
  if not public.is_admin() then raise exception 'Only Executives can change the Executive password.'; end if;
  select hash into h from public.executive_secret where id = 1;
  if h <> extensions.crypt(coalesce(p_current, ''), h) then raise exception 'The current Executive password is not correct.'; end if;
  if char_length(coalesce(p_new, '')) not between 6 and 64 then raise exception 'The new password must be 6 to 64 characters.'; end if;
  update public.executive_secret set hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)), changed_by = public.google_email(), changed_at = now(),
    pin_length = case when p_new ~ '^[0-9]{6,8}$' then char_length(p_new) end
    where id = 1;
  perform public.log_security('admin_password_changed', null, case when p_new ~ '^[0-9]{6,8}$' then 'Changed to a PIN' end);
end $$;
create or replace function public.executive_pin_length()
returns int language sql stable security definer set search_path = public as $$
  select case when public.is_executive_gmail() then (select pin_length from public.executive_secret where id = 1) end;
$$;
revoke all on function public.executive_pin_length() from public, anon;
grant execute on function public.executive_pin_length() to authenticated;

-- v129/v130: Junior Admins edit a teacher from the Teacher List: everything
-- on the Edit Teacher form EXCEPT the salary model and the salary amount
-- (those two are ignored here, whatever is sent). Name, category, department,
-- WhatsApp, Gmail, payment method, bank, branch and account number can change.
--  * A new category gives the teacher the Teacher ID of that category.
--  * A new Gmail hands the Teacher ID over exactly as in Security: the old
--    Google account is unlinked and signed out.
-- Returns { id } (the Teacher ID after the change).
drop function if exists public.staff_update_teacher(text, jsonb);
create function public.staff_update_teacher(p_id text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tid text := public.norm_teacher_id(p_id);
  cur public.portal_teachers;
  v jsonb := '{}'::jsonb; x text; e text; used text; old text; k text; r jsonb;
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  select * into cur from public.portal_teachers where id = tid;
  if not found then raise exception 'Teacher not found.'; end if;
  if p_patch ? 'name' then
    x := btrim(coalesce(p_patch ->> 'name', ''));
    if x = '' or char_length(x) > 120 then raise exception 'Enter the teacher''s name.'; end if;
    v := v || jsonb_build_object('name', x);
  end if;
  if p_patch ? 'whatsapp' then
    x := btrim(coalesce(p_patch ->> 'whatsapp', ''));
    if char_length(x) > 40 then raise exception 'That WhatsApp number is too long.'; end if;
    v := v || jsonb_build_object('whatsapp', case when x = '' then 'N/A' else x end);
  end if;
  if p_patch ? 'department' then
    x := btrim(coalesce(p_patch ->> 'department', ''));
    if char_length(x) > 60 then raise exception 'That department name is too long.'; end if;
    v := v || jsonb_build_object('department', x);
  end if;
  if p_patch ? 'category' and public.teacher_cat_letter(p_patch ->> 'category') is not null then
    v := v || jsonb_build_object('category', p_patch ->> 'category');
  end if;
  -- how the teacher is paid (not how much)
  foreach k in array array['method', 'bankName', 'branchName', 'account'] loop
    if p_patch ? k then
      x := btrim(coalesce(p_patch ->> k, ''));
      if char_length(x) > 120 then raise exception 'That value is too long.'; end if;
      v := v || jsonb_build_object(k, x);
    end if;
  end loop;
  -- bank details are stored encrypted: send all three together so none is lost
  if v ?| array['account', 'bankName', 'branchName'] and cur.bank_enc is not null then
    v := (extensions.pgp_sym_decrypt(cur.bank_enc, public.qit_data_key())::jsonb) || v;
  end if;

  -- Gmail: same rules and same hand-over as Security -> change a teacher's Gmail
  if p_patch ? 'email' then
    e := nullif(lower(btrim(coalesce(p_patch ->> 'email', ''))), '');
    old := nullif(lower(coalesce(cur.data ->> 'email', '')), '');
    if e is distinct from old then
      if e is not null then
        if not public.is_gmail(e) then raise exception 'Enter a Gmail address (…@gmail.com).'; end if;
        used := public.gmail_in_use(e);
        if used is not null and used <> 'teacher ' || tid then raise exception '% is already used by a % account.', e, used; end if;
      end if;
      perform set_config('qit.keep_password', 'on', true);
      delete from auth.sessions where user_id in (select user_id from public.teacher_profiles where teacher_id = tid
        and public.gmail_key(email) is distinct from public.gmail_key(coalesce(e, '')));
      delete from public.teacher_profiles where teacher_id = tid and public.gmail_key(email) is distinct from public.gmail_key(coalesce(e, ''));
      update public.teacher_logins set active_session = null where teacher_id = tid;
      update public.portal_teachers set data = case when e is null then data - 'email' else data || jsonb_build_object('email', e) end where id = tid;
      perform public.log_security(case when e is null then 'gmail_removed' else 'gmail_changed' end, tid, coalesce(old, '(none)') || ' -> ' || coalesce(e, '(none)'));
    end if;
  end if;

  if v <> '{}'::jsonb then
    update public.portal_teachers set data = data || v, updated_at = now() where id = tid;
  end if;
  -- the Teacher ID follows the category (QIT-R… / QIT-M… / QIT-F…)
  if v ? 'category' and not (public.is_category_id(tid) and substring(tid from 5 for 1) = public.teacher_cat_letter(v ->> 'category')) then
    r := public.change_teacher_id_core(tid, v ->> 'category');
    tid := coalesce(r ->> 'teacherId', tid);
  end if;
  return jsonb_build_object('id', tid);
end $$;
revoke all on function public.staff_update_teacher(text, jsonb) from public, anon;
grant execute on function public.staff_update_teacher(text, jsonb) to authenticated;

-- Junior Admins now also read how a teacher is paid (method, bank, branch,
-- account number). Salary model and salary amounts stay hidden from them.
create or replace function public.staff_portal_data()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare k text := public.qit_data_key();
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  return jsonb_build_object(
    'teachers', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.data ->> 'name', 'category', coalesce(t.data ->> 'category', ''),
        'department', coalesce(t.data ->> 'department', ''), 'whatsapp', coalesce(t.data ->> 'whatsapp', ''),
        'email', coalesce(t.data ->> 'email', ''), 'status', coalesce(t.data ->> 'status', 'Active'),
        'salaryType', 'Per-Student', 'packageAmount', 0, 'method', coalesce(t.data ->> 'method', ''))
        || coalesce(case when t.bank_enc is not null then extensions.pgp_sym_decrypt(t.bank_enc, k)::jsonb end,
                    jsonb_build_object('account', '', 'bankName', '', 'branchName', '')) order by t.id)
      from public.portal_teachers t), '[]'::jsonb),
    'students', coalesce((select jsonb_agg((s.data - 'cut') || jsonb_build_object('id', s.id, 'cut', 0) order by s.id)
      from public.portal_students s), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(r.data || jsonb_build_object('id', r.id) order by r.created_at desc)
      from public.portal_reports r), '[]'::jsonb),
    'payments', '[]'::jsonb);
end $$;

-- v145: Junior Admin PIN -----------------------------------------------------
-- The PIN step after Google. The first time (no PIN yet) the PIN typed becomes
-- the PIN. Returns { ok } or { ok: false, error: wrong | too_many | not_junior | bad_pin, left, minutes }.
create or replace function public.junior_unlock(p_pin text, p_device text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare sid uuid := public.current_session_id(); g text := public.google_email(); h text; fails int; last_fail timestamptz;
begin
  if not public.is_junior_gmail() then return jsonb_build_object('ok', false, 'error', 'not_junior'); end if;
  if sid is null then return jsonb_build_object('ok', false, 'error', 'session'); end if;
  select count(*), max(at) into fails, last_fail from public.security_events
    where kind = 'bad_junior_pin' and at > now() - interval '15 minutes' and user_id = auth.uid();
  if fails >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many',
      'minutes', greatest(1, ceil(extract(epoch from (last_fail + interval '15 minutes' - now())) / 60)));
  end if;
  -- the password an Executive set comes first; otherwise this Junior Admin's own PIN
  select hash into h from public.junior_password where id = 1;
  if h is null then select hash into h from public.junior_secrets where public.gmail_key(email) = public.gmail_key(g); end if;
  if h is null then
    if coalesce(p_pin, '') !~ '^[0-9]{6}$' then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
    insert into public.junior_secrets (email, hash) values (lower(g), extensions.crypt(p_pin, extensions.gen_salt('bf', 10)));
    perform public.log_security('junior_pin_set', null, 'Junior Admin chose a PIN', p_device);
  elsif h <> extensions.crypt(coalesce(p_pin, ''), h) then
    perform public.log_security('bad_junior_pin', null, 'Wrong Junior Admin PIN', p_device);
    return jsonb_build_object('ok', false, 'error', 'wrong', 'left', greatest(0, 4 - fails));
  end if;
  delete from public.junior_sessions js where not exists (select 1 from auth.sessions ss where ss.id = js.session_id);
  insert into public.junior_sessions (session_id, email, device) values (sid, g, left(p_device, 160))
  on conflict (session_id) do update set email = excluded.email, device = excluded.device, created_at = now();
  perform public.log_security('junior_signed_in', null, 'Junior Admin', p_device);
  return jsonb_build_object('ok', true);
end $$;

-- Junior Admin "Sign out": this device needs the PIN again (Google stays)
create or replace function public.junior_sign_out()
returns void language sql security definer set search_path = public as $$
  delete from public.junior_sessions where session_id = public.current_session_id();
$$;

-- Executives: a Junior Admin forgot the PIN. They choose a new one at the next sign-in.
create or replace function public.admin_reset_junior_pin(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an Executive can do this.'; end if;
  delete from public.junior_secrets where public.gmail_key(email) = public.gmail_key(p_email);
  delete from public.junior_sessions where public.gmail_key(email) = public.gmail_key(p_email);
  perform public.log_security('junior_pin_reset', null, lower(p_email));
end $$;
-- Executives: set or change the Junior Admin password (6 to 64 characters; 6 to 8
-- digits make it a PIN). Every Junior Admin device must enter it again.
create or replace function public.admin_set_junior_password(p_new text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an Executive can do this.'; end if;
  if char_length(coalesce(p_new, '')) not between 6 and 64 then raise exception 'The password must be 6 to 64 characters.'; end if;
  insert into public.junior_password (id, hash, pin_length, changed_by, changed_at)
  values (1, extensions.crypt(p_new, extensions.gen_salt('bf', 10)), case when p_new ~ '^[0-9]{6,8}$' then char_length(p_new) else 0 end, public.google_email(), now())
  on conflict (id) do update set hash = excluded.hash, pin_length = excluded.pin_length, changed_by = excluded.changed_by, changed_at = now();
  delete from public.junior_sessions where true; -- (Supabase refuses a DELETE without WHERE)
  perform public.log_security('junior_password_changed', null, null);
end $$;
create or replace function public.junior_password_info()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_admin() then null else
    coalesce((select jsonb_build_object('set', true, 'changedAt', changed_at, 'changedBy', changed_by, 'pin', pin_length > 0) from public.junior_password where id = 1), jsonb_build_object('set', false)) end;
$$;
revoke all on function public.admin_set_junior_password(text), public.junior_password_info() from public, anon;
grant execute on function public.admin_set_junior_password(text), public.junior_password_info() to authenticated;
revoke all on function public.junior_unlock(text, text), public.junior_sign_out(), public.admin_reset_junior_pin(text), public.is_junior_gmail() from public, anon;
grant execute on function public.junior_unlock(text, text), public.junior_sign_out(), public.admin_reset_junior_pin(text), public.is_junior_gmail() to authenticated;


-- 7s. v149: Teacher Dashboard ------------------------------------------------
-- Recovery classes: this month's are counted at once; a recovery class for an
-- earlier month waits for an Executive's approval (approval = 'pending').
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'daily_attendance_approval_chk') then
    alter table public.daily_attendance add constraint daily_attendance_approval_chk check (approval is null or approval in ('pending', 'approved', 'rejected'));
  end if;
end $$;
create or replace function public.daily_attendance_recovery_approval()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.is_recovery and current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.approval := case when new.day < date_trunc('month', public.bd_today())::date then 'pending' end;
  elsif tg_op = 'INSERT' and not new.is_recovery then
    new.approval := null;
  end if;
  return new;
end $$;
drop trigger if exists daily_attendance_recovery_approval on public.daily_attendance;
create trigger daily_attendance_recovery_approval before insert on public.daily_attendance
  for each row execute function public.daily_attendance_recovery_approval();
-- counted = everything except recovery classes still waiting or refused
create or replace function public.attendance_counts(a public.daily_attendance)
returns boolean language sql immutable as $$ select coalesce(a.approval, 'approved') = 'approved' $$;

-- Executives: approve or refuse a recovery class of an earlier month
create or replace function public.admin_set_recovery_approval(p_id uuid, p_approve boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only Executives can approve recovery classes.'; end if;
  update public.daily_attendance set approval = case when p_approve then 'approved' else 'rejected' end where id = p_id and is_recovery;
  return found;
end $$;
revoke all on function public.admin_set_recovery_approval(uuid, boolean) from public, anon;
grant execute on function public.admin_set_recovery_approval(uuid, boolean) to authenticated;

-- Monthly report: Bangla / English Medium and the date classes started
alter table public.monthly_reports add column if not exists medium text;
alter table public.monthly_reports add column if not exists class_start date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'monthly_reports_medium_chk') then
    alter table public.monthly_reports add constraint monthly_reports_medium_chk check (medium is null or medium in ('Bangla Medium', 'English Medium'));
  end if;
end $$;

-- A teacher removes a student: it goes to the Delete Request List; an
-- Executive confirms (the student is deleted) or refuses (the student comes back)
create or replace function public.teacher_request_delete(p_student_id text, p_reason text default null, p_teacher_id text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare tid text := public.resolve_teacher(p_teacher_id); cur public.portal_students;
begin
  select * into cur from public.portal_students where id = p_student_id;
  if not found or cur.teacher_id is distinct from tid then raise exception 'Not allowed.'; end if;
  update public.portal_students set data = data || jsonb_build_object('deleteRequest', jsonb_build_object(
      'at', now(), 'teacherId', tid, 'reason', nullif(left(btrim(coalesce(p_reason, '')), 300), ''),
      'by', case when public.is_admin() then 'office' else 'teacher' end)), updated_at = now()
    where id = p_student_id;
  return true;
end $$;
create or replace function public.teacher_cancel_delete(p_student_id text, p_teacher_id text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare tid text := public.resolve_teacher(p_teacher_id); cur public.portal_students;
begin
  select * into cur from public.portal_students where id = p_student_id;
  if not found or cur.teacher_id is distinct from tid then raise exception 'Not allowed.'; end if;
  update public.portal_students set data = data - 'deleteRequest', updated_at = now() where id = p_student_id;
  return true;
end $$;
create or replace function public.admin_resolve_delete(p_student_id text, p_approve boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only Executives can confirm a delete request.'; end if;
  if p_approve then
    delete from public.class_schedules where student_id = p_student_id;
    delete from public.portal_students where id = p_student_id;
  else
    update public.portal_students set data = data - 'deleteRequest', updated_at = now() where id = p_student_id;
  end if;
  return found;
end $$;
revoke all on function public.teacher_request_delete(text, text, text), public.teacher_cancel_delete(text, text), public.admin_resolve_delete(text, boolean) from public, anon;
grant execute on function public.teacher_request_delete(text, text, text), public.teacher_cancel_delete(text, text), public.admin_resolve_delete(text, boolean) to authenticated;


-- 7t. v149: students with the same WhatsApp number get Student IDs one after
-- another (brothers / sisters: QIT-S010, QIT-S011 …). The order otherwise stays
-- as it is. A Student ID change moves everything: class times, attendance,
-- reports and progress reports.
create or replace function public.rename_student_core(p_old text, p_new text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_old = p_new then return; end if;
  update public.portal_students set id = p_new, data = data || jsonb_build_object('id', p_new), updated_at = now() where id = p_old;
  update public.class_schedules set student_id = p_new where student_id = p_old;
  update public.daily_attendance set student_id = p_new where student_id = p_old;
  update public.monthly_reports set student_id = p_new where student_id = p_old;
  update public.portal_reports set data = data || jsonb_build_object('studentId', p_new) where data ->> 'studentId' = p_old;
end $$;
revoke all on function public.rename_student_core(text, text) from public, anon, authenticated;

-- The new order: [{ oldId, newId, name, phone }] for every student whose ID changes
create or replace function public.student_renumber_plan()
returns table (old_id text, new_id text) language plpgsql stable security definer set search_path = public as $$
declare r record; g record; k int := 0; placed text[] := '{}'; keys text[]; nums int[];
begin
  -- the same set of numbers is kept (only the order changes), so an ID never
  -- takes over the history of a deleted student
  select array_agg(n order by n) into nums from (select substring(id from '([0-9]+)$')::int n from public.portal_students where id ~ '^QIT-S[0-9]+$') x;
  for r in select id, public.student_phone_keys(data ->> 'phone') as pk from public.portal_students
           where id ~ '^QIT-S[0-9]+$' order by substring(id from '([0-9]+)$')::int loop
    continue when r.id = any(placed);
    k := k + 1; placed := placed || r.id;
    if r.id <> 'QIT-S' || lpad(nums[k]::text, 3, '0') then old_id := r.id; new_id := 'QIT-S' || lpad(nums[k]::text, 3, '0'); return next; end if;
    keys := array(select x from unnest(r.pk) x where char_length(x) >= 7);
    continue when cardinality(keys) = 0;
    -- everyone later with one of these numbers comes right after
    for g in select id from public.portal_students
             where id ~ '^QIT-S[0-9]+$' and not (id = any(placed)) and public.student_phone_keys(data ->> 'phone') && keys
             order by substring(id from '([0-9]+)$')::int loop
      k := k + 1; placed := placed || g.id;
      if g.id <> 'QIT-S' || lpad(nums[k]::text, 3, '0') then old_id := g.id; new_id := 'QIT-S' || lpad(nums[k]::text, 3, '0'); return next; end if;
    end loop;
  end loop;
end $$;
revoke all on function public.student_renumber_plan() from public, anon, authenticated;

create or replace function public.renumber_students_core()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; res jsonb := '[]'::jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('qit_student_id'));
  create temp table if not exists qit_renum (old_id text, new_id text) on commit drop;
  delete from qit_renum where true;
  insert into qit_renum select * from public.student_renumber_plan();
  -- two steps, so no ID is ever used twice in between
  for r in select * from qit_renum loop perform public.rename_student_core(r.old_id, 'TMP-' || r.old_id); end loop;
  for r in select * from qit_renum loop
    perform public.rename_student_core('TMP-' || r.old_id, r.new_id);
    res := res || jsonb_build_array(jsonb_build_object('oldId', r.old_id, 'newId', r.new_id));
  end loop;
  return res;
end $$;
revoke all on function public.renumber_students_core() from public, anon, authenticated;

create or replace function public.admin_student_renumber_plan()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only Executives can change Student IDs.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('oldId', p.old_id, 'newId', p.new_id,
      'name', s.data ->> 'name', 'phone', s.data ->> 'phone'))
    from public.student_renumber_plan() p join public.portal_students s on s.id = p.old_id), '[]'::jsonb);
end $$;
create or replace function public.admin_renumber_students()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  -- Junior Admins too: it runs by itself after they add a brother / sister
  if not public.is_staff() then raise exception 'Only the office can change Student IDs.'; end if;
  return public.renumber_students_core();
end $$;
revoke all on function public.admin_student_renumber_plan(), public.admin_renumber_students() from public, anon;
grant execute on function public.admin_student_renumber_plan(), public.admin_renumber_students() to authenticated;

-- v149: one-time switch to the new automatic passwords (Residential 1010…,
-- Male 2020…, Female 3030…). Each teacher's old password opens the dashboard
-- once more; then a notice shows the new password (always visible there).
create table if not exists public.qit_migrations (key text primary key, done_at timestamptz not null default now());
alter table public.qit_migrations enable row level security;
do $$
declare r record;
begin
  if exists (select 1 from public.qit_migrations where key = 'v149_passwords') then return; end if;
  for r in select l.teacher_id from public.teacher_logins l join public.portal_teachers t on t.id = l.teacher_id where not l.disabled loop
    perform public.rotate_teacher_password(r.teacher_id, public.teacher_default_password(r.teacher_id), null, 'system (v149)');
  end loop;
  insert into public.qit_migrations (key) values ('v149_passwords');
end $$;

-- The website checks this number and warns the office when this file has not
-- been run for the version that is live.
-- v150: keep what each teacher may still know (their first password, the
-- earlier password and ID), so the first sign-in with them works
do $$
begin
  if exists (select 1 from public.qit_migrations where key = 'v150_old_logins') then return; end if;
  insert into public.teacher_old_logins (teacher_id, old_id, pw_hash)
    select l.teacher_id, l.old_teacher_id, l.old_password_hash from public.teacher_logins l
    where l.old_password_hash is not null or l.old_teacher_id is not null;
  insert into public.teacher_old_logins (teacher_id, pw_hash)
    select l.teacher_id, extensions.crypt(l.initial_password, extensions.gen_salt('bf')) from public.teacher_logins l
    where nullif(l.initial_password, '') is not null;
  insert into public.qit_migrations (key) values ('v150_old_logins');
end $$;

-- =====================================================================
-- v153: notifications for teachers (in the dashboard + on their phone)
-- Office actions write a row in teacher_alerts (by triggers below). The
-- dashboard shows them; the website's push function sends each new one to the
-- teacher's phone (Web Push) — Netlify needs VAPID keys and PUSH_SECRET, and
-- this database needs the same secret: select public.set_push_secret('...');
-- Changes made from the SQL editor or imports (nobody signed in) send nothing.
-- =====================================================================
create table if not exists public.teacher_alerts (
  id bigserial primary key,
  teacher_id text not null,
  kind text not null default 'message',
  title text not null,
  body text,
  url text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz
);
create index if not exists teacher_alerts_tid on public.teacher_alerts (teacher_id, created_at desc);
create index if not exists teacher_alerts_unsent on public.teacher_alerts (created_at) where sent_at is null;
alter table public.teacher_alerts enable row level security;
drop policy if exists "Teachers read their alerts" on public.teacher_alerts;
create policy "Teachers read their alerts" on public.teacher_alerts for select to authenticated
  using (teacher_id = (select public.my_teacher_id()) or (select public.is_staff()));
revoke insert, update, delete on public.teacher_alerts from anon, authenticated;

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  teacher_id text not null,
  user_id uuid default auth.uid(),
  subscription jsonb not null,
  device text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_tid on public.push_subscriptions (teacher_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create table if not exists public.push_config (id int primary key default 1 check (id = 1), secret_hash text);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- run once in the SQL editor with the same PUSH_SECRET as in Netlify
create or replace function public.set_push_secret(p_secret text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Not allowed.'; end if;
  if char_length(coalesce(p_secret, '')) < 16 then raise exception 'The secret must be at least 16 characters.'; end if;
  insert into public.push_config (id, secret_hash) values (1, extensions.crypt(p_secret, extensions.gen_salt('bf')))
    on conflict (id) do update set secret_hash = excluded.secret_hash;
  return 'Push secret saved.';
end $$;
revoke all on function public.set_push_secret(text) from public, anon;
grant execute on function public.set_push_secret(text) to authenticated;

create or replace function public.push_secret_ok(p_secret text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.push_config c where c.secret_hash is not null and c.secret_hash = extensions.crypt(coalesce(p_secret, ''), c.secret_hash));
$$;
revoke all on function public.push_secret_ok(text) from public, anon, authenticated;

-- one alert (only when a signed-in office member did it)
create or replace function public.add_teacher_alert(p_tid text, p_kind text, p_title text, p_body text, p_url text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_tid is null or p_tid = '' then return; end if;
  if coalesce(current_setting('qit.no_alerts', true), '') = 'on' then return; end if;
  if auth.uid() is null or not public.is_staff() then return; end if;
  insert into public.teacher_alerts (teacher_id, kind, title, body, url)
    values (p_tid, coalesce(p_kind, 'message'), left(p_title, 140), left(p_body, 500), p_url);
end $$;
revoke all on function public.add_teacher_alert(text, text, text, text, text) from public, anon, authenticated;

-- teacher: this phone receives notifications
create or replace function public.teacher_push_subscribe(p_sub jsonb, p_device text default null, p_teacher_id text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare tid text := coalesce(public.my_teacher_id(), case when public.is_staff() then p_teacher_id end);
begin
  if tid is null then raise exception 'Not allowed.'; end if;
  if coalesce(p_sub ->> 'endpoint', '') !~ '^https://' then raise exception 'Not a push subscription.'; end if;
  insert into public.push_subscriptions (endpoint, teacher_id, user_id, subscription, device)
    values (p_sub ->> 'endpoint', tid, auth.uid(), p_sub, left(p_device, 120))
    on conflict (endpoint) do update set teacher_id = excluded.teacher_id, user_id = excluded.user_id, subscription = excluded.subscription, device = excluded.device;
  return true;
end $$;
create or replace function public.teacher_push_unsubscribe(p_endpoint text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint and (user_id = auth.uid() or teacher_id = public.my_teacher_id());
  return true;
end $$;
create or replace function public.my_alerts_read(p_teacher_id text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare tid text := coalesce(public.my_teacher_id(), case when public.is_staff() then p_teacher_id end);
begin
  update public.teacher_alerts set read_at = now() where teacher_id = tid and read_at is null;
  return true;
end $$;
-- office: a message to one, several or all teachers (null = all active teachers)
create or replace function public.staff_message_teachers(p_teacher_ids text[], p_title text, p_body text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  if char_length(btrim(coalesce(p_title, ''))) < 2 then raise exception 'Write a title.'; end if;
  insert into public.teacher_alerts (teacher_id, kind, title, body, url)
    select t.id, 'message', left(btrim(p_title), 140), left(btrim(coalesce(p_body, '')), 6000), '/teacher?alerts=1'
    from public.portal_teachers t
    where (p_teacher_ids is null or t.id = any(p_teacher_ids))
      and exists (select 1 from public.teacher_logins l where l.teacher_id = t.id and not l.disabled);
  get diagnostics n = row_count;
  return n;
end $$;
-- office: which teachers have phone notifications on (devices per teacher)
create or replace function public.staff_push_overview()
returns table (teacher_id text, devices int, last_on timestamptz) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  return query select p.teacher_id, count(*)::int, max(p.created_at) from public.push_subscriptions p group by p.teacher_id;
end $$;
revoke all on function public.staff_push_overview() from public, anon;
grant execute on function public.staff_push_overview() to authenticated;
-- the push function: take the new alerts (with the phones to send to)
create or replace function public.push_take(p_secret text, p_limit int default 200)
returns jsonb language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  if not public.push_secret_ok(p_secret) then raise exception 'Not allowed.'; end if;
  with picked as (
    select a.id from public.teacher_alerts a
    where a.sent_at is null and a.created_at > now() - interval '2 days'
    order by a.id limit greatest(1, least(coalesce(p_limit, 200), 500))
    for update skip locked
  ), marked as (
    update public.teacher_alerts a set sent_at = now() from picked where a.id = picked.id
    returning a.id, a.teacher_id, a.kind, a.title, a.body, a.url
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'body', m.body, 'url', m.url, 'kind', m.kind,
      'subs', coalesce((select jsonb_agg(p.subscription) from public.push_subscriptions p where p.teacher_id = m.teacher_id), '[]'::jsonb))), '[]'::jsonb)
    into out from marked m;
  return out;
end $$;
create or replace function public.push_drop(p_secret text, p_endpoints text[])
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.push_secret_ok(p_secret) then raise exception 'Not allowed.'; end if;
  delete from public.push_subscriptions where endpoint = any(p_endpoints);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.teacher_push_subscribe(jsonb, text, text), public.teacher_push_unsubscribe(text), public.my_alerts_read(text),
  public.staff_message_teachers(text[], text, text) from public, anon;
grant execute on function public.teacher_push_subscribe(jsonb, text, text), public.teacher_push_unsubscribe(text), public.my_alerts_read(text),
  public.staff_message_teachers(text[], text, text) to authenticated;
revoke all on function public.push_take(text, int), public.push_drop(text, text[]) from public;
grant execute on function public.push_take(text, int), public.push_drop(text, text[]) to anon, authenticated;

-- what the office does → an alert for the teacher
create or replace function public.alerts_monthly_reports()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.review_status is distinct from old.review_status and new.review_status in ('needs_changes', 'reviewed') then
    perform public.add_teacher_alert(new.teacher_id, 'report',
      case when new.review_status = 'needs_changes' then 'Report sent back — please correct' else 'Report reviewed ✓' end,
      coalesce(new.student_name, new.student_id) || ' · ' || new.month || ' ' || new.year || case when new.review_status = 'needs_changes' and nullif(btrim(coalesce(new.review_note, '')), '') is not null then ' — ' || new.review_note else '' end,
      '/teacher/report?student=' || new.student_id || '&month=' || new.month || '&year=' || new.year);
  end if;
  return new;
end $$;
drop trigger if exists alerts_monthly_reports on public.monthly_reports;
create trigger alerts_monthly_reports after update on public.monthly_reports for each row execute function public.alerts_monthly_reports();

create or replace function public.alerts_teacher_inquiries()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.status is distinct from old.status and new.status = 'resolved') or (new.admin_reply is distinct from old.admin_reply and nullif(btrim(coalesce(new.admin_reply, '')), '') is not null) then
    perform public.add_teacher_alert(new.teacher_id, 'request', 'The office answered your request', new.subject || coalesce(' — ' || nullif(btrim(new.admin_reply), ''), ''), '/teacher/support');
  end if;
  return new;
end $$;
drop trigger if exists alerts_teacher_inquiries on public.teacher_inquiries;
create trigger alerts_teacher_inquiries after update on public.teacher_inquiries for each row execute function public.alerts_teacher_inquiries();

create or replace function public.alerts_portal_students()
returns trigger language plpgsql security definer set search_path = public as $$
declare nm text := coalesce(new.data ->> 'name', new.id); ct text := coalesce(nullif(new.data ->> 'classTime', ''), '');
begin
  if tg_op = 'INSERT' then
    if new.teacher_id is not null and coalesce(new.data ->> 'addedByTeacher', '') <> 'true' then
      perform public.add_teacher_alert(new.teacher_id, 'student', 'New student: ' || nm, 'Assigned to you by the office' || coalesce(' · ' || nullif(new.data ->> 'medium', ''), '') || case when ct <> '' then ' · ' || ct else '' end, '/teacher');
    end if;
    return new;
  end if;
  if new.teacher_id is distinct from old.teacher_id then
    perform public.add_teacher_alert(new.teacher_id, 'student', 'New student: ' || nm, 'Assigned to you by the office' || coalesce(' · ' || nullif(new.data ->> 'medium', ''), ''), '/teacher');
    perform public.add_teacher_alert(old.teacher_id, 'student', nm || ' moved to another teacher', 'The office moved this student', '/teacher');
  elsif coalesce(new.data ->> 'status', 'Active') is distinct from coalesce(old.data ->> 'status', 'Active') then
    perform public.add_teacher_alert(new.teacher_id, 'student', nm || ' is now ' || coalesce(new.data ->> 'status', 'Active'),
      case coalesce(new.data ->> 'status', 'Active') when 'Hold' then 'Classes are on hold' when 'Inactive' then 'Classes have stopped' else 'Classes continue' end, '/teacher');
  end if;
  return new;
end $$;
drop trigger if exists alerts_portal_students on public.portal_students;
create trigger alerts_portal_students after insert or update on public.portal_students for each row execute function public.alerts_portal_students();

create or replace function public.alerts_portal_payments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.teacher_id is not null then
    perform public.add_teacher_alert(new.teacher_id, 'salary', 'Salary disbursed', coalesce(new.data ->> 'month', '') || ' ' || coalesce(new.data ->> 'year', '') || ' · ' || coalesce(new.data ->> 'amount', '') || ' BDT', '/teacher/salary');
  end if;
  return new;
end $$;
drop trigger if exists alerts_portal_payments on public.portal_payments;
create trigger alerts_portal_payments after insert on public.portal_payments for each row execute function public.alerts_portal_payments();

create or replace function public.alerts_teacher_logins()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.login_notice is not null and new.login_notice is distinct from old.login_notice then
    perform public.add_teacher_alert(new.teacher_id, 'login', 'Your Teacher ID / password changed', 'Open the dashboard to see the new one', '/teacher');
  end if;
  return new;
end $$;
drop trigger if exists alerts_teacher_logins on public.teacher_logins;
create trigger alerts_teacher_logins after update on public.teacher_logins for each row execute function public.alerts_teacher_logins();

create or replace function public.alerts_daily_attendance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.approval is distinct from old.approval and new.approval in ('approved', 'rejected') then
    perform public.add_teacher_alert(new.teacher_id, 'recovery', case when new.approval = 'approved' then 'Recovery class approved' else 'Recovery class not approved' end,
      new.student_id || ' · ' || new.day, '/teacher/attendance');
  end if;
  return new;
end $$;
drop trigger if exists alerts_daily_attendance on public.daily_attendance;
create trigger alerts_daily_attendance after update on public.daily_attendance for each row execute function public.alerts_daily_attendance();

create or replace function public.alerts_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.add_teacher_alert(new.teacher_id, 'points', case when new.points >= 0 then '+' else '' end || new.points || ' points', coalesce(nullif(new.reason, ''), 'From the office') || ' · ' || new.month || ' ' || new.year, '/teacher/progress');
  return new;
end $$;
drop trigger if exists alerts_points on public.points_adjustments;
create trigger alerts_points after insert on public.points_adjustments for each row execute function public.alerts_points();

do $$ begin
  begin alter publication supabase_realtime add table public.teacher_alerts; exception when duplicate_object or undefined_object then null; end;
end $$;


-- =====================================================================
-- v154: phone notifications for the office too (Executives / Junior Admins),
-- even when Chrome is closed; and no delay: the database itself asks the
-- website to send each new notification at once (pg_net), the website's
-- 1-minute job stays as a backup.
-- =====================================================================
alter table public.teacher_alerts alter column teacher_id drop not null;
alter table public.teacher_alerts add column if not exists audience text check (audience is null or audience in ('exec', 'staff'));
alter table public.push_subscriptions alter column teacher_id drop not null;
alter table public.push_subscriptions add column if not exists audience text not null default 'teacher';
alter table public.push_subscriptions add column if not exists email text;
alter table public.push_config add column if not exists site_url text;
create index if not exists teacher_alerts_aud on public.teacher_alerts (audience, created_at desc) where audience is not null;

drop policy if exists "Teachers read their alerts" on public.teacher_alerts;
create policy "Teachers read their alerts" on public.teacher_alerts for select to authenticated
  using ((teacher_id is not null and teacher_id = (select public.my_teacher_id()))
    or ((select public.is_staff()) and (audience is distinct from 'exec' or (select public.is_admin()))));

do $$ begin
  begin create extension if not exists pg_net; exception when others then raise notice 'pg_net not available: the 1-minute job sends notifications'; end;
end $$;

-- the website address the database calls (default: the live site)
create or replace function public.set_push_secret(p_secret text, p_site_url text default null)
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Not allowed.'; end if;
  if char_length(coalesce(p_secret, '')) < 16 then raise exception 'The secret must be at least 16 characters.'; end if;
  insert into public.push_config (id, secret_hash, site_url) values (1, extensions.crypt(p_secret, extensions.gen_salt('bf')), nullif(btrim(p_site_url), ''))
    on conflict (id) do update set secret_hash = excluded.secret_hash, site_url = coalesce(excluded.site_url, public.push_config.site_url);
  return 'Push secret saved.';
end $$;
drop function if exists public.set_push_secret(text);
revoke all on function public.set_push_secret(text, text) from public, anon;
grant execute on function public.set_push_secret(text, text) to authenticated;

-- new notifications → ask the website to send them now (no waiting)
create or replace function public.push_ping()
returns trigger language plpgsql security definer set search_path = public as $$
declare site text;
begin
  select coalesce(nullif(btrim(c.site_url), ''), 'https://quraninternational.academy') into site from public.push_config c where c.id = 1 and c.secret_hash is not null;
  if site is null then return null; end if;
  begin
    execute 'select net.http_get(url := $1, timeout_milliseconds := 10000)' using rtrim(site, '/') || '/.netlify/functions/push?send=1';
  exception when others then null; -- pg_net missing: the 1-minute job sends them
  end;
  return null;
end $$;
drop trigger if exists push_ping on public.teacher_alerts;
create trigger push_ping after insert on public.teacher_alerts for each statement execute function public.push_ping();

-- one notification for the office ('exec' = Executives, 'staff' = Executives + Junior Admins).
-- Only for changes made through the website (not the SQL editor or imports).
create or replace function public.add_staff_alert(p_aud text, p_kind text, p_title text, p_body text, p_url text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('qit.no_alerts', true), '') = 'on' then return; end if;
  if coalesce(current_setting('request.jwt.claims', true), '') = '' then return; end if;
  insert into public.teacher_alerts (teacher_id, audience, kind, title, body, url)
    values (null, case when p_aud = 'exec' then 'exec' else 'staff' end, coalesce(p_kind, 'office'), left(p_title, 140), left(p_body, 500), p_url);
end $$;
revoke all on function public.add_staff_alert(text, text, text, text, text) from public, anon, authenticated;

-- office member: this phone / computer receives office notifications
create or replace function public.staff_push_subscribe(p_sub jsonb, p_device text default null)
returns text language plpgsql security definer set search_path = public as $$
declare aud text;
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  if coalesce(p_sub ->> 'endpoint', '') !~ '^https://' then raise exception 'Not a push subscription.'; end if;
  aud := case when public.is_admin() then 'exec' else 'staff' end;
  insert into public.push_subscriptions (endpoint, teacher_id, user_id, subscription, device, audience, email)
    values (p_sub ->> 'endpoint', null, auth.uid(), p_sub, left(p_device, 120), aud, lower(auth.jwt() ->> 'email'))
    on conflict (endpoint) do update set teacher_id = null, user_id = excluded.user_id, subscription = excluded.subscription,
      device = excluded.device, audience = excluded.audience, email = excluded.email;
  return aud;
end $$;
revoke all on function public.staff_push_subscribe(jsonb, text) from public, anon;
grant execute on function public.staff_push_subscribe(jsonb, text) to authenticated;
-- a teacher's phone stays a teacher's phone
create or replace function public.teacher_push_subscribe(p_sub jsonb, p_device text default null, p_teacher_id text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare tid text := coalesce(public.my_teacher_id(), case when public.is_staff() then p_teacher_id end);
begin
  if tid is null then raise exception 'Not allowed.'; end if;
  if coalesce(p_sub ->> 'endpoint', '') !~ '^https://' then raise exception 'Not a push subscription.'; end if;
  insert into public.push_subscriptions (endpoint, teacher_id, user_id, subscription, device, audience, email)
    values (p_sub ->> 'endpoint', tid, auth.uid(), p_sub, left(p_device, 120), 'teacher', null)
    on conflict (endpoint) do update set teacher_id = excluded.teacher_id, user_id = excluded.user_id, subscription = excluded.subscription,
      device = excluded.device, audience = 'teacher', email = null;
  return true;
end $$;

-- the push function: new notifications with the devices to send them to
create or replace function public.push_take(p_secret text, p_limit int default 200)
returns jsonb language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  if not public.push_secret_ok(p_secret) then raise exception 'Not allowed.'; end if;
  with picked as (
    select a.id from public.teacher_alerts a
    where a.sent_at is null and a.created_at > now() - interval '2 days'
    order by a.id limit greatest(1, least(coalesce(p_limit, 200), 500))
    for update skip locked
  ), marked as (
    update public.teacher_alerts a set sent_at = now() from picked where a.id = picked.id
    returning a.id, a.teacher_id, a.audience, a.kind, a.title, a.body, a.url
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'body', m.body, 'url', m.url, 'kind', m.kind, 'audience', m.audience,
      'subs', coalesce((select jsonb_agg(p.subscription) from public.push_subscriptions p
        where (m.audience is null and p.audience = 'teacher' and p.teacher_id = m.teacher_id)
           or (m.audience = 'exec' and p.audience = 'exec')
           or (m.audience = 'staff' and p.audience in ('exec', 'staff'))), '[]'::jsonb))), '[]'::jsonb)
    into out from marked m;
  return out;
end $$;
revoke all on function public.push_take(text, int) from public;
grant execute on function public.push_take(text, int) to anon, authenticated;

-- what teachers and visitors do → a notification for the office
create or replace function public.staff_alerts_inquiries()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.add_staff_alert('exec', 'inquiry', case when new.type = 'trial' then 'New trial class request' else 'New inquiry' end,
    new.name || coalesce(' · ' || nullif(new.course, ''), '') || coalesce(' · ' || nullif(new.phone, ''), ''), '/admin/inquiries');
  return new;
end $$;
drop trigger if exists staff_alerts_inquiries on public.inquiries;
create trigger staff_alerts_inquiries after insert on public.inquiries for each row execute function public.staff_alerts_inquiries();

create or replace function public.staff_alerts_teacher_inquiries()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then return new; end if;
  perform public.add_staff_alert('exec', 'request', 'Teacher request', coalesce(nullif(new.teacher_name, ''), new.teacher_id) || ': ' || new.subject,
    '/admin/portal?tab=support&inquiry=' || new.id);
  return new;
end $$;
drop trigger if exists staff_alerts_teacher_inquiries on public.teacher_inquiries;
create trigger staff_alerts_teacher_inquiries after insert on public.teacher_inquiries for each row execute function public.staff_alerts_teacher_inquiries();

create or replace function public.staff_alerts_reports()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then return new; end if;
  if new.review_status = 'submitted' and (tg_op = 'INSERT' or old.review_status is distinct from 'submitted') then
    perform public.add_staff_alert('staff', 'report', case when tg_op = 'INSERT' then 'New monthly report' else 'Monthly report corrected' end,
      coalesce(new.student_name, new.student_id) || ' · ' || new.month || ' ' || new.year || ' · by ' || coalesce(new.teacher_name, new.teacher_id), '/admin/review?tab=reports');
  end if;
  return new;
end $$;
drop trigger if exists staff_alerts_reports on public.monthly_reports;
create trigger staff_alerts_reports after insert or update on public.monthly_reports for each row execute function public.staff_alerts_reports();

create or replace function public.staff_alerts_attendance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then return new; end if;
  if new.approval = 'pending' and (tg_op = 'INSERT' or old.approval is distinct from 'pending') then
    perform public.add_staff_alert('exec', 'recovery', 'Recovery class needs approval', new.student_id || ' · ' || new.day || ' · ' || new.teacher_id, '/admin/portal?tab=attendance');
  end if;
  return new;
end $$;
drop trigger if exists staff_alerts_attendance on public.daily_attendance;
create trigger staff_alerts_attendance after insert or update on public.daily_attendance for each row execute function public.staff_alerts_attendance();

create or replace function public.staff_alerts_students()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then return new; end if;
  if (new.data -> 'deleteRequest') is not null and jsonb_typeof(new.data -> 'deleteRequest') <> 'null'
     and (tg_op = 'INSERT' or (old.data -> 'deleteRequest') is null or jsonb_typeof(old.data -> 'deleteRequest') = 'null') then
    perform public.add_staff_alert('exec', 'delete', 'Delete request', coalesce(new.data ->> 'name', new.id) || ' · ' || new.id, '/admin/portal?tab=students');
  end if;
  return new;
end $$;
drop trigger if exists staff_alerts_students on public.portal_students;
create trigger staff_alerts_students after insert or update on public.portal_students for each row execute function public.staff_alerts_students();

create or replace function public.staff_alerts_signups()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.add_staff_alert('exec', 'signup', 'New teacher sign-up', new.full_name || ' · ' || new.email, '/admin/portal?tab=teacherDash');
  return new;
end $$;
drop trigger if exists staff_alerts_signups on public.teacher_profiles;
create trigger staff_alerts_signups after insert on public.teacher_profiles for each row execute function public.staff_alerts_signups();


-- =====================================================================
-- v155: the teacher's salary month by month (as the office works it out:
-- students' days, moves, holds, extra responsibilities). The Management
-- Portal saves each month's figure here; the Teacher Dashboard shows it.
-- =====================================================================
create table if not exists public.salary_months (
  teacher_id text not null,
  month text not null,
  year int not null,
  salary numeric not null default 0,
  base numeric not null default 0,
  extra numeric not null default 0,
  extras jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (teacher_id, year, month)
);
alter table public.salary_months enable row level security;
revoke all on public.salary_months from anon, authenticated;

create or replace function public.staff_save_salary_months(p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; r jsonb;
begin
  if not public.is_admin() then raise exception 'Not allowed.'; end if;
  if jsonb_typeof(p_rows) <> 'array' then return 0; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.salary_months (teacher_id, month, year, salary, base, extra, extras, updated_at)
    values (r ->> 'teacherId', r ->> 'month', (r ->> 'year')::int, coalesce((r ->> 'salary')::numeric, 0), coalesce((r ->> 'base')::numeric, 0),
            coalesce((r ->> 'extra')::numeric, 0), coalesce(r -> 'extras', '[]'::jsonb), now())
    on conflict (teacher_id, year, month) do update set salary = excluded.salary, base = excluded.base, extra = excluded.extra, extras = excluded.extras, updated_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.staff_save_salary_months(jsonb) from public, anon;
grant execute on function public.staff_save_salary_months(jsonb) to authenticated;

create or replace function public.teacher_salary(p_teacher_id text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  tid text := public.resolve_teacher(p_teacher_id);
  t public.portal_teachers;
begin
  select * into t from public.portal_teachers where id = tid;
  return jsonb_build_object(
    'salaryType', coalesce(t.data ->> 'salaryType', 'Per-Student'),
    'monthlySalary', case when t.data ->> 'salaryType' = 'Package'
      then coalesce(nullif(t.data ->> 'packageAmount', '')::numeric, 0)
      else coalesce((select sum(coalesce(nullif(s.data ->> 'cut', '')::numeric, 0)) from public.portal_students s
                     where s.teacher_id = tid and public.student_status_of(s.data ->> 'status') = 'Active'), 0) end,
    'since', coalesce(t.created_at, now()),
    'start', '2026-09',
    'months', coalesce((select jsonb_agg(jsonb_build_object('month', m.month, 'year', m.year, 'salary', m.salary, 'base', m.base, 'extra', m.extra, 'extras', m.extras))
      from public.salary_months m where m.teacher_id = tid), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'month', p.data ->> 'month', 'year', p.data ->> 'year',
        'amount', coalesce(nullif(p.data ->> 'amount', '')::numeric, 0), 'date', p.data ->> 'date', 'note', p.data ->> 'note')
        order by p.data ->> 'date' desc)
      from public.portal_payments p where p.teacher_id = tid), '[]'::jsonb));
end $$;


-- v156: a deleted student (e.g. a double entry) leaves no "sent back" report
-- behind on the teacher's dashboard
create or replace function public.reports_of_deleted_student()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.monthly_reports where student_id = old.id and review_status = 'needs_changes';
  return old;
end $$;
drop trigger if exists reports_of_deleted_student on public.portal_students;
create trigger reports_of_deleted_student after delete on public.portal_students for each row execute function public.reports_of_deleted_student();
delete from public.monthly_reports r where r.review_status = 'needs_changes'
  and not exists (select 1 from public.portal_students s where s.id = r.student_id);


-- =====================================================================
-- v157: Academic Counselor — consults students and guardians, keeps exam
-- records, notes problems, contacts teachers (female counselors: the female
-- teachers' students), sends cases to the office and follows students'
-- feedback. Each counselor signs in with their own Gmail + own password (the
-- Executive sets the first one; the counselor then chooses their own).
-- Counselors never see any payment: no fee, teacher share, salary or bank.
-- =====================================================================
create table if not exists public.counselors (
  email text primary key check (email = lower(email)),
  name text not null default '',
  gender text not null default 'male' check (gender in ('male', 'female')),
  pw_hash text,
  must_change boolean not null default true,
  added_by text,
  created_at timestamptz not null default now()
);
alter table public.counselors enable row level security;
revoke all on public.counselors from anon, authenticated;
create table if not exists public.counselor_sessions (
  session_id uuid primary key,
  email text not null,
  device text,
  created_at timestamptz not null default now()
);
alter table public.counselor_sessions enable row level security;
revoke all on public.counselor_sessions from anon, authenticated;

create or replace function public.is_counselor_gmail()
returns boolean language sql stable security definer set search_path = public as $$
  select public.google_email() <> ''
    and exists (select 1 from public.counselors c where public.gmail_key(c.email) = public.gmail_key(public.google_email()));
$$;
create or replace function public.is_counselor()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_counselor_gmail()
    and exists (select 1 from public.counselor_sessions cs
                where cs.session_id = public.current_session_id()
                  and public.gmail_key(cs.email) = public.gmail_key(public.google_email()));
$$;
-- the counselor's side: 'female' works with the female teachers' students
create or replace function public.my_counselor_gender()
returns text language sql stable security definer set search_path = public as $$
  select c.gender from public.counselors c where public.gmail_key(c.email) = public.gmail_key(public.google_email());
$$;
create or replace function public.teacher_is_female(p_tid text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(t.data ->> 'category', '') ilike '%female%' or t.id ilike 'QIT-F%' from public.portal_teachers t where t.id = p_tid), false);
$$;
revoke all on function public.is_counselor_gmail(), public.is_counselor(), public.my_counselor_gender(), public.teacher_is_female(text) from public, anon;
grant execute on function public.is_counselor_gmail(), public.is_counselor(), public.my_counselor_gender(), public.teacher_is_female(text) to authenticated;

create or replace function public.my_access()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  g text := public.google_email();
  p public.teacher_profiles;
  l public.teacher_logins;
  sid uuid := public.current_session_id();
begin
  if auth.uid() is null then return jsonb_build_object('role', 'none'); end if;
  -- An account the office removed is signed out straight away
  if not exists (select 1 from auth.users where id = auth.uid()) then return jsonb_build_object('role', 'none'); end if;
  -- Signed in without Google (e.g. an old Teacher ID or admin password sign-in): no access
  if g = '' then
    return jsonb_build_object('role', 'none', 'reason', 'google_required', 'email', lower(coalesce(auth.jwt() ->> 'email', '')));
  end if;
  if public.is_admin() then return jsonb_build_object('role', 'super', 'email', g); end if;
  -- Executive Gmail, but this device still needs the Executive password
  if public.is_executive_gmail() then return jsonb_build_object('role', 'exec_locked', 'email', g); end if;
  -- v157: Academic Counselor (own Gmail + own password on this device)
  if public.is_counselor() then
    return (select jsonb_build_object('role', 'counselor', 'email', g, 'fullName', c.name, 'gender', c.gender, 'mustChange', c.must_change)
            from public.counselors c where public.gmail_key(c.email) = public.gmail_key(g));
  end if;
  if public.is_counselor_gmail() then return jsonb_build_object('role', 'counselor_locked', 'email', g); end if;
  if public.is_junior() then return jsonb_build_object('role', 'junior', 'email', g); end if;
  -- Junior Admin Gmail, but this device still needs the PIN (hasPin = false: choose one now)
  if public.is_junior_gmail() then
    return jsonb_build_object('role', 'junior_locked', 'email', g,
      'shared', exists (select 1 from public.junior_password),
      'pinLength', coalesce((select pin_length from public.junior_password where id = 1), 0),
      'hasPin', exists (select 1 from public.junior_password)
             or exists (select 1 from public.junior_secrets js where public.gmail_key(js.email) = public.gmail_key(g)));
  end if;
  select * into p from public.teacher_profiles where user_id = auth.uid();
  if found and p.link_status = 'pending' then
    return jsonb_build_object('role', 'pending', 'email', p.email, 'fullName', p.full_name, 'whatsapp', p.whatsapp,
      'claimTeacherId', p.claim_teacher_id,
      'claimName', (select data ->> 'name' from public.portal_teachers where id = p.claim_teacher_id));
  end if;
  if found and public.gmail_key(p.email) = public.gmail_key(g) then
    select * into l from public.teacher_logins where teacher_id = p.teacher_id;
    if l.teacher_id is not null and not l.disabled and exists (select 1 from public.teacher_sessions ts where ts.session_id = sid and ts.user_id = auth.uid()) then
      return jsonb_build_object('role', 'teacher', 'email', p.email, 'teacherId', p.teacher_id, 'fullName', p.full_name,
        'whatsapp', p.whatsapp, 'via', 'google');
    end if;
    return jsonb_build_object('role', 'locked', 'email', p.email, 'fullName', p.full_name, 'teacherId', p.teacher_id,
      'firstTime', p.first_unlock_at is null,
      'off', l.teacher_id is null or l.disabled,
      -- another device has the dashboard open right now
      -- v146: other devices stay open, so there is nothing to warn about
      'elsewhere', false);
  end if;
  if public.is_gmail(g) then return jsonb_build_object('role', 'new', 'email', g); end if;
  return jsonb_build_object('role', 'none', 'email', g);
end $$;

create or replace function public.counselor_unlock(p_password text, p_device text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare sid uuid := public.current_session_id(); g text := public.google_email(); c public.counselors; fails int; last_fail timestamptz;
begin
  if not public.is_counselor_gmail() then return jsonb_build_object('ok', false, 'error', 'not_counselor'); end if;
  if sid is null then return jsonb_build_object('ok', false, 'error', 'session'); end if;
  select count(*), max(at) into fails, last_fail from public.security_events
    where kind = 'bad_counselor_password' and at > now() - interval '15 minutes' and user_id = auth.uid();
  if fails >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many',
      'minutes', greatest(1, ceil(extract(epoch from (last_fail + interval '15 minutes' - now())) / 60)));
  end if;
  select * into c from public.counselors where public.gmail_key(email) = public.gmail_key(g);
  if c.pw_hash is null or c.pw_hash <> extensions.crypt(coalesce(p_password, ''), c.pw_hash) then
    perform public.log_security('bad_counselor_password', null, 'Wrong Academic Counselor password', p_device);
    return jsonb_build_object('ok', false, 'error', 'wrong', 'left', greatest(0, 4 - fails));
  end if;
  delete from public.counselor_sessions cs where not exists (select 1 from auth.sessions ss where ss.id = cs.session_id);
  insert into public.counselor_sessions (session_id, email, device) values (sid, c.email, left(p_device, 160))
  on conflict (session_id) do update set email = excluded.email, device = excluded.device, created_at = now();
  perform public.log_security('counselor_signed_in', null, 'Academic Counselor', p_device);
  return jsonb_build_object('ok', true, 'mustChange', c.must_change);
end $$;
create or replace function public.counselor_set_password(p_new text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_counselor() then raise exception 'Not allowed.'; end if;
  if char_length(coalesce(p_new, '')) not between 6 and 64 then raise exception 'The password must be 6 to 64 characters.'; end if;
  update public.counselors set pw_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)), must_change = false
    where public.gmail_key(email) = public.gmail_key(public.google_email());
  return true;
end $$;
create or replace function public.counselor_sign_out()
returns void language sql security definer set search_path = public as $$
  delete from public.counselor_sessions where session_id = public.current_session_id();
$$;
revoke all on function public.counselor_unlock(text, text), public.counselor_set_password(text), public.counselor_sign_out() from public, anon;
grant execute on function public.counselor_unlock(text, text), public.counselor_set_password(text), public.counselor_sign_out() to authenticated;

-- Executives manage counselors (each Gmail its own password; the first one is set here)
create or replace function public.admin_save_counselor(p_email text, p_name text, p_gender text, p_password text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.is_admin() then raise exception 'Only an Executive can do this.'; end if;
  if not public.is_gmail(e) then raise exception 'Enter a Gmail address (…@gmail.com).'; end if;
  if coalesce(p_gender, '') not in ('male', 'female') then raise exception 'Choose male or female.'; end if;
  if exists (select 1 from public.executive_emails x where public.gmail_key(x.email) = public.gmail_key(e))
     or exists (select 1 from public.staff_roles x where public.gmail_key(x.email) = public.gmail_key(e)) then
    raise exception 'That Gmail is already an Executive or a Junior Admin.';
  end if;
  if not exists (select 1 from public.counselors where email = e) then
    if char_length(coalesce(p_password, '')) not between 6 and 64 then raise exception 'Set a first password (6 to 64 characters).'; end if;
    insert into public.counselors (email, name, gender, pw_hash, must_change, added_by)
      values (e, btrim(coalesce(p_name, '')), p_gender, extensions.crypt(p_password, extensions.gen_salt('bf', 10)), true, public.google_email());
  else
    update public.counselors set name = btrim(coalesce(p_name, name)), gender = p_gender where email = e;
    if p_password is not null and p_password <> '' then
      if char_length(p_password) not between 6 and 64 then raise exception 'The password must be 6 to 64 characters.'; end if;
      update public.counselors set pw_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 10)), must_change = true where email = e;
      delete from public.counselor_sessions where email = e;
    end if;
  end if;
  perform public.log_security('counselor_saved', null, e);
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.admin_remove_counselor(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an Executive can do this.'; end if;
  delete from public.counselor_sessions where public.gmail_key(email) = public.gmail_key(p_email);
  delete from public.counselors where public.gmail_key(email) = public.gmail_key(p_email);
  perform public.log_security('counselor_removed', null, lower(p_email));
end $$;
create or replace function public.admin_list_counselors()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an Executive can do this.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('email', c.email, 'name', c.name, 'gender', c.gender, 'mustChange', c.must_change, 'createdAt', c.created_at,
      'lastSignIn', (select max(cs.created_at) from public.counselor_sessions cs where cs.email = c.email),
      'records', (select count(*) from public.counselor_records r where r.counselor_email = c.email)) order by c.created_at)
    from public.counselors c), '[]'::jsonb);
end $$;
revoke all on function public.admin_save_counselor(text, text, text, text), public.admin_remove_counselor(text), public.admin_list_counselors() from public, anon;
grant execute on function public.admin_save_counselor(text, text, text, text), public.admin_remove_counselor(text), public.admin_list_counselors() to authenticated;

-- the counselor's records: consultations, exams, problems, feedback, teacher contacts, office cases
create table if not exists public.counselor_records (
  id uuid primary key default gen_random_uuid(),
  student_id text,
  teacher_id text,
  kind text not null check (kind in ('consult_student', 'consult_guardian', 'exam', 'problem', 'feedback', 'teacher_contact', 'note')),
  title text not null check (char_length(btrim(title)) between 2 and 200),
  details text check (details is null or char_length(details) <= 5000),
  data jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'in_progress', 'solved', 'office')),
  follow_up date,
  counselor_email text not null default lower(coalesce(public.google_email(), '')),
  counselor_name text,
  office_reply text,
  office_by text,
  office_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists counselor_records_student on public.counselor_records (student_id, created_at desc);
create index if not exists counselor_records_author on public.counselor_records (counselor_email, created_at desc);
alter table public.counselor_records enable row level security;
drop policy if exists "Counselors and Executives read" on public.counselor_records;
create policy "Counselors and Executives read" on public.counselor_records for select to authenticated
  using ((select public.is_admin()) or (select public.is_counselor()));
drop policy if exists "Counselors write their own" on public.counselor_records;
create policy "Counselors write their own" on public.counselor_records for insert to authenticated
  with check ((select public.is_counselor()) and public.gmail_key(counselor_email) = public.gmail_key((select public.google_email())));
drop policy if exists "Authors and Executives update" on public.counselor_records;
create policy "Authors and Executives update" on public.counselor_records for update to authenticated
  using ((select public.is_admin()) or ((select public.is_counselor()) and public.gmail_key(counselor_email) = public.gmail_key((select public.google_email()))));
drop policy if exists "Authors and Executives delete" on public.counselor_records;
create policy "Authors and Executives delete" on public.counselor_records for delete to authenticated
  using ((select public.is_admin()) or ((select public.is_counselor()) and public.gmail_key(counselor_email) = public.gmail_key((select public.google_email()))));
grant select, insert, update, delete on public.counselor_records to authenticated;

create or replace function public.counselor_records_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.counselor_name := coalesce(nullif(new.counselor_name, ''), (select c.name from public.counselors c where c.email = new.counselor_email));
    if new.teacher_id is null and new.student_id is not null then
      new.teacher_id := (select s.teacher_id from public.portal_students s where s.id = new.student_id);
    end if;
  end if;
  -- the office answers: who and when
  if tg_op = 'UPDATE' and new.office_reply is distinct from old.office_reply then
    new.office_by := public.google_email(); new.office_at := now();
  end if;
  return new;
end $$;
drop trigger if exists counselor_records_stamp on public.counselor_records;
create trigger counselor_records_stamp before insert or update on public.counselor_records for each row execute function public.counselor_records_stamp();

-- a case sent to the office → an office notification
create or replace function public.counselor_records_alert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'office' and (tg_op = 'INSERT' or old.status is distinct from 'office') then
    perform public.add_staff_alert('exec', 'counselor', 'Academic Counselor: ' || new.title,
      coalesce(new.counselor_name, new.counselor_email) || coalesce(' · ' || (select s.data ->> 'name' from public.portal_students s where s.id = new.student_id), ''),
      '/admin/portal?tab=counseling');
  end if;
  return new;
end $$;
drop trigger if exists counselor_records_alert on public.counselor_records;
create trigger counselor_records_alert after insert or update on public.counselor_records for each row execute function public.counselor_records_alert();

-- everything a counselor works with — and nothing about money
create or replace function public.counselor_data()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare fem boolean;
begin
  if not public.is_counselor() then raise exception 'Not allowed.'; end if;
  fem := public.my_counselor_gender() = 'female';
  return jsonb_build_object(
    'me', (select jsonb_build_object('email', c.email, 'name', c.name, 'gender', c.gender, 'mustChange', c.must_change) from public.counselors c where public.gmail_key(c.email) = public.gmail_key(public.google_email())),
    'teachers', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.data ->> 'name', 'category', coalesce(t.data ->> 'category', ''), 'department', coalesce(t.data ->> 'department', ''),
        'whatsapp', coalesce(t.data ->> 'whatsapp', ''), 'email', coalesce(t.data ->> 'email', ''), 'status', coalesce(t.data ->> 'status', 'Active'),
        'students', (select count(*) from public.portal_students s where s.teacher_id = t.id and public.student_status_of(s.data ->> 'status') = 'Active')) order by t.id)
      from public.portal_teachers t where public.teacher_is_female(t.id) = fem), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.data ->> 'name', 'phone', coalesce(s.data ->> 'phone', ''), 'teacherId', coalesce(s.data ->> 'teacherId', ''),
        'status', public.student_status_of(s.data ->> 'status'), 'medium', coalesce(s.data ->> 'medium', ''), 'classTime', coalesce(s.data ->> 'classTime', ''),
        'course', coalesce(s.data ->> 'course', ''), 'assignDate', coalesce(s.data ->> 'assignDate', ''), 'country', coalesce(s.data ->> 'country', ''),
        'scheduleType', coalesce(s.data ->> 'scheduleType', 'fixed'), 'relative', coalesce((s.data ->> 'relative')::boolean, false), 'sameStudentOf', s.data ->> 'sameStudentOf') order by s.id)
      from public.portal_students s
      where (s.teacher_id is null and not fem) or public.teacher_is_female(s.teacher_id) = fem), '[]'::jsonb));
end $$;
-- the student's monthly reports from the teacher (academic part only)
create or replace function public.counselor_student_reports(p_student_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_counselor() then raise exception 'Not allowed.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'month', r.month, 'year', r.year, 'teacher', r.teacher_name,
      'level', r.status_level, 'levelNote', r.status_note, 'lesson', r.current_lesson, 'taught', r.taught, 'next', r.next_target, 'remarks', r.remarks,
      'present', r.present, 'absent', r.absent, 'absenceReason', r.absence_reason, 'total', r.total_classes, 'review', r.review_status, 'submittedAt', r.submitted_at)
      order by r.year desc, r.submitted_at desc)
    from public.monthly_reports r where r.student_id = p_student_id), '[]'::jsonb);
end $$;
revoke all on function public.counselor_data(), public.counselor_student_reports(text) from public, anon;
grant execute on function public.counselor_data(), public.counselor_student_reports(text) to authenticated;
do $$ begin
  begin alter publication supabase_realtime add table public.counselor_records; exception when duplicate_object or undefined_object then null; end;
end $$;

-- v157 (site v188): stronger office phone notifications — a test button that
-- reaches only the devices of the person who pressed it, and their device list
alter table public.teacher_alerts add column if not exists target_email text;
create or replace function public.push_take(p_secret text, p_limit int default 200)
returns jsonb language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  if not public.push_secret_ok(p_secret) then raise exception 'Not allowed.'; end if;
  with picked as (
    select a.id from public.teacher_alerts a
    where a.sent_at is null and a.created_at > now() - interval '2 days'
    order by a.id limit greatest(1, least(coalesce(p_limit, 200), 500))
    for update skip locked
  ), marked as (
    update public.teacher_alerts a set sent_at = now() from picked where a.id = picked.id
    returning a.id, a.teacher_id, a.audience, a.kind, a.title, a.body, a.url, a.target_email
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'body', m.body, 'url', m.url, 'kind', m.kind, 'audience', m.audience,
      'subs', coalesce((select jsonb_agg(p.subscription) from public.push_subscriptions p
        where (m.target_email is null or public.gmail_key(coalesce(p.email, '')) = public.gmail_key(m.target_email))
          and ((m.audience is null and p.audience = 'teacher' and p.teacher_id = m.teacher_id)
           or (m.audience = 'exec' and p.audience = 'exec')
           or (m.audience = 'staff' and p.audience in ('exec', 'staff')))), '[]'::jsonb))), '[]'::jsonb)
    into out from marked m;
  return out;
end $$;
revoke all on function public.push_take(text, int) from public;
grant execute on function public.push_take(text, int) to anon, authenticated;

create or replace function public.staff_push_test()
returns int language plpgsql security definer set search_path = public as $$
declare e text := lower(public.google_email()); n int;
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  select count(*) into n from public.push_subscriptions p where p.audience in ('exec', 'staff') and public.gmail_key(coalesce(p.email, '')) = public.gmail_key(e);
  insert into public.teacher_alerts (teacher_id, audience, kind, title, body, url, target_email)
    values (null, case when public.is_admin() then 'exec' else 'staff' end, 'test', 'Test notification ✓',
      'Office notifications work on this device. You will get new inquiries, teacher requests and reports like this.', '/admin/portal', e);
  return n;
end $$;
create or replace function public.staff_push_devices()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('endpoint', p.endpoint, 'device', p.device, 'createdAt', p.created_at) order by p.created_at desc)
    from public.push_subscriptions p where p.audience in ('exec', 'staff') and public.gmail_key(coalesce(p.email, '')) = public.gmail_key(public.google_email())), '[]'::jsonb);
end $$;
create or replace function public.staff_push_remove(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions p where p.endpoint = p_endpoint and p.audience in ('exec', 'staff')
    and public.gmail_key(coalesce(p.email, '')) = public.gmail_key(public.google_email());
$$;
revoke all on function public.staff_push_test(), public.staff_push_devices(), public.staff_push_remove(text) from public, anon;
grant execute on function public.staff_push_test(), public.staff_push_devices(), public.staff_push_remove(text) to authenticated;

-- v157 (site v188): every admin sees each save within seconds, also on networks
-- where the live connection (websocket) is blocked: a tiny change counter per
-- list that the portal checks every few seconds
create table if not exists public.portal_change_log (list text primary key, n bigint not null default 0, changed_at timestamptz not null default now());
alter table public.portal_change_log enable row level security;
revoke all on public.portal_change_log from anon, authenticated;
create or replace function public.portal_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.portal_change_log (list, n, changed_at) values (tg_argv[0], 1, now())
    on conflict (list) do update set n = public.portal_change_log.n + 1, changed_at = now();
  return null;
end $$;
do $$
declare t text[];
begin
  foreach t slice 1 in array array[['portal_teachers', 'teachers'], ['portal_students', 'students'], ['portal_payments', 'payments'], ['portal_reports', 'reports'], ['portal_team', 'team'], ['teacher_profiles', 'teachers']] loop
    execute format('drop trigger if exists portal_touch on public.%I', t[1]);
    execute format('create trigger portal_touch after insert or update or delete on public.%I for each statement execute function public.portal_touch(%L)', t[1], t[2]);
  end loop;
end $$;
create or replace function public.portal_changes()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then return '{}'::jsonb; end if;
  return coalesce((select jsonb_object_agg(list, n) from public.portal_change_log), '{}'::jsonb);
end $$;
revoke all on function public.portal_changes() from public, anon;
grant execute on function public.portal_changes() to authenticated;

-- Enrolling: one quick call (the Student IDs are given by the database), and an
-- Executive's teacher share is returned as saved
create or replace function public.staff_add_students(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; sid text; out jsonb := '[]'::jsonb; n int; junior boolean := not public.is_admin();
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  perform pg_advisory_xact_lock(hashtext('qit_student_id'));
  n := public.next_portal_number('portal_students', 'QIT-S');
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    sid := 'QIT-S' || lpad(n::text, 3, '0'); n := n + 1;
    if junior then r := r || jsonb_build_object('cut', 0); end if;
    if nullif(r ->> 'sameStudentOf', '') is null and public.same_student_of(r ->> 'name', r ->> 'phone') is not null then
      raise exception 'same_student: % (%) already has this WhatsApp number and name. Brothers and sisters need different names. For the same student in a second class, choose "Same student, 2 different classes".',
        r ->> 'name', public.same_student_of(r ->> 'name', r ->> 'phone');
    end if;
    insert into public.portal_students (id, data) values (sid, (r - 'id') || jsonb_build_object('id', sid));
    out := out || (case when junior then (r - 'cut') || jsonb_build_object('cut', 0) else r end || jsonb_build_object('id', sid));
  end loop;
  return out;
end $$;

-- =====================================================================
-- v158 (site v189): office notification check — the test button sends to
-- this person's devices at once and reports what happened
-- =====================================================================
drop function if exists public.staff_push_test();
create or replace function public.staff_push_test()
returns jsonb language plpgsql security definer set search_path = public as $$
declare e text := lower(public.google_email()); n int; aid bigint;
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  select count(*) into n from public.push_subscriptions p where p.audience in ('exec', 'staff') and public.gmail_key(coalesce(p.email, '')) = public.gmail_key(e);
  -- marked as sent, so only the test call below delivers it (and can report the result)
  insert into public.teacher_alerts (teacher_id, audience, kind, title, body, url, target_email, sent_at)
    values (null, case when public.is_admin() then 'exec' else 'staff' end, 'test', 'Test notification ✓',
      'Office notifications work on this device. New inquiries, teacher requests and reports arrive like this.', '/admin/portal', e, now())
    returning id into aid;
  return jsonb_build_object('id', aid, 'devices', n);
end $$;
create or replace function public.push_test_take(p_secret text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.push_secret_ok(p_secret) then raise exception 'Not allowed.'; end if;
  return (select jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body, 'url', a.url, 'kind', a.kind,
      'subs', coalesce((select jsonb_agg(p.subscription) from public.push_subscriptions p
        where p.audience in ('exec', 'staff') and public.gmail_key(coalesce(p.email, '')) = public.gmail_key(a.target_email)), '[]'::jsonb))
    from public.teacher_alerts a where a.id = p_id and a.kind = 'test' and a.created_at > now() - interval '10 minutes');
end $$;
revoke all on function public.push_test_take(text, bigint) from public;
grant execute on function public.push_test_take(text, bigint) to anon, authenticated;
-- what the office panel shows under "Check": is the push secret saved, is the instant ping (pg_net) on
create or replace function public.push_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not allowed.'; end if;
  return jsonb_build_object(
    'secretSet', exists (select 1 from public.push_config c where c.secret_hash is not null),
    'pgNet', exists (select 1 from pg_extension where extname = 'pg_net'),
    'devices', (select count(*) from public.push_subscriptions p where p.audience in ('exec', 'staff') and public.gmail_key(coalesce(p.email, '')) = public.gmail_key(public.google_email())),
    'waiting', (select count(*) from public.teacher_alerts a where a.sent_at is null and a.audience is not null and a.created_at > now() - interval '2 days'));
end $$;
revoke all on function public.staff_push_test(), public.push_status() from public, anon;
grant execute on function public.staff_push_test(), public.push_status() to authenticated;

create or replace function public.qit_sql_version() returns int language sql immutable as $$ select 158 $$;
grant execute on function public.qit_sql_version() to anon, authenticated;

-- 9. Result ----------------------------------------------------------------
select 'ready' as status,
  (select count(*) from public.portal_teachers) as teachers,
  (select count(*) from public.portal_students) as students,
  (select count(*) from public.teacher_profiles) as teacher_accounts,
  -- Teacher ID sign-ins that work now (one per teacher in the list)
  (select count(*) from public.teacher_logins l join public.portal_teachers t on t.id = l.teacher_id where not l.disabled) as teacher_sign_ins,
  -- Blocked: switched off by the office, or left over from a deleted teacher (kept so old reports stay linked)
  (select count(*) from auth.users u where lower(u.email) like '%@institute.local'
     and not exists (select 1 from public.teacher_logins l join public.portal_teachers t on t.id = l.teacher_id
                     where l.user_id = u.id and not l.disabled)) as sign_ins_blocked,
  (select count(*) from public.staff_roles) as junior_admins,
  (select string_agg(email, ', ' order by created_at) from public.executive_emails) as executives,
  (select string_agg(ids, ' | ') from (select string_agg(id, ', ' order by id) as ids from public.portal_teachers
     where char_length(public.phone_key(data ->> 'whatsapp')) >= 7 group by public.phone_key(data ->> 'whatsapp') having count(*) > 1) d) as duplicate_teacher_phones,
  (select count(*) from public.daily_attendance) as attendance_entries,
  (select count(*) from public.daily_attendance where is_recovery) as recovery_classes,
  (select count(*) from public.portal_students where data ->> 'scheduleType' = 'flexible') as flexible_students,
  public.progress_baseline() as progress_starts;
