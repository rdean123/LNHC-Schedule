# Current Architecture (as of Phase 0 audit, 2026-11-04)

Describes the code exactly as committed in `ea7eb52 Initial monorepo setup` (branch `development`). Nothing was run; this is from reading the source.

## Layout

```
LNHC-Schedule/
├── backend/    FastAPI + SQLModel + PostgreSQL (psycopg2)
│   ├── main.py            app, CORS, create_all on startup
│   ├── db.py              engine from DATABASE_URL (echo=True)
│   ├── models.py          Member + 3 schedule tables
│   ├── schemas/schemas.py Pydantic create/response models
│   ├── routes.py          all endpoints (338 lines)
│   ├── services/scheduling_service.py   double-booking check
│   └── scripts/deleteMember.py          manual hard-delete CLI
└── frontend/   React 19 + Vite 8 + TS 6 + Tailwind 4 + Zustand
    └── src/
        ├── App.tsx                      page: header, MemberManagement, 3x ScheduleTable
        ├── components/ScheduleTable.tsx 554 lines: edit table, view mode, XLSX export, save
        ├── components/ConflictDropdown.tsx  <select> that disables conflicting members
        ├── components/MemberManagement.tsx  add-member form + roster chips
        ├── services/client.ts           fetch wrappers (VITE_API_URL)
        └── types/{types.ts,useScheduleStore.ts}  types, location configs, Zustand store
```

Deployment evidence: CORS allows `https://lnhc-pnw-sched.netlify.app` (frontend on Netlify). Backend host and database host are **unknown** (no backend `.env` in the repo; `frontend/.env` exists and is git-ignored, not read).

## Data model

`members(id uuid, name, role?, is_active)` — `role` is never written or read.

Three independent schedule tables, one column per position, all nullable, all storing a `members.id`:

| Table | Position columns |
|---|---|
| `lnhc_schedules` | song_leader, backup_1, backup_2, lead_guitar, acoustic, bass, keyboard, drummer, sound_tech, easy_worship |
| `tangway_schedules` | song_leader, musician, multimedia, sound_tech |
| `garcia_rosario_schedules` | singer, musicians |

Each has `id uuid`, `date`, `created_at`, and an index on `date`. Foreign keys to `members` exist **only** on `lnhc_schedules.backup_1_id` and `backup_2_id`. No unique constraints. No draft/published state, service time, or ministry concept.

## API (no authentication on any endpoint)

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/members` | GET returns active only; POST takes a raw `dict` body |
| DELETE | `/members/{id}` | soft delete (`is_active=false`) |
| GET | `/availability` | "is this member unbooked that date" — unused by frontend |
| GET/POST | `/lnhc`, `/tangway`, `/garcia-rosario` | GET returns all rows, unordered |
| PUT/DELETE | `/{loc}/{id}` | update (full payload) / hard delete |

Create/update flow: collect non-null member ids → `SchedulingService.validate_members` → for each id, query all three tables for that date (excluding the row being edited) → 400 `"Member already scheduled on this date"` if found → insert/update. The check and the write are separate statements with no lock or DB constraint.

## Frontend flow

1. `App` mounts → store `fetchMembers` + `fetchSchedules` (each `ScheduleTable` also refetches its own location).
2. Store holds `members` and `schedules[location] = [{id, date, assignments{roleKey: memberId}}]`. DB rows are mapped by stripping `_id` from column names.
3. Edit mode: rows are editable `<input type=date>` + one `ConflictDropdown` per role. New rows get `temp-<uuid>` ids. Conflict greying is computed client-side from the store (same date, any location, any role).
4. "Save Changes" loops over rows sequentially: `PUT` for existing, `POST` for temp rows. Then refetch, `alert()`, switch to view mode.
5. "View Mode" is a local toggle that hides editing controls — it is **not** a published state; everything is visible and editable by anyone.
6. Export builds an XLSX with ExcelJS (grouped by month, green header `#92D050`, fixed footer note) — the button is labelled "CSV".

## Auth, hosting, tooling

- Auth: none. Anyone with the URL can create/edit/delete members and schedules.
- Tests: none. CI: none. Backend lint/format: none. Root scripts: none.
- Frontend lint: ESLint config present. Frontend README is the Vite template default.
