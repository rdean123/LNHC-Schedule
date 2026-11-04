# Development Roadmap

| Phase | Scope                                                                           | Status                                          |
| ----- | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| 0     | Audit (`docs/PROJECT_AUDIT.md`, `CURRENT_ARCHITECTURE.md`, `TECHNICAL_DEBT.md`) | Done, approved 2026-11-04                       |
| 1     | Consolidation and cleanup                                                       | **Done — awaiting approval/commit**             |
| 2     | Design research, design system, mockups                                         | Not started (needs logo + Facebook screenshots) |
| 3     | Supabase schema, migrations, auth, RLS, profiles, qualifications, availability  | Not started (needs a new Supabase project)      |
| 4     | Scheduling engine and rules                                                     | Not started                                     |
| 5     | UI implementation                                                               | Blocked on design approval                      |
| 6     | QA                                                                              | Not started                                     |
| 7     | Deployment (Vercel + Supabase)                                                  | Not started                                     |
| 8     | Final review and handover                                                       | Not started                                     |

## Known issues (carried from the audit)

All items in [docs/TECHNICAL_DEBT.md](docs/TECHNICAL_DEBT.md) still exist; Phase 1 only fixed hygiene items (lint `any` errors, strict TS, unused files/deps, CDN script, `buffer` dependency, title typo). Not fixed on purpose, because the code is being replaced: S1 (no auth), D1–D8, L1–L7, F1–F6.

`npm audit`: 20 moderate advisories remain (8 in production dependencies, mostly transitive via ExcelJS); no high severity after `npm audit fix`.

## Next steps

1. Approve and commit Phase 1.
2. Provide branding assets, then Phase 2.
3. Create a Supabase project for LNHC (the Supabase connection available to Claude in the audit session belonged to an unrelated project).
