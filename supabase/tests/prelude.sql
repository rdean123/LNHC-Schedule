-- Test-only stand-in for what Supabase provides before our migrations run:
-- the API roles, the auth schema, and auth.uid() reading the caller's id.
-- The tests set `request.jwt.claim.sub` to act as a given user.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;

create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
