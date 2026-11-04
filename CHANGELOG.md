# Changelog

## Unreleased — Phase 1: consolidation and cleanup

### Changed

- Frontend moved from `frontend/` to the repository root; legacy API moved from `backend/` to `legacy/backend/` (history preserved with `git mv`).
- Source reorganized by feature: `src/app`, `src/features/{scheduling,volunteers}`, `src/services/api.ts`, `src/lib`, `src/types`. Imports updated; behavior unchanged.
- Package renamed `lnhc-schedule` v0.1.0. TypeScript `strict` enabled. Page title typo fixed ("LPNHC" → "LNHC").
- Replaced 11 `any` usages with real types; added `errorMessage()` helper.
- Code formatted with Prettier.

### Added

- Root scripts: `typecheck`, `lint:fix`, `format`, `format:check`. Prettier, `eslint-config-prettier`, `.editorconfig`, `.env.example`.
- `buffer` as an explicit dependency (it was imported but undeclared).
- Documentation: README, PROJECT_FOUNDATION, ARCHITECTURE, DEVELOPMENT_ROADMAP, CHANGELOG, CLAUDE.md; Phase 0 audit in `docs/`.

### Removed

- Unused: `html2canvas`, CDN ExcelJS `<script>`, `App.css`, Vite template assets (`react.svg`, `vite.svg`, `hero.png`), duplicate background images, `public/icons.svg`, committed `.pyc`, Vite template README.

### Security

- `npm audit fix`: 29 advisories (7 high) → 20 moderate, 0 high.

### Database

- None. No schema or data changes.
