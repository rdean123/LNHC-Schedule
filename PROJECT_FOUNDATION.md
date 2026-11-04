# Project Foundation

## Purpose

Let the worship team of Lipa New Hope Church plan who serves in which position each Sunday at each venue, and let volunteers see, download and print the result — with fewer mistakes than a spreadsheet.

## Objectives

1. Make scheduling fast and hard to get wrong.
2. Volunteers can log in and immediately see when they serve, in what position, and with whom.
3. Only qualified and available people can be assigned.
4. Reliable and maintainable by someone who wasn't in the original conversation.

## Users

| User          | Needs                                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| Administrator | Everything, including accounts and permissions                                  |
| Scheduler     | Create/edit/publish schedules, manage volunteers' qualifications                |
| Volunteer     | View published schedules, see own assignments, set availability, download/print |

(Administrator vs. Scheduler split is proposed; confirm in Phase 3.)

## Venues and positions (from the church's schedule images)

| Venue          | Positions                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| LNHC           | Song Leader, Back Up, Lead Guitarist, Acoustic, Bass Guitarist, Keyboard, Drummer, Sound Tech, Easy Worship |
| Tangway        | Song Leader, Musician, Multimedia, Sound Tech                                                               |
| Garcia/Rosario | Singer, Musicians                                                                                           |

## Rules confirmed by the owner (2026-11-04)

- **Every position can hold more than one person** (e.g. Drummer "Jireh/Miggy").
- **All positions are optional.** A position may be left empty on any date.
- **One person may not serve at two venues on the same date.** (Not allowed.)
- **Services are every Sunday.** All Sundays are schedulable; gaps in the old images carry no meaning.
- **There is no existing volunteer/qualification list.** Volunteers are added in the app by an authorized user. Qualifications will be entered per volunteer.

## Functional requirements (target)

Authentication with invite-only accounts; roles (admin/scheduler/volunteer); volunteer profiles with multiple qualifications; availability; schedules per venue/date with draft→published; assignment validation (qualified, available, no same-day double booking, no duplicates); suggestions (recommendations only); PDF/print/Excel export matching the church's layout; announcements; audit log.

## Non-functional requirements

Strict TypeScript; rules enforced in the database (RLS + constraints), never only in the UI; no secrets in frontend code; accessible and responsive UI; reproducible schema via migrations; documentation kept in sync with code.

## Limitations / out of scope (for now)

No automatic scheduling (suggestions only); English only (unconfirmed); notifications beyond announcements not planned.

## Open questions

Unresolved items from the audit: where the production database is hosted and whether its data must be migrated; Admin/Scheduler split; who the first admin is; branding assets (logo, Facebook screenshots); availability model (specific dates vs. recurring). See [docs/PROJECT_AUDIT.md](docs/PROJECT_AUDIT.md) §6.
