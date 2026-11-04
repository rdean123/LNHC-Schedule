-- Schedule maker permissions.
--
-- Three roles now:
--   volunteer  sees published schedules, sets their own availability and phone.
--   scheduler  (schedule maker) everything an administrator can do EXCEPT change roles:
--              build, edit and publish schedules; manage volunteers, qualifications, venues
--              and positions; post announcements; invite people; read the activity log.
--   admin      all of that, and the only role that can change who holds which role.
--
-- is_admin() keeps meaning "administrator". is_staff() means "administrator or schedule maker".
-- Every place that used is_admin() for scheduling work now uses is_staff(). Role changes
-- (inserting, updating or deleting user_roles) stay with is_admin().

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role in ('admin', 'scheduler')
  );
$$;

revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- ---------------------------------------------------------------------------
-- Functions that checked for an administrator
-- ---------------------------------------------------------------------------
create or replace function public.guard_contact_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not (select public.is_staff()) then
    if new.volunteer_id is distinct from old.volunteer_id
       or new.email is distinct from old.email then
      raise exception 'Only an administrator can change an email address.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.availability_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_available
     and (select auth.uid()) is not null
     and not (select public.is_staff())
     and exists (
       select 1
       from public.assignments a
       join public.services s on s.id = a.service_id
       where a.volunteer_id = new.volunteer_id
         and a.service_date = new.service_date
         and s.status = 'published'
     )
  then
    raise exception 'You''re scheduled to serve on %. Ask your administrator to take you off the schedule first.',
      to_char(new.service_date, 'FMMonth FMDD');
  end if;
  return new;
end;
$$;

