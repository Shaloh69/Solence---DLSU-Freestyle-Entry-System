# Solence — work state

Read first every session (auto-injected by the SessionStart hook).
Keep under 60 lines. Update at every gate result.

## Now
- Phase: **0 — Harness** (docs/REVAMP-PLAN.md §3)
- Item: `0.1 gate runner + hooks verified on the server PC (Windows)`
- Status: in-progress
- Last gate (audit sandbox, 2026-10-16): fast PASSED (hygiene, server typecheck+95 tests, client typecheck, design-refs). Full FAILED only on client-build: `next/font/google` can't fetch fonts offline → fixed by 0.2.

## Next (in order, one at a time)
1. 0.2 Self-host Archivo (`@fontsource-variable/archivo/wdth.css`, DESIGN.md §3); drop next/font/google. Then husky pre-commit → `node scripts/gate.mjs` (same gate outside Claude Code)
2. 0.3 `assets:fetch` + `check:assets` (manifest, sha256, gltf-validator, gltf-transform inspect, texture checks)
3. 0.4 Playwright project: real-plan E2E skeleton on 1 CubiCasa plan
4. 0.5 `refs:capture` (Playwright captures registry URLs) + side-by-side report
5. 0.6 `check:tokens` (computed-style scan vs DESIGN.md), `test:a11y` (axe), `check:motion`, `check:render`, `check:pdf`
6. Flip each step to `required: true` in scripts/gate.config.json as it lands.

## Passed
- (none yet)

## Decisions
- 2026-10-16: DESIGN.md v2 "Conductor" replaces v1 entirely (Archivo, sheet/conduit, ground-green action, copper highlight).
- 2026-10-16: CubiCasa5K is CC BY-NC-SA 4.0 → test-only, never shipped.
- 2026-10-16: Perf/motion budgets measured on the server PC GPU only.

## Open questions for the user
- Domain choice (GitHub Student Pack vs DigitalPlat) — needed before Phase D.
- Real PH plan set (with permission) for the permit-sheet reference + demo house.
