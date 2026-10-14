-- =====================================================================
-- Set the Executive password to admin5050 for both Executive accounts.
-- Supabase → SQL Editor → New query → paste this whole file → Run.
-- Also confirms the accounts (so "Email not confirmed" can't block sign-in)
-- and makes sure both are admins.
-- To use a different password later, change 'admin5050' below and run again.
-- =====================================================================

update auth.users
set encrypted_password = extensions.crypt('admin5050', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
where lower(email) in ('gmmuhit1632@gmail.com', 'qitoffice.info@gmail.com');

insert into public.admins (user_id)
select id from auth.users
where lower(email) in ('gmmuhit1632@gmail.com', 'qitoffice.info@gmail.com')
on conflict do nothing;

-- Result: each Executive email and whether it is ready.
-- "MISSING" means that account does not exist yet: create it under
-- Authentication → Users → Add user (password admin5050, tick Auto Confirm),
-- then run this file again.
select e.email,
       case when u.id is null then 'MISSING – create this user first'
            when a.user_id is null then 'exists, but not an admin – run supabase/setup.sql'
            else 'ready – password is admin5050' end as status
from (values ('gmmuhit1632@gmail.com'), ('qitoffice.info@gmail.com')) as e(email)
left join auth.users u on lower(u.email) = e.email
left join public.admins a on a.user_id = u.id;