create or replace function public.schedule_problems(p_from date, p_to date, p_venue_id uuid default null)
returns table (
  service_id    uuid,
  assignment_id uuid,
  venue_id      uuid,
  service_date  date,
  volunteer_id  uuid,
  position_id   uuid,
  problem       text,
  message       text
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public._schedule_problems(p_from, p_to, p_venue_id)
  where (select public.is_staff());
$$;

create or replace function public.suggest_volunteers(p_service_id uuid, p_position_id uuid)
returns table (
  volunteer_id         uuid,
  display_name         text,
  can_assign           boolean,
  status               text,
  reason               text,
  last_served          date,
  times_served_8_weeks integer
)
language sql
stable
set search_path = ''
as $$
  with s as (
    select sv.id, sv.venue_id, sv.service_date, ve.name as venue_name
    from public.services sv
    join public.venues ve on ve.id = sv.venue_id
    where sv.id = p_service_id
      and (select public.is_staff())
      and exists (
        select 1 from public.venue_positions vp
        where vp.venue_id = sv.venue_id and vp.position_id = p_position_id
      )
  ),
  info as (
    select c.id as vid, c.display_name as dname, s.venue_id, s.venue_name, s.service_date,
           ex.venue_id as ex_venue_id, ex.pos_name, ex.venue_name as ex_venue_name,
           av.volunteer_id as av_row, av.is_available,
           lst.last_served, cnt.n
    from s
    cross join lateral (
      select v.id, v.display_name
      from public.volunteers v
      join public.volunteer_qualifications q on q.volunteer_id = v.id and q.position_id = p_position_id
      where v.is_active
    ) c
    left join lateral (
      select sv2.venue_id, p.name as pos_name, ve2.name as venue_name
      from public.assignments a
      join public.services sv2 on sv2.id = a.service_id
      join public.positions p on p.id = a.position_id
      join public.venues ve2 on ve2.id = sv2.venue_id
      where a.volunteer_id = c.id and a.service_date = s.service_date
      limit 1
    ) ex on true
    left join public.volunteer_availability av
      on av.volunteer_id = c.id and av.service_date = s.service_date
    left join lateral (
      select max(a.service_date) as last_served
      from public.assignments a
      where a.volunteer_id = c.id and a.service_date < s.service_date
    ) lst on true
    left join lateral (
      select count(*)::integer as n
      from public.assignments a
      where a.volunteer_id = c.id
        and a.service_date >= s.service_date - 56
        and a.service_date < s.service_date
    ) cnt on true
  )
  select vid, dname,
         (ex_venue_id is null and coalesce(is_available, true)) as can_assign,
         case
           when ex_venue_id is not null then 'already_assigned'
           when is_available is false then 'away'
           when av_row is null then 'no_answer'
           else 'available'
         end,
         case
           when ex_venue_id = venue_id then
             'Already serving as ' || pos_name || ' at ' || ex_venue_name || ' on ' || to_char(service_date, 'FMMonth FMDD') || '. Each person has one position per Sunday.'
           when ex_venue_id is not null then
             'Serving at ' || ex_venue_name || ' (' || pos_name || ') that Sunday. One person can''t serve at two venues on the same day.'
           when is_available is false then 'Marked Away on ' || to_char(service_date, 'FMMonth FMDD') || '.'
           when av_row is null then 'Hasn''t answered for ' || to_char(service_date, 'FMMonth FMDD') || '.'
           else 'Available.'
         end,
         last_served, n
  from info
  order by 3 desc, last_served nulls first, n, dname;
$$;

create or replace function public.copy_schedule(
  p_venue_id     uuid,
  p_source_start date,
  p_source_end   date,
  p_target_start date
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_offset             integer;
  src                  record;
  asg                  record;
  tgt                  uuid;
  tgt_date             date;
  existing_count       integer;
  services_created     integer := 0;
  assignments_created  integer := 0;
  skipped              jsonb := '[]'::jsonb;
  days_skipped         jsonb := '[]'::jsonb;
  why                  text;
begin
  if not (select public.is_staff()) then
    raise exception 'Only administrators can copy schedules.';
  end if;
  if p_source_end < p_source_start then
    raise exception 'The end of the range to copy is before its start.';
  end if;
  v_offset := p_target_start - p_source_start;
  if v_offset = 0 then
    raise exception 'Choose a different Sunday or month to copy into.';
  end if;
  if v_offset % 7 <> 0 then
    raise exception 'Both start dates must be Sundays so the weeks line up.';
  end if;

  for src in
    select s.id, s.service_date
    from public.services s
    where s.venue_id = p_venue_id and s.service_date between p_source_start and p_source_end
    order by s.service_date
  loop
    tgt_date := src.service_date + v_offset;
    select s.id into tgt from public.services s where s.venue_id = p_venue_id and s.service_date = tgt_date;

    if tgt is null then
      insert into public.services (venue_id, service_date) values (p_venue_id, tgt_date) returning id into tgt;
      services_created := services_created + 1;
    else
      select count(*) into existing_count from public.assignments where service_id = tgt;
      if existing_count > 0 then
        days_skipped := days_skipped || jsonb_build_object(
          'service_date', tgt_date,
          'reason', 'It already has assignments, so nothing was copied onto it.'
        );
        continue;
      end if;
    end if;

    for asg in
      select a.position_id, a.volunteer_id, v.display_name, p.name as position_name
      from public.assignments a
      join public.volunteers v on v.id = a.volunteer_id
      join public.positions p on p.id = a.position_id
      where a.service_id = src.id
    loop
      begin
        insert into public.assignments (service_id, service_date, position_id, volunteer_id)
        values (tgt, tgt_date, asg.position_id, asg.volunteer_id);
        assignments_created := assignments_created + 1;
      exception when others then
        why := case
          when sqlstate = '23505' then asg.display_name || ' is already serving on ' || to_char(tgt_date, 'FMMonth FMDD') || '.'
          else sqlerrm
        end;
        skipped := skipped || jsonb_build_object(
          'service_date', tgt_date,
          'volunteer', asg.display_name,
          'position', asg.position_name,
          'reason', why
        );
      end;
    end loop;
  end loop;

  return jsonb_build_object(
    'services_created', services_created,
    'assignments_created', assignments_created,
    'skipped', skipped,
    'days_skipped', days_skipped
  );
end;
$$;

create or replace function public.assignment_history(p_service_id uuid)
returns table (
  changed_at     timestamptz,
  action         text,
  actor_name     text,
  volunteer_name text,
  position_name  text
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.created_at,
         case l.action when 'INSERT' then 'added' when 'DELETE' then 'removed' else 'changed' end,
         coalesce(actor.display_name, 'An administrator'),
         coalesce(v.display_name, 'Unknown'),
         coalesce(p.name, 'Unknown')
  from public.audit_logs l
  left join public.volunteers actor on actor.user_id = l.actor_id
  left join public.volunteers v on v.id = (coalesce(l.new_data, l.old_data) ->> 'volunteer_id')::uuid
  left join public.positions p on p.id = (coalesce(l.new_data, l.old_data) ->> 'position_id')::uuid
  where l.table_name = 'assignments'
    and (coalesce(l.new_data, l.old_data) ->> 'service_id') = p_service_id::text
    and (select public.is_staff())
  order by l.created_at desc, l.id desc;
$$;

-- ---------------------------------------------------------------------------
-- Linking an account to a volunteer is an administrator's job. Without this a schedule maker,
-- who can edit volunteers, could attach someone else's login to a volunteer record.
-- (auth.uid() is null for server-side callers such as the invite function.)
-- ---------------------------------------------------------------------------
create function public.guard_volunteer_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     and (select auth.uid()) is not null
     and not (select public.is_admin())
  then
    raise exception 'Only an administrator can link a volunteer to a login.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger volunteers_guard_link
  before update on public.volunteers
  for each row execute function public.guard_volunteer_link();

-- ---------------------------------------------------------------------------
-- Row level security: staff instead of administrators, except role changes.
-- (user_roles_insert, user_roles_update and user_roles_delete are unchanged: administrators only.)
-- ---------------------------------------------------------------------------
alter policy user_roles_select on public.user_roles
  using (user_id = (select auth.uid()) or (select public.is_staff()));
alter policy volunteers_insert on public.volunteers
  with check ((select public.is_staff()));
alter policy volunteers_update on public.volunteers
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
alter policy volunteers_delete on public.volunteers
  using ((select public.is_staff()));
alter policy volunteer_contacts_select on public.volunteer_contacts
  using ((select public.is_staff()) or volunteer_id = (select public.current_volunteer_id()));
alter policy volunteer_contacts_insert on public.volunteer_contacts
  with check ((select public.is_staff()));
alter policy volunteer_contacts_update on public.volunteer_contacts
  using ((select public.is_staff()) or volunteer_id = (select public.current_volunteer_id()))
  with check ((select public.is_staff()) or volunteer_id = (select public.current_volunteer_id()));
alter policy volunteer_contacts_delete on public.volunteer_contacts
  using ((select public.is_staff()));
alter policy ministries_insert on public.ministries
  with check ((select public.is_staff()));
alter policy ministries_update on public.ministries
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
alter policy ministries_delete on public.ministries
  using ((select public.is_staff()));
alter policy venues_insert on public.venues
  with check ((select public.is_staff()));
alter policy venues_update on public.venues
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
alter policy venues_delete on public.venues
  using ((select public.is_staff()));
alter policy positions_insert on public.positions
  with check ((select public.is_staff()));
alter policy positions_update on public.positions
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
alter policy positions_delete on public.positions
  using ((select public.is_staff()));
alter policy venue_positions_insert on public.venue_positions
  with check ((select public.is_staff()));
alter policy venue_positions_update on public.venue_positions
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
alter policy venue_positions_delete on public.venue_positions
  using ((select public.is_staff()));
alter policy volunteer_qualifications_insert on public.volunteer_qualifications
  with check ((select public.is_staff()));
alter policy volunteer_qualifications_update on public.volunteer_qualifications
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
alter policy volunteer_qualifications_delete on public.volunteer_qualifications
  using ((select public.is_staff()));
alter policy volunteer_availability_select on public.volunteer_availability
  using ((select public.is_staff()) or volunteer_id = (select public.current_volunteer_id()));
alter policy volunteer_availability_insert on public.volunteer_availability
  with check ((select public.is_staff()) or volunteer_id = (select public.current_volunteer_id()));
alter policy volunteer_availability_update on public.volunteer_availability
  using ((select public.is_staff()) or volunteer_id = (select public.current_volunteer_id()))
  with check ((select public.is_staff()) or volunteer_id = (select public.current_volunteer_id()));
alter policy volunteer_availability_delete on public.volunteer_availability
  using ((select public.is_staff()) or volunteer_id = (select public.current_volunteer_id()));
alter policy services_select on public.services
  using ((select public.is_staff()) or status = 'published');
alter policy services_insert on public.services
  with check ((select public.is_staff()));
alter policy services_update on public.services
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
alter policy services_delete on public.services
  using ((select public.is_staff()));
alter policy assignments_select on public.assignments
  using ((select public.is_staff())
    or exists (
      select 1 from public.services s
      where s.id = assignments.service_id and s.status = 'published'
    ));
alter policy assignments_insert on public.assignments
  with check ((select public.is_staff()));
alter policy assignments_update on public.assignments
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
alter policy assignments_delete on public.assignments
  using ((select public.is_staff()));
alter policy announcements_select on public.announcements
  using ((select public.is_staff()) or (published_at is not null and published_at <= now()));
alter policy announcements_insert on public.announcements
  with check ((select public.is_staff()));
alter policy announcements_update on public.announcements
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
alter policy announcements_delete on public.announcements
  using ((select public.is_staff()));
alter policy audit_logs_select on public.audit_logs
  using ((select public.is_staff()));
