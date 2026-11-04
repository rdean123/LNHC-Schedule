# LNHC Schedule

Worship-team scheduling for Lipa New Hope Church (LNHC, Tangway, Garcia/Rosario).

> **Status: Phase 1 complete (repository consolidated).** The app still behaves exactly like the original: it talks to the legacy FastAPI backend (now in `legacy/backend/`). It will be replaced by Supabase in Phase 3 and redesigned in Phases 2 and 5. See [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).

## Tech

- **Now:** React 19, TypeScript (strict), Vite 8, Tailwind CSS 4, Zustand, ExcelJS. Legacy backend: FastAPI + SQLModel + PostgreSQL.
- **Target:** the same frontend plus Supabase (Postgres, Auth, RLS, Edge Functions), deployed on Vercel. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Setup

Requires Node 20+ (developed on Node 24).

```bash
npm install
cp .env.example .env     # set VITE_API_URL to the legacy backend
npm run dev              # http://localhost:5173
```

## Commands

| Command                | What it does                                     |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Vite dev server                                  |
| `npm run build`        | Typecheck, then production build                 |
| `npm run typecheck`    | `tsc -b` (strict)                                |
| `npm run lint`         | ESLint                                           |
| `npm run format`       | Prettier (write)                                 |
| `npm run format:check` | Prettier (check only)                            |
| `npm run preview`      | Serve the production build                       |
| `npm run test:db`      | Database rules on in-memory Postgres (no Docker) |

## Legacy backend (temporary)

`legacy/backend/` is the original API, kept untouched for reference and for the data migration. It needs a PostgreSQL `DATABASE_URL` in `legacy/backend/.env`. Install and start (not re-verified in Phase 1):

```bash
cd legacy/backend
pip install -r requirements.txt
uvicorn main:app --reload
```

It has no authentication and will be deleted after the data migration is verified.

## Deployment

Currently: frontend on Netlify (`lnhc-pnw-sched.netlify.app`), legacy backend host unknown. Target: Vercel + Supabase (Phase 7).

## Documentation

[CLAUDE.md](CLAUDE.md) · [PROJECT_FOUNDATION.md](PROJECT_FOUNDATION.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) · [CHANGELOG.md](CHANGELOG.md) · audit in [docs/](docs/)
