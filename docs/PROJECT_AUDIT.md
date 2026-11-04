# LNHC Scheduling System — Phase 0 Audit

Date: 2026-11-04 · Scope: read-only inspection. No application code was changed. Companion files: [CURRENT_ARCHITECTURE.md](CURRENT_ARCHITECTURE.md), [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md).

## 1. What the system is today

A single-page React app plus a small FastAPI/PostgreSQL API that lets one (unauthenticated) person fill in a weekly roster for three worship venues — **LNHC**, **Tangway**, **Garcia/Rosario** — and export it to Excel. It is a spreadsheet replacement: one row per date, one dropdown per position, a "no one may serve twice on the same date" rule, and an XLSX download styled like the church's printed schedule.

There is no login, no notion of who a volunteer is beyond a name, no skills, no availability, no draft/publish, and no history.

## 2. How the real schedules are structured (from your three images)

| Venue | Period shown | Positions (columns) |
|---|---|---|
| LNHC | Nov–Dec 2026 | Song Leader, Back Up (2 names), Lead Guitarist, Acoustic, Bass Guitarist, Keyboard, Drummer (often 2 names), Sound Tech, Easy Worship (sometimes 2 names) |
| Tangway | Sep–Oct 2026 | Songleader, Musician, Multimedia, Sound Tech |
| Garcia/Rosario | Sep–Oct 2026 | Singer, Musicians |

What the images show that the current code does **not** handle:

1. **Several people in one position.** Drummer `Jireh/Miggy`, `Ves/Gab`; Easy Worship `Shay/Krisia`; Back Up always two. The current model stores exactly one member per column (backup has two hand-made columns).
2. **Optional positions.** LNHC "Acoustic" is deliberately blank (green cells) on Nov 8, Nov 22, Dec 13, Dec 20. Nothing marks a position as required vs optional.
3. **One shared volunteer pool across venues and roles.** From just these 3 months, people appear in several roles, which is exactly the "multiple qualifications" requirement:
   - Sica: Song Leader, Back Up, Keyboard (LNHC) and Musician (Tangway)
   - Denver: Song Leader, Acoustic, Bass · Natan: Back Up, Acoustic, Bass, Musician (Garcia/Rosario)
   - Jonas: Lead Guitar, Bass, Musician (Garcia/Rosario) · Ferl: Bass, Acoustic · David: Keyboard, Musician, Sound Tech · Jireh: Drummer, Musician · Airon: Sound Tech at Tangway and LNHC
   - These are *inferred from assignments*, not from any qualification list — I need the real list from you.
4. **Month-by-month tables** with a month title, a trailing note ("General Cleaning will be conducted after the rehearsal…") and green header `#92D050`. The XLSX export copies this for LNHC only.
5. **Every date is a Sunday**; Tangway and Garcia/Rosario share the same dates (Sep 13/20/27, Oct 11/18 — Oct 4 and Oct 25 are absent). I don't know whether the gaps mean "no service" or "not yet scheduled".
6. **Names are nicknames/first names** (Rden, Ves, Miggy, Oba, Jam…). Fine for display; matters for account matching.

## 3. What's good, what's not

**Retain (as ideas or assets)**
- The three venues and their position lists — as seed data, not as table schemas.
- The same-day double-booking idea (rule to be confirmed, see Q3).
- Month-grouped, green-header export layout and footer note — as the PDF/Excel export template.
- The church background image and `favicon.svg` (possible logo — to be checked against the Facebook branding).
- Vite + React + TypeScript + Tailwind + (probably) Zustand, as the frontend base.
- Responsive mobile card view idea; skeleton loading; per-row delete confirmation.

**Rewrite**
- Data model: replace 3 hardcoded tables with venues → services (dates) → positions → assignments, so a new position or venue is a data change, not a code change.
- Conflict/qualification/availability logic: one implementation, enforced in the database.
- `ScheduleTable.tsx` (554 lines): split into data hooks, roster grid, edit panel, export.
- Member management: currently add-only, with the new-member-not-in-dropdown bug (F1).
- Export: PDF + print stylesheet + per-venue/personal views.

**Remove**
- The FastAPI backend, once its (small) logic is ported and data migrated: its entire job is CRUD plus one date check, and it has no auth.
- `scripts/deleteMember.py`, committed `.pyc`, `html2canvas`, CDN ExcelJS `<script>`, `window.Buffer` hack (if Excel export is dropped), unused store actions/types, `App.css`.

## 4. Proposed architecture

**Recommendation: drop the Python backend; use Supabase for everything server-side.** Its logic is ~120 lines (one overlap query) and does not justify a separate service to host, secure and keep awake. This matches your stated preference, and I checked the existing logic first as you asked.

