-- Reference data taken from the church's actual schedules (LNHC Nov-Dec 2026, Tangway and
-- Garcia/Rosario Sep-Oct 2026). No volunteers, qualifications, or schedules: those start empty
-- and are entered in the app. Safe to re-run.

insert into public.ministries (name) values ('Worship')
on conflict (name) do nothing;

insert into public.venues (name, sort_order) values
  ('LNHC', 1),
  ('Tangway', 2),
  ('Garcia/Rosario', 3)
on conflict (name) do nothing;

insert into public.positions (ministry_id, name, sort_order)
select m.id, p.name, p.sort_order
from public.ministries m
cross join (values
  ('Song Leader', 1),
  ('Back Up', 2),
  ('Lead Guitarist', 3),
  ('Acoustic', 4),
  ('Bass Guitarist', 5),
  ('Keyboard', 6),
  ('Drummer', 7),
  ('Sound Tech', 8),
  ('Easy Worship', 9),
  ('Musician', 10),
  ('Multimedia', 11),
  ('Singer', 12)
) as p (name, sort_order)
where m.name = 'Worship'
on conflict (ministry_id, name) do nothing;

-- Which positions each venue uses, in the order of its printed schedule.
insert into public.venue_positions (venue_id, position_id, label, sort_order)
select v.id, p.id, x.label, x.sort_order
from (values
  ('LNHC',           'Song Leader',    null,        1),
  ('LNHC',           'Back Up',        null,        2),
  ('LNHC',           'Lead Guitarist', null,        3),
  ('LNHC',           'Acoustic',       null,        4),
  ('LNHC',           'Bass Guitarist', null,        5),
  ('LNHC',           'Keyboard',       null,        6),
  ('LNHC',           'Drummer',        null,        7),
  ('LNHC',           'Sound Tech',     null,        8),
  ('LNHC',           'Easy Worship',   null,        9),
  ('Tangway',        'Song Leader',    null,        1),
  ('Tangway',        'Musician',       null,        2),
  ('Tangway',        'Multimedia',     null,        3),
  ('Tangway',        'Sound Tech',     null,        4),
  ('Garcia/Rosario', 'Singer',         null,        1),
  ('Garcia/Rosario', 'Musician',       'Musicians', 2)
) as x (venue, position, label, sort_order)
join public.venues v on v.name = x.venue
join public.positions p on p.name = x.position
on conflict (venue_id, position_id) do nothing;
