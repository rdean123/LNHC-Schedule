-- A third role: the schedule maker. Added on its own because Postgres does not allow a new
-- enum value to be used in the same transaction that creates it; the permissions that use it
-- are in the next migration.

alter type public.app_role add value if not exists 'scheduler' before 'volunteer';
