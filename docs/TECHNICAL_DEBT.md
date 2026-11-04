# Technical Debt & Defects (Phase 0 audit, 2026-11-04)

Found by reading the code. **Nothing was executed**, so items marked _(verify)_ are suspected and must be reproduced before being treated as fact. Severity: **H** = data loss/security/wrong output, **M** = real user-facing bug or high maintenance cost, **L** = hygiene.

## Security

| #   | Sev | Finding                                                                                                                              | Where                       |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| S1  | H   | No authentication or authorization on any endpoint or screen. Anyone with the URL can add members, edit, or delete schedules.        | `routes.py`, whole frontend |
| S2  | H   | Hard-delete of schedules is one `DELETE` call, no auth, no audit trail, no undo.                                                     | `routes.py` delete_*        |
| S3  | M   | `POST /members` accepts an untyped `dict`; no length/duplicate validation.                                                           | `routes.py:create_member`   |
| S4  | M   | `echo=True` logs every SQL statement (incl. member ids) in production.                                                               | `db.py`                     |
| S5  | L   | CORS origin list hardcoded in source.                                                                                                | `main.py`                   |
| S6  | L   | `.pyc` file is committed (`backend/scripts/__pycache__/…`); `.gitignore` patterns (`__pycache__/*`) don't cover subfolders reliably. | repo                        |

## Data integrity

| #   | Sev | Finding                                                                                                                                                                                                               | Where                                                  |
| --- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| D1  | H   | Soft-deleted members vanish from `GET /members`, so past schedule rows that reference them render **blank names**. History is silently lost in the UI.                                                                | `routes.py:get_members`, `ScheduleTable.getMemberName` |
| D2  | H   | Foreign keys to `members` exist only on `backup_1_id`/`backup_2_id`. All other role columns accept any UUID (orphans possible).                                                                                       | `models.py`                                            |
| D3  | H   | Double-booking check is check-then-write with no transaction lock or DB constraint → two concurrent saves can both pass.                                                                                              | `scheduling_service.py`, `routes.py`                   |
| D4  | M   | Frontend "Save Changes" saves row-by-row in a loop. If row 3 fails (e.g. conflict), rows 1–2 are already saved and the rest are not; user sees one alert. Not atomic.                                                 | `ScheduleTable.handleSave`                             |
| D5  | M   | No `updated_at`, no history of who changed what.                                                                                                                                                                      | `models.py`                                            |
| D6  | M   | Schema is created by `SQLModel.metadata.create_all` on startup. No migrations, so schema changes can't be reproduced or rolled back.                                                                                  | `main.py`                                              |
| D7  | M   | A slot holds exactly one member, but the real schedules put **two people in one cell** (Drummer "Jireh/Miggy", Easy Worship "Shay/Krisia", Back Up "Cyril/Moises"). The model can't represent this except for backup. | see `PROJECT_AUDIT.md` §3                              |
| D8  | M   | `GET` list endpoints have no `ORDER BY`, no date filter, no pagination; ordering in the UI is arbitrary and grows unbounded.                                                                                          | `routes.py`                                            |
| D9  | L   | `datetime.utcnow` (deprecated), naive timestamps.                                                                                                                                                                     | `models.py`                                            |

## Scheduling logic

| #   | Sev | Finding                                                                                                                                                                                | Where                                          |
| --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| L1  | H   | **No role qualification.** Every dropdown lists every active member; nothing stops a drummer being put on keyboard. (`members.role` exists but is unused.)                             | `ConflictDropdown`, `models.py`                |
| L2  | M   | "Availability" only means "not already booked that date". Members cannot declare unavailability.                                                                                       | `scheduling_service.py`                        |
| L3  | M   | Same-date check applies across all three locations. Whether one person may serve two locations on the same day is **unconfirmed** (see open questions) — rule may be wrong either way. | `_has_conflict`, `isMemberAssignedElsewhere`   |
| L4  | M   | Same-row duplicates (one person in two roles) are blocked only in the frontend; the backend would accept them on create.                                                               | `ConflictDropdown` vs `routes.py`              |
| L5  | M   | Conflict rules are duplicated in two places (Python and TS) and can drift.                                                                                                             | `scheduling_service.py`, `useScheduleStore.ts` |
| L6  | M   | Rows saved with no date are silently skipped by `handleSave`; if some rows have dates and others don't, the blank-date rows stay unsaved without warning.                              | `ScheduleTable.handleSave`                     |
| L7  | L   | `PUT` uses `schedule_id: str` with `session.get(Model, str)` against a UUID PK. May raise or work depending on SQLAlchemy/psycopg2 version. _(verify)_                                 | `routes.py` update_*                           |

