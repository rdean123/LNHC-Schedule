-- Row level security and grants.
--
-- Default is deny: RLS is enabled on every table and a table with no matching policy returns
-- nothing. Anonymous visitors (the "anon" role) get no access to any table, only login.
-- Administrators can do everything below; volunteers get the narrow access listed per table.
-- See DATABASE_SCHEMA.md and USER_ROLES_AND_PERMISSIONS.md.

alter table public.user_roles               enable row level security;
alter table public.volunteers               enable row level security;
alter table public.volunteer_contacts       enable row level security;
alter table public.ministries               enable row level security;
alter table public.venues                   enable row level security;
alter table public.positions                enable row level security;
alter table public.venue_positions          enable row level security;
alter table public.volunteer_qualifications enable row level security;
alter table public.volunteer_availability   enable row level security;
alter table public.services                 enable row level security;
alter table public.assignments              enable row level security;
alter table public.announcements            enable row level security;
alter table public.audit_logs               enable row level security;

-- Grants: start from nothing, then give signed-in users what policies can then narrow.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.user_roles, public.volunteers, public.volunteer_contacts, public.ministries,
  public.venues, public.positions, public.venue_positions, public.volunteer_qualifications,
  public.volunteer_availability, public.services, public.assignments, public.announcements
  to authenticated;
grant select on public.audit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- user_roles: you can read your own role; only administrators read or change anyone's.
-- No one can promote themselves: there is no insert/update path except through admin.
-- ---------------------------------------------------------------------------
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check ((select public.is_admin()));
create policy user_roles_update on public.user_roles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy user_roles_delete on public.user_roles for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- volunteers: everyone signed in can see every name, including inactive people, so past
-- rosters still show who served. Only administrators change them.
-- ---------------------------------------------------------------------------
create policy volunteers_select on public.volunteers for select to authenticated
  using (true);
create policy volunteers_insert on public.volunteers for insert to authenticated
  with check ((select public.is_admin()));
create policy volunteers_update on public.volunteers for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy volunteers_delete on public.volunteers for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- volunteer_contacts: email and phone are private. Administrators, and each volunteer for
-- their own record (who can change phone and name, but not email: see guard trigger).
-- ---------------------------------------------------------------------------
create policy volunteer_contacts_select on public.volunteer_contacts for select to authenticated
  using ((select public.is_admin()) or volunteer_id = (select public.current_volunteer_id()));
create policy volunteer_contacts_insert on public.volunteer_contacts for insert to authenticated
  with check ((select public.is_admin()));
create policy volunteer_contacts_update on public.volunteer_contacts for update to authenticated
  using ((select public.is_admin()) or volunteer_id = (select public.current_volunteer_id()))
  with check ((select public.is_admin()) or volunteer_id = (select public.current_volunteer_id()));
create policy volunteer_contacts_delete on public.volunteer_contacts for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Reference data and qualifications: readable by anyone signed in, changed by administrators.
-- ---------------------------------------------------------------------------
create policy ministries_select on public.ministries for select to authenticated using (true);
create policy ministries_insert on public.ministries for insert to authenticated
  with check ((select public.is_admin()));
create policy ministries_update on public.ministries for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy ministries_delete on public.ministries for delete to authenticated
  using ((select public.is_admin()));

create policy venues_select on public.venues for select to authenticated using (true);
create policy venues_insert on public.venues for insert to authenticated
  with check ((select public.is_admin()));
create policy venues_update on public.venues for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy venues_delete on public.venues for delete to authenticated
  using ((select public.is_admin()));

create policy positions_select on public.positions for select to authenticated using (true);
create policy positions_insert on public.positions for insert to authenticated
  with check ((select public.is_admin()));
create policy positions_update on public.positions for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy positions_delete on public.positions for delete to authenticated
  using ((select public.is_admin()));

create policy venue_positions_select on public.venue_positions for select to authenticated using (true);
create policy venue_positions_insert on public.venue_positions for insert to authenticated
  with check ((select public.is_admin()));
create policy venue_positions_update on public.venue_positions for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy venue_positions_delete on public.venue_positions for delete to authenticated
  using ((select public.is_admin()));

create policy volunteer_qualifications_select on public.volunteer_qualifications for select to authenticated
  using (true);
create policy volunteer_qualifications_insert on public.volunteer_qualifications for insert to authenticated
  with check ((select public.is_admin()));
create policy volunteer_qualifications_update on public.volunteer_qualifications for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy volunteer_qualifications_delete on public.volunteer_qualifications for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- volunteer_availability: private to the volunteer and administrators. A volunteer can only
-- write their own rows.
-- ---------------------------------------------------------------------------
create policy volunteer_availability_select on public.volunteer_availability for select to authenticated
  using ((select public.is_admin()) or volunteer_id = (select public.current_volunteer_id()));
create policy volunteer_availability_insert on public.volunteer_availability for insert to authenticated
  with check ((select public.is_admin()) or volunteer_id = (select public.current_volunteer_id()));
create policy volunteer_availability_update on public.volunteer_availability for update to authenticated
  using ((select public.is_admin()) or volunteer_id = (select public.current_volunteer_id()))
  with check ((select public.is_admin()) or volunteer_id = (select public.current_volunteer_id()));
create policy volunteer_availability_delete on public.volunteer_availability for delete to authenticated
  using ((select public.is_admin()) or volunteer_id = (select public.current_volunteer_id()));

-- ---------------------------------------------------------------------------
-- services and assignments: volunteers see only published rosters. Administrators see and
-- change everything (drafts included).
-- ---------------------------------------------------------------------------
create policy services_select on public.services for select to authenticated
  using ((select public.is_admin()) or status = 'published');
create policy services_insert on public.services for insert to authenticated
  with check ((select public.is_admin()));
create policy services_update on public.services for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy services_delete on public.services for delete to authenticated
  using ((select public.is_admin()));

create policy assignments_select on public.assignments for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.services s
      where s.id = assignments.service_id and s.status = 'published'
    )
  );
create policy assignments_insert on public.assignments for insert to authenticated
  with check ((select public.is_admin()));
create policy assignments_update on public.assignments for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy assignments_delete on public.assignments for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- announcements: volunteers see published ones; administrators manage all.
-- ---------------------------------------------------------------------------
create policy announcements_select on public.announcements for select to authenticated
  using ((select public.is_admin()) or (published_at is not null and published_at <= now()));
create policy announcements_insert on public.announcements for insert to authenticated
  with check ((select public.is_admin()));
create policy announcements_update on public.announcements for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy announcements_delete on public.announcements for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- audit_logs: administrators read. Nobody writes through the API (triggers only).
-- ---------------------------------------------------------------------------
create policy audit_logs_select on public.audit_logs for select to authenticated
  using ((select public.is_admin()));
