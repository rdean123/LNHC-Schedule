-- Run ONCE in the Supabase SQL editor to make the first administrator.
-- 1. In the Supabase dashboard, invite yourself (Authentication > Users > Invite user) and accept the email.
-- 2. Replace the address below with that same email, then run this.
-- After that, administrators can promote others from the app. Never expose this to the browser.
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where lower(email) = lower('YOUR-EMAIL@example.com')
on conflict (user_id) do update set role = 'admin';
