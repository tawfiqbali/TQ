-- =====================================================================
-- Quran International Institute - COMPLETE cloud setup (run this one file)
-- Supabase -> SQL Editor -> New query -> paste EVERYTHING -> Run.
-- Creates the tables and security rules, turns on live updates, sets the
-- Executive password to admin5050 and makes both Executives admins.
-- Safe to run again at any time.
-- =====================================================================

-- 1. Who may edit: admin accounts --------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 2. Website content: one row holding everything the admin panel edits ---
create table if not exists public.site_content (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;

drop policy if exists "Anyone can read site content" on public.site_content;
create policy "Anyone can read site content" on public.site_content
  for select using (true);

drop policy if exists "Admins can change site content" on public.site_content;
create policy "Admins can change site content" on public.site_content
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- 3. Trial bookings and contact messages ---------------------------------
create table if not exists public.inquiries (
  id uuid primary key,
  type text not null check (type in ('trial', 'contact')),
  name text not null check (char_length(name) between 1 and 200),
  email text check (email is null or char_length(email) <= 200),
  phone text check (phone is null or char_length(phone) <= 50),
  course text,
  student_type text,
  details jsonb,
  preferred_time text check (preferred_time is null or char_length(preferred_time) <= 300),
  message text check (message is null or char_length(message) <= 5000),
  status text not null default 'new' check (status in ('new', 'contacted', 'enrolled', 'closed')),
  created_at timestamptz not null default now()
);
alter table public.inquiries add column if not exists details jsonb;
alter table public.inquiries enable row level security;

drop policy if exists "Anyone can submit an inquiry" on public.inquiries;
create policy "Anyone can submit an inquiry" on public.inquiries
  for insert to anon, authenticated with check (status = 'new');

drop policy if exists "Admins can add any inquiry" on public.inquiries;
create policy "Admins can add any inquiry" on public.inquiries
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists "Admins can read inquiries" on public.inquiries;
create policy "Admins can read inquiries" on public.inquiries
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "Admins can update inquiries" on public.inquiries;
create policy "Admins can update inquiries" on public.inquiries
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Admins can delete inquiries" on public.inquiries;
create policy "Admins can delete inquiries" on public.inquiries
  for delete to authenticated using ((select public.is_admin()));

-- 4. Live updates: open websites refresh the moment an admin saves --------
do $$
begin
  begin
    alter publication supabase_realtime add table public.site_content;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.inquiries;
  exception when duplicate_object then null;
  end;
end $$;

-- 5. Executive password = admin5050, accounts confirmed -------------------
update auth.users
set encrypted_password = extensions.crypt('admin5050', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
where lower(email) in ('gmmuhit1632@gmail.com', 'qitoffice.info@gmail.com');

-- 6. Make both Executives admins ------------------------------------------
insert into public.admins (user_id)
select id from auth.users
where lower(email) in ('gmmuhit1632@gmail.com', 'qitoffice.info@gmail.com')
on conflict do nothing;

-- 7. Result: both lines should say "ready".
-- "MISSING" = create that user under Authentication -> Users -> Add user
-- (password admin5050, tick Auto Confirm User), then run this file again.
select e.email,
       case when u.id is null then 'MISSING - create this user first'
            when a.user_id is null then 'not an admin yet - run this file again'
            else 'ready - password is admin5050' end as status
from (values ('gmmuhit1632@gmail.com'), ('qitoffice.info@gmail.com')) as e(email)
left join auth.users u on lower(u.email) = e.email
left join public.admins a on a.user_id = u.id;
