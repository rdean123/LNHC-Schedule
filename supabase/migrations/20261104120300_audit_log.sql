-- Audit log: who changed what, and the before/after values.
-- Written only by triggers (SECURITY DEFINER). Nobody can write to it from the API, and only
-- administrators can read it. Volunteer availability is not logged (frequent, self-service).

create table public.audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,
  table_name text not null,
  record_id  text,
  old_data   jsonb,
  new_data   jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_table_record_idx on public.audit_logs (table_name, record_id);

create function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_j jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_j jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  row_j jsonb := coalesce(new_j, old_j);
begin
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    (select auth.uid()),
    tg_op,
    tg_table_name,
    coalesce(row_j ->> 'id', row_j ->> 'user_id', row_j ->> 'volunteer_id'),
    old_j,
    new_j
  );
  return null;
end;
$$;

revoke all on function public.audit_row_change() from public, anon, authenticated;

create trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function public.audit_row_change();
create trigger audit_volunteers after insert or update or delete on public.volunteers
  for each row execute function public.audit_row_change();
create trigger audit_volunteer_contacts after insert or update or delete on public.volunteer_contacts
  for each row execute function public.audit_row_change();
create trigger audit_volunteer_qualifications after insert or update or delete on public.volunteer_qualifications
  for each row execute function public.audit_row_change();
create trigger audit_venues after insert or update or delete on public.venues
  for each row execute function public.audit_row_change();
create trigger audit_positions after insert or update or delete on public.positions
  for each row execute function public.audit_row_change();
create trigger audit_venue_positions after insert or update or delete on public.venue_positions
  for each row execute function public.audit_row_change();
create trigger audit_services after insert or update or delete on public.services
  for each row execute function public.audit_row_change();
create trigger audit_assignments after insert or update or delete on public.assignments
  for each row execute function public.audit_row_change();
create trigger audit_announcements after insert or update or delete on public.announcements
  for each row execute function public.audit_row_change();
