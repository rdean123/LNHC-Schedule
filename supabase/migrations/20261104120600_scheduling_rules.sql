-- Scheduling rules (Phase 4). See SCHEDULING_RULES.md.
--
-- Each rule lives here once. The app shows the messages; it does not re-implement the rules.
-- Messages are written for the people using the app: what happened, and what to do.

-- ---------------------------------------------------------------------------
-- 1. Assigning someone to a position
-- ---------------------------------------------------------------------------
-- The person must be active, qualified for the position, not marked Away that Sunday, and the
-- position must be one the venue uses. (One assignment per person per Sunday is a table
-- constraint.) "No answer" for availability is allowed; only an explicit Away blocks.
create function public.assignments_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  svc   record;
  vol   record;
  pos   text;
  venue text;
begin
  select s.venue_id, s.service_date into svc from public.services s where s.id = new.service_id;
  select v.display_name, v.is_active into vol from public.volunteers v where v.id = new.volunteer_id;
  select p.name into pos from public.positions p where p.id = new.position_id;
  select ve.name into venue from public.venues ve where ve.id = svc.venue_id;

  if not exists (
    select 1 from public.venue_positions vp
    where vp.venue_id = svc.venue_id and vp.position_id = new.position_id
  ) then
    raise exception '% isn''t a position at %. Choose a position this venue uses.', pos, venue;
  end if;

  if not vol.is_active then
    raise exception '% is no longer an active volunteer. Choose someone else.', vol.display_name;
  end if;

  if not exists (
    select 1 from public.volunteer_qualifications q
    where q.volunteer_id = new.volunteer_id and q.position_id = new.position_id
  ) then
    raise exception '% isn''t qualified for %. Add it to their qualifications first.', vol.display_name, pos;
  end if;

  if exists (
    select 1 from public.volunteer_availability a
    where a.volunteer_id = new.volunteer_id
      and a.service_date = svc.service_date
      and not a.is_available
  ) then
    raise exception '% is marked Away on %. Choose someone else, or ask them to change their availability.',
      vol.display_name, to_char(svc.service_date, 'FMMonth FMDD');
  end if;

  return new;
end;
$$;

revoke all on function public.assignments_validate() from public, anon, authenticated;

create trigger assignments_validate
  before insert or update of volunteer_id, position_id, service_id on public.assignments
  for each row execute function public.assignments_validate();

-- ---------------------------------------------------------------------------
-- 2. A volunteer can't mark themselves Away on a Sunday they are already published to serve.
--    (Drafts are invisible to volunteers, so they are not blocked and not revealed.
--    Administrators and server-side callers are never blocked; the clash then shows up in
--    schedule_problems below.)
-- ---------------------------------------------------------------------------
create function public.availability_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_available
     and (select auth.uid()) is not null
     and not (select public.is_admin())
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

revoke all on function public.availability_guard() from public, anon, authenticated;

create trigger volunteer_availability_guard
  before insert or update on public.volunteer_availability
  for each row execute function public.availability_guard();

-- ---------------------------------------------------------------------------
-- 3. Problems in existing assignments. Things can change after someone is assigned: a
--    qualification is removed, a volunteer is deactivated, or someone marks Away. These are
--    reported, not silently fixed. _schedule_problems has no permission check and is only
--    called from trusted code below; schedule_problems is the administrator-only entry point.
-- ---------------------------------------------------------------------------
create function public._schedule_problems(p_from date, p_to date, p_venue_id uuid default null)
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
set search_path = ''
as $$
  with a as (
    select asg.id as aid, s.id as sid, s.venue_id as vid, s.service_date as d,
           asg.volunteer_id as volid, asg.position_id as posid,
           v.display_name as vname, v.is_active as vactive,
           p.name as pname, ve.name as venue_name
    from public.assignments asg
    join public.services s on s.id = asg.service_id
    join public.volunteers v on v.id = asg.volunteer_id
    join public.positions p on p.id = asg.position_id
    join public.venues ve on ve.id = s.venue_id
    where s.service_date between p_from and p_to
      and (p_venue_id is null or s.venue_id = p_venue_id)
  )
  select sid, aid, vid, d, volid, posid, 'inactive',
         vname || ' is no longer an active volunteer (' || pname || ' at ' || venue_name || ', ' || to_char(d, 'FMMonth FMDD') || ').'
  from a where not vactive
  union all
  select sid, aid, vid, d, volid, posid, 'not_qualified',
         vname || ' isn''t qualified for ' || pname || ' (' || venue_name || ', ' || to_char(d, 'FMMonth FMDD') || ').'
  from a
  where not exists (
    select 1 from public.volunteer_qualifications q where q.volunteer_id = a.volid and q.position_id = a.posid
  )
  union all
  select sid, aid, vid, d, volid, posid, 'away',
         vname || ' is marked Away on ' || to_char(d, 'FMMonth FMDD') || ' but is scheduled as ' || pname || ' at ' || venue_name || '.'
  from a
  where exists (
    select 1 from public.volunteer_availability av
    where av.volunteer_id = a.volid and av.service_date = a.d and not av.is_available
  )
  union all
  select sid, aid, vid, d, volid, posid, 'position_not_at_venue',
         pname || ' isn''t used at ' || venue_name || ' (' || vname || ', ' || to_char(d, 'FMMonth FMDD') || ').'
  from a
  where not exists (
    select 1 from public.venue_positions vp where vp.venue_id = a.vid and vp.position_id = a.posid
  );