## Frontend defects

| #   | Sev | Finding                                                                                                                                                                                                                                                                               | Where                                             |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| F1  | M   | Adding a member in `MemberManagement` updates only its local state, not the Zustand store, so the new member **does not appear in schedule dropdowns until a page reload**. Members are fetched/held in two places.                                                                   | `MemberManagement.tsx` vs `useScheduleStore.ts`   |
| F2  | M   | `fetchSchedules` copies every truthy non-`id`/`date` field into `assignments`, including `created_at`.                                                                                                                                                                                | `useScheduleStore.ts`                             |
| F3  | M   | `new Date('YYYY-MM-DD')` parses as UTC; in timezones west of UTC dates display one day early. Fine in the Philippines, wrong for anyone abroad. _(verify)_                                                                                                                            | `ScheduleTable.formatDate`, export                |
| F4  | M   | Button says "CSV" but exports `.xlsx`; the file name is always `Church_Deployment_Schedule.xlsx`; merged ranges are hardcoded to `A:J` even for 4-column locations; the footer note is hardcoded for all locations.                                                                   | `exportToExcelFormat`                             |
| F5  | M   | `alert()` / `window.confirm()` for all feedback; no toasts, no inline errors; errors only `console.error`.                                                                                                                                                                            | throughout                                        |
| F6  | M   | "View Mode" is not a published state. All edit controls are one click away for any visitor.                                                                                                                                                                                           | `ScheduleTable`                                   |
| F7  | L   | `ScheduleTable.tsx` is 554 lines mixing data loading, saving, export, skeletons, and two layouts (mobile + desktop duplicated, ×2 for edit and view).                                                                                                                                 | `ScheduleTable.tsx`                               |
| F8  | L   | `window.Buffer` polyfill and `buffer` import; `buffer` isn't in `package.json` dependencies. ExcelJS is bundled **and** loaded from a CDN `<script>` in `index.html`. `html2canvas` is installed but unused.                                                                          | `ScheduleTable.tsx`, `index.html`, `package.json` |
| F9  | L   | Dead/unused: store `addMember`/`deleteMember`/`setMembers`, `deleteMember` client call (UI commented out → no way to remove a member from the UI), `LNHCId`/`TangwayId`/`GarciaRosarioId` types (names don't match the real keys), `isLoading` per table duplicated fetch, `App.css`. | various                                           |
| F10 | L   | Store file lives in `types/`; `any` used widely; `LOCATION_CONFIGS` duplicates backend column lists.                                                                                                                                                                                  | structure                                         |
| F11 | L   | Background image imported from `../public/` (works but nonstandard).                                                                                                                                                                                                                  | `App.tsx`                                         |

## Backend hygiene

| #   | Sev | Finding                                                                                                                                                                  |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | L   | `get_session` defined twice (`main.py`, `routes.py`); `main.py` has unused imports; `@app.on_event("startup")` is deprecated.                                            |
| B2  | L   | Three near-identical copies of create/update/delete per location (≈250 lines of repetition); adding a role means editing model, schema, route, service, frontend config. |
| B3  | L   | `scripts/deleteMember.py` hard-deletes (would fail on the two backup FKs) and contradicts the soft-delete endpoint.                                                      |
| B4  | L   | No tests, no linter/formatter, no root run scripts, CRLF line endings mixed.                                                                                             |
| B5  | L   | _(Resolved in Phase 1)_ The npm versions I doubted do exist: `npm ci` installed and the app built. Python dependency versions were not checked.                          |

## Not assessed (blocked)

- Production database contents and row counts — no credentials/host available in the repo. The Supabase connection available in this session belongs to an unrelated project and was **not** used.
- Whether the backend runs: no Python on PATH and no database credentials. (The frontend was built and served successfully in Phase 1.)
