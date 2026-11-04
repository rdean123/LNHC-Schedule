-- Availability, services (one venue on one Sunday), assignments, announcements.
--
-- A "service" is one venue on one Sunday and is draft or published. Publishing a month is
-- publishing each of its Sundays. This keeps one source of truth instead of a separate
-- schedules table.
--
-- Phase 4 adds the checks that need business logic (qualification, availability, position
-- belongs to venue). The rule that can be a plain constraint is enforced here: a person has
-- at most one assignment per Sunday, across all venues and positions.

create table public.volunteer_availability (
  volunteer_id uuid not null references public.volunteers (id) on delete cascade,
  service_date date not null,
  is_available boolean not null,
  note         text check (note is null or char_length(note) <= 200),
  updated_at   timestamptz not null default now(),
  primary key (volunteer_id, service_date),
  constraint availability_is_sunday check (extract(isodow from service_date) = 7)
);

create index volunteer_availability_service_date_idx
  on public.volunteer_availability (service_date);

create trigger volunteer_availability_set_updated_at
  before update on public.volunteer_availability
  for each row execute function public.set_updated_at();

create table public.services (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete restrict,
  service_date date not null,
  status       public.publish_status not null default 'draft',
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  note         text check (note is null or char_length(note) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint services_is_sunday check (extract(isodow from service_date) = 7),
  constraint services_published_has_timestamp check ((status = 'published') = (published_at is not null)),
  unique (venue_id, service_date),
  -- lets assignments carry the date and keep it identical to the service's date
  unique (id, service_date)
);

create index services_service_date_idx on public.services (service_date);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

create table public.assignments (
  id           uuid primary key default gen_random_uuid(),
  service_id   uuid not null,
  service_date date not null,
  position_id  uuid not null references public.positions (id) on delete restrict,
  volunteer_id uuid not null references public.volunteers (id) on delete restrict,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (service_id, service_date)
    references public.services (id, service_date) on delete cascade on update cascade,
  -- One assignment per person per Sunday: not two venues, not two positions.
  constraint one_assignment_per_person_per_sunday unique (volunteer_id, service_date)
);

create index assignments_service_id_idx on public.assignments (service_id);
create index assignments_position_id_idx on public.assignments (position_id);

create table public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  body         text not null check (char_length(btrim(body)) between 1 and 2000),
  venue_id     uuid references public.venues (id) on delete cascade,
  is_pinned    boolean not null default false,
  published_at timestamptz,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index announcements_venue_id_idx on public.announcements (venue_id);

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();