$$;

revoke all on function public._schedule_problems(date, date, uuid) from public, anon, authenticated;

create function public.schedule_problems(p_from date, p_to date, p_venue_id uuid default null)
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
  where (select public.is_admin());
$$;

revoke all on function public.schedule_problems(date, date, uuid) from public, anon;
grant execute on function public.schedule_problems(date, date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Services: publishing, unpublishing, and what can't change
-- ---------------------------------------------------------------------------
create function public.services_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n          integer;
  first_msg  text;
  away_names text;
  venue      text;
begin
  if new.venue_id <> old.venue_id then
    raise exception 'A schedule can''t be moved to another venue. Create a new schedule for that venue instead.';
  end if;

  -- Moving a service to another Sunday must not put anyone on a day they are Away.
  if new.service_date <> old.service_date then
    select string_agg(v.display_name, ', ') into away_names
    from public.assignments a
    join public.volunteers v on v.id = a.volunteer_id
    join public.volunteer_availability av
      on av.volunteer_id = a.volunteer_id and av.service_date = new.service_date and not av.is_available
    where a.service_id = old.id;
    if away_names is not null then
      raise exception '% marked Away on %. Move them off first, or choose another Sunday.',
        away_names || case when position(',' in away_names) > 0 then ' are' else ' is' end,
        to_char(new.service_date, 'FMMonth FMDD');
    end if;
  end if;

  if old.status = 'draft' and new.status = 'published' then
    select count(*), min(p.message) into n, first_msg
    from public._schedule_problems(new.service_date, new.service_date, new.venue_id) p
    where p.service_id = new.id;
    if n > 0 then
      select name into venue from public.venues where id = new.venue_id;
      raise exception 'Fix % before publishing % for %: %',
        case when n = 1 then '1 problem' else n || ' problems' end,
        venue, to_char(new.service_date, 'FMMonth FMDD'), first_msg;
    end if;
    new.published_at := coalesce(new.published_at, now());
    new.published_by := (select auth.uid());
  elsif new.status = 'draft' then
    new.published_at := null;
    new.published_by := null;
  end if;

  return new;
end;
$$;

revoke all on function public.services_guard() from public, anon, authenticated;

create trigger services_guard
  before update on public.services
  for each row execute function public.services_guard();

-- ---------------------------------------------------------------------------
-- 5. Suggestions: qualified, active volunteers for a position on a service, with whether
--    they can be assigned and why not, ordered so the person who has served least recently
--    comes first. A recommendation only; the administrator chooses.
-- ---------------------------------------------------------------------------
create function public.suggest_volunteers(p_service_id uuid, p_position_id uuid)
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
      and (select public.is_admin())
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

revoke all on function public.suggest_volunteers(uuid, uuid) from public, anon;
grant execute on function public.suggest_volunteers(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Copy a schedule: reuse a venue's Sundays as a template for other Sundays. Always creates
--    drafts. Every assignment goes through the normal rules above; anyone who can't be placed
--    is reported, never forced. Source and target start dates must be a whole number of weeks
--    apart. The whole call succeeds or fails together.
-- ---------------------------------------------------------------------------
create function public.copy_schedule(
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
  if not (select public.is_admin()) then
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

revoke all on function public.copy_schedule(uuid, date, date, date) from public, anon;
grant execute on function public.copy_schedule(uuid, date, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Assignment history for one service: who was added or removed, by whom, and when.
-- ---------------------------------------------------------------------------
create index audit_logs_assignment_service_idx
  on public.audit_logs ((coalesce(new_data, old_data) ->> 'service_id'))
  where table_name = 'assignments';

create function public.assignment_history(p_service_id uuid)
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
    and (select public.is_admin())
  order by l.created_at desc, l.id desc;
$$;

revoke all on function public.assignment_history(uuid) from public, anon;
grant execute on function public.assignment_history(uuid) to authenticated;
