-- Foundation and identity.
--
-- Login accounts (auth.users) are kept separate from the people who serve (volunteers).
-- A volunteer can exist before they have an account; an account links to at most one volunteer.
-- Roles live in user_roles, which only administrators can change.

create type public.app_role as enum ('admin', 'volunteer');
create type public.publish_status as enum ('draft', 'published');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       public.app_role not null default 'volunteer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_roles_set_updated_at
  before update on public.user_roles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Volunteers (people who serve). Names only; contact details live in volunteer_contacts
-- so that ordinary volunteers can see who is serving without seeing anyone's email or phone.
-- ---------------------------------------------------------------------------
create table public.volunteers (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  user_id      uuid unique references auth.users (id) on delete set null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Two active people with the same name would be ambiguous in a roster.
create unique index volunteers_active_display_name_key
  on public.volunteers (lower(btrim(display_name)))
  where is_active;

create trigger volunteers_set_updated_at
  before update on public.volunteers
  for each row execute function public.set_updated_at();

create table public.volunteer_contacts (
  volunteer_id uuid primary key references public.volunteers (id) on delete cascade,
  full_name    text check (full_name is null or char_length(full_name) <= 80),
  email        text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone        text check (phone is null or char_length(phone) <= 30),
  updated_at   timestamptz not null default now()
);

create unique index volunteer_contacts_email_key
  on public.volunteer_contacts (lower(email))
  where email is not null;

create trigger volunteer_contacts_set_updated_at
  before update on public.volunteer_contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers used by row level security. SECURITY DEFINER so they can read user_roles and
-- volunteers without recursing into those tables' own policies.
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.current_volunteer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.volunteers
  where user_id = (select auth.uid()) and is_active
  limit 1;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.current_volunteer_id() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_volunteer_id() to authenticated;

-- ---------------------------------------------------------------------------
-- New accounts: everyone starts as a volunteer. Never an administrator.
-- If an existing volunteer record has the same email, link it to the new account.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'volunteer')
  on conflict (user_id) do nothing;

  update public.volunteers v
     set user_id = new.id
    from public.volunteer_contacts c
   where c.volunteer_id = v.id
     and v.user_id is null
     and lower(c.email) = lower(new.email);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

-- The church can never be left without an administrator.
create function public.guard_last_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin')
     and not exists (
       select 1 from public.user_roles where role = 'admin' and user_id <> old.user_id
     )
  then
    raise exception 'You can''t remove the last administrator. Make someone else an administrator first.'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger user_roles_guard_last_admin
  before update or delete on public.user_roles
  for each row execute function public.guard_last_admin();

-- A volunteer may edit their own phone and name, but not their email or whose record it is.
-- auth.uid() is null for server-side callers (service role, migrations), which are trusted.
create function public.guard_contact_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not (select public.is_admin()) then
    if new.volunteer_id is distinct from old.volunteer_id
       or new.email is distinct from old.email then
      raise exception 'Only an administrator can change an email address.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger volunteer_contacts_guard_update
  before update on public.volunteer_contacts
  for each row execute function public.guard_contact_update();
