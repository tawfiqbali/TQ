-- =====================================================================
-- Quran International Institute – cloud database setup (Supabase)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run again: it only adds what is missing.
-- Create the executive user accounts FIRST (Authentication → Users),
-- because the last section marks them as admins.
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

-- 5. Make the two executive accounts admins ------------------------------
insert into public.admins (user_id)
select id from auth.users
where lower(email) in ('gmmuhit1632@gmail.com', 'qitoffice.info@gmail.com')
on conflict do nothing;

-- Check: this should list both emails. If one is missing, create that user
-- under Authentication → Users and run this file again.
select u.email as admin_email
from public.admins a join auth.users u on u.id = a.user_id;
