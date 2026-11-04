# LNHC Schedule

Worship-team scheduling for Lipa New Hope Church (LNHC, Tangway, Garcia/Rosario): volunteers see when and where they serve; administrators build, check and publish the roster.

> **Status:** the screens, database rules and tests are built. Nothing is connected to a hosted Supabase project yet, so the real backend is **unverified**. You can try every screen now with sample data (below).

## Try it now (no backend needed)

```bash
npm install
npm run demo        # http://localhost:5173
```

Sign in with `rden@lnhc.example` (a volunteer), `scheduler@lnhc.example` (a schedule maker) or `admin@lnhc.example` (the administrator), any password. Try Download PDF on Schedules (pick up to three months). The demo uses the church's real November and December rosters and an in-memory stand-in for the backend, and a banner says so. Nothing is saved; reloading resets it.

## Tech

React 19, TypeScript (strict), Vite 8, Tailwind CSS 4, React Router, Lucide icons, jsPDF for the PDF export. Backend: Supabase (PostgreSQL with row level security, Auth, Edge Functions), deployed on Vercel.

## Setup for the real backend

Requires Node 20+ (developed on Node 24).

```bash
npm install
cp .env.example .env   # add your Supabase project URL and publishable key
npm run dev
```

Applying the database to a Supabase project, the first administrator, and the dashboard settings are listed in [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

## Commands

| Command                | What it does                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run dev`          | Dev server against the real backend (needs `.env`)                                              |
| `npm run demo`         | Dev server with sample data and no backend                                                      |
| `npm run build`        | Typecheck, then production build                                                                |
| `npm run build:demo`   | Build the demo (not for production)                                                             |
| `npm run typecheck`    | `tsc -b` (strict)                                                                               |
| `npm run lint`         | ESLint (includes the React Compiler rules)                                                      |
| `npm run format:check` | Prettier (check only); `npm run format` writes                                                  |
| `npm test`             | Everything below                                                                                |
| `npm run test:unit`    | Dates, roster building, PDF table                                                               |
| `npm run test:db`      | Database rules on in-memory Postgres (no Docker)                                                |
| `npm run test:e2e`     | The screens in a real browser against the demo, plus accessibility scans (needs Chrome or Edge) |

## Deployment

Target: Vercel for the site, Supabase for the backend (Phase 7). Never put a Supabase secret key or a database URL in a `VITE_` variable.

## Documentation

[CLAUDE.md](CLAUDE.md) · [PROJECT_FOUNDATION.md](PROJECT_FOUNDATION.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) · [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) · [SCHEDULING_RULES.md](SCHEDULING_RULES.md) · [USER_ROLES_AND_PERMISSIONS.md](USER_ROLES_AND_PERMISSIONS.md) · [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) · [CHANGELOG.md](CHANGELOG.md)
