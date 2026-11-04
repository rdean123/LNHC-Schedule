# Architecture

## Current (end of Phase 1)

Single repository, Vite project at the root.

```
LNHC-Schedule/
├── src/
│   ├── main.tsx
│   ├── app/App.tsx                          page shell
│   ├── features/
│   │   ├── scheduling/                      ScheduleTable, ConflictDropdown, useScheduleStore
│   │   └── volunteers/                      MemberManagement
│   ├── services/api.ts                      fetch client for the legacy API (VITE_API_URL)
│   ├── lib/errors.ts                        errorMessage()
│   ├── types/types.ts                       shared types + per-venue position config
│   └── index.css                            Tailwind import
├── public/                                  favicon.svg, lnhcbg.jpg
├── legacy/backend/                          original FastAPI app (reference + data migration only)
├── docs/                                    Phase 0 audit
└── *.md                                     project documentation
```

Data flow: React components → Zustand store → `services/api.ts` → legacy FastAPI → PostgreSQL. No authentication. Details of the legacy system: [docs/CURRENT_ARCHITECTURE.md](docs/CURRENT_ARCHITECTURE.md).

Layout is by feature; files were moved with `git mv`, imports updated, no behavior changed.

## Target (decided in Phase 0, details in Phases 2–3)

```
Browser (React/TS/Tailwind on Vercel) ── supabase-js (anon key + user JWT) ──► Supabase
                                                                              ├─ Auth (invite-only)
                                                                              ├─ Postgres: tables, constraints, triggers, RLS
                                                                              ├─ RPC functions (suggestions, publish)
                                                                              └─ Edge Functions (invite user / set role — service-role key stays server-side)
```

- The Python backend is removed after its data is migrated.
- Business rules (qualification, same-day double booking, who may write) live in Postgres once; the UI shows friendly messages from the database errors.
- Schema changes only through `supabase/migrations/`.
- Target folders (`features/authentication`, `availability`, `ministries`, `announcements`, `administration`, `components/ui`, `hooks`, `lib/supabase`, `supabase/`) are created when a phase needs them, not before.

## Deployment

Current: Netlify (frontend); legacy backend host unknown. Target: Vercel + Supabase, configured in Phase 7.