```
Browser (React/TS/Vite/Tailwind, hosted on Vercel)
   │  supabase-js (anon key + user JWT only)
   ▼
Supabase
 ├─ Auth            invite-only accounts, password reset
 ├─ Postgres        schema + constraints + triggers + RLS   ← single source of truth for rules
 ├─ RPC functions   e.g. suggest_volunteers(service, position), publish_schedule(...)
 ├─ Edge Function   invite user / set role (needs service-role key; never in browser)
 └─ Storage         (only if exporting/storing PDFs or logo; probably not needed)
```

Key decisions:
- **Rules live in Postgres**, not in React and not duplicated: foreign keys, a qualification check trigger on assignments, a uniqueness/overlap constraint for double-booking, RLS for who may write. The UI *reads* these results to show friendly messages and filter dropdowns.
- **Roles**: `admin`, `scheduler`, `volunteer` stored in a table the client cannot write; RLS checks it. Public sign-up cannot create privileged roles.
- **Draft vs published** is a status on the schedule; volunteers' RLS only sees published rows.
- **PDF**: generate in the browser (print-optimised layout / small library) — decide in Phase 2. No server needed.
- **Folder layout**: your proposed single-repo structure is good. Keep `supabase/migrations` as the only way schema changes.

Rough relational shape (finalised in Phase 3, not binding):
`profiles` · `user_roles` · `venues` · `positions` (catalog) · `venue_positions` (required?, how many people) · `volunteer_qualifications` · `volunteer_unavailability` · `services` (venue, date, time) · `schedules`/status · `assignments` (service, position, slot no., volunteer) · `announcements` · `audit_logs`.

## 5. Risks

1. **Production data is unknown to me.** I couldn't find the DB host/credentials. Migration needs an export (CSV/`pg_dump`) from you. Soft-deleted members referenced by old rows (D1) must be handled so history is kept.
2. **Supabase in this session is the wrong project.** The Supabase connection available to me points to an unrelated app (tables like `subjects`, `requirements`, `game_scores`). I only listed table names and will not write to it. A new Supabase project for LNHC should be created and linked before Phase 3.
3. **Free-tier Supabase pauses idle projects** after a period of inactivity; for a weekly-use church tool, consider whether that's acceptable.
4. **Account matching**: volunteers go by nicknames; existing `members` rows need to be linked to real people/emails during invite.

## 6. Open questions (answers change the design)

1. **Production DB:** where is it hosted, roughly how many schedule rows exist, and can you give me an export? Is the old Netlify site/backend to stay live during transition?
2. **Multiple people per position:** should Drummer / Easy Worship / Back Up allow N people per slot? Which positions allow how many?
3. **Same day, multiple venues:** may one person serve at two venues on the same date (e.g. Airon at Tangway and LNHC)? Current code forbids it. Same *time* only, or any time that day?
4. **Required vs optional positions** per venue (Acoustic looks optional; what else)?
5. **Services:** are all services Sunday-only? Do you want a time per service? What do missing dates (Oct 4, Oct 25) mean?
6. **Qualifications:** can you give me, per volunteer, the roles they can do? (I can draft it from the images for you to correct.)
7. **People:** who are the admin(s) and schedulers? How many volunteers, and do they all have email? Should nickname-only members be able to log in?
8. **Visibility:** may volunteers see everyone's assignments across all venues? (My default: yes, published only.)
9. **Availability meaning:** specific unavailable dates, or recurring weekly patterns too? Deadline before scheduling?
10. **Branding:** I can't reliably read Facebook from here. Please send the logo (is `frontend/public/favicon.svg` it?) and 2–3 screenshots of the page. 
11. **Language:** English only?

## 7. Revised phased plan

Your phases stand; adjustments from what I found:

| Phase | Adjustment |
|---|---|
| 1 Consolidation | The repos are **already merged** into one repo (`backend/`, `frontend/`, single commit, no nested `.git`). Remaining work: move to the single-root layout, add lint/format/scripts, make the frontend build run. **Don't fix backend bugs** — it's being replaced; park it under `legacy/backend/` until data migration is verified, then delete. |
| 2 Design | Needs the logo/screenshots (Q10) and the answers to Q2–Q5 so mockups show the real roster (multi-person slots, optional positions). Checkpoint after mockups, as you specified. |
| 3 DB/Auth | Needs the new Supabase project and Q1/Q6/Q7. Migrations first, RLS tests with SQL, then auth + profiles + qualifications + availability. |
| 4 Scheduling | Rules in SQL + RPC suggestions; test each rule listed in your §7. Port the old data here only after your approval. |
| 5–8 | As written. |

Phase 0 files (`docs/*.md`) are untouched by git — nothing is committed. Suggested commit when you approve:

```
git add docs/
git commit -m "docs: add phase 0 project audit"
```
