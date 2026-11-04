# CLAUDE.md — instructions for future Claude sessions

Read this, then [PROJECT_FOUNDATION.md](PROJECT_FOUNDATION.md) and [ARCHITECTURE.md](ARCHITECTURE.md), before changing anything. Full findings: [docs/PROJECT_AUDIT.md](docs/PROJECT_AUDIT.md).

## What this is

Worship-team scheduling app for Lipa New Hope Church. Being modernized in strict phases; target stack is React + TypeScript + Vite + Tailwind on Vercel with Supabase (Postgres/Auth/RLS) — the legacy FastAPI backend is to be removed.

## Current status

Phase 0 approved. **Phase 1 finished, awaiting the owner's approval and commit.** Next is Phase 2 (design), which needs branding assets from the owner. See [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).

## Workflow rules (from the owner)

- Work one phase at a time. Finish, test, update docs, summarize, give commit commands, **stop and wait for approval**.
- Do not change the UI before the design is approved (Phase 2 → 5).
- Never push, force-push, or commit without being asked. Never delete data or the original repos.
- Do not invent church scheduling rules; ask. Do not claim something works without running it.
- No secrets in frontend code; never read or print `.env` contents. Rules must be enforced in the database (RLS/constraints), not only in the UI.
- Keep Markdown docs in sync with the code.

## Confirmed scheduling rules

Every position allows multiple people; all positions optional; a person cannot serve at two venues on the same date; services are every Sunday; volunteers are created in-app (no existing list). Details: [PROJECT_FOUNDATION.md](PROJECT_FOUNDATION.md).

## Conventions

- Feature folders under `src/features/<feature>/`; shared code in `src/lib`, `src/services`, `src/types`.
- Strict TypeScript, no `any`; use `errorMessage(err, fallback)` for caught errors.
- Prettier + ESLint must pass: `npm run typecheck && npm run lint && npm run format:check && npm run build`.
- Commit style: `chore:`, `feat:`, `fix:`, `refactor:`, `style:`, `docs:`, `test:`.

## Gotchas

- `legacy/backend/` is reference-only (no auth, known bugs). Don't fix it; port its ideas.
- The Supabase MCP tools available in the audit session were linked to an **unrelated** project (subjects/requirements/game_scores). Do not write to it; confirm the project ref before any Supabase call.
- No Python on the dev machine's PATH, so the legacy backend cannot be run locally as-is.
- Shell is Git Bash on Windows: a leading `/` in curl URLs gets rewritten; don't `taskkill` node globally.
