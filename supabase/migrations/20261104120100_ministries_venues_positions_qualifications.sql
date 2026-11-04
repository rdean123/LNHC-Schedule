-- Ministries, venues, positions, and who is qualified for what.
--
-- Venues (LNHC, Tangway, Garcia/Rosario) choose which positions they use and in what order
-- (venue_positions). Qualifications belong to a volunteer and a position, not to a venue.
-- All positions are optional and can hold several people, so there is no required/maximum flag.

create table public.ministries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.venues (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(btrim(name)) between 1 and 60),
  address    text check (address is null or char_length(address) <= 200),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

create table public.positions (
  id          uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries (id) on delete restrict,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (ministry_id, name)
);

create trigger positions_set_updated_at
  before update on public.positions
  for each row execute function public.set_updated_at();

-- Which positions a venue uses, in column order, with an optional venue-specific label
-- (for example Garcia/Rosario calls the Musician position "Musicians").
create table public.venue_positions (
  venue_id    uuid not null references public.venues (id) on delete cascade,
  position_id uuid not null references public.positions (id) on delete restrict,
  label       text check (label is null or char_length(btrim(label)) between 1 and 60),
  sort_order  integer not null default 0,
  primary key (venue_id, position_id)
);

create index venue_positions_position_id_idx on public.venue_positions (position_id);

create table public.volunteer_qualifications (
  volunteer_id uuid not null references public.volunteers (id) on delete cascade,
  position_id  uuid not null references public.positions (id) on delete restrict,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (volunteer_id, position_id)
);

create index volunteer_qualifications_position_id_idx
  on public.volunteer_qualifications (position_id);
