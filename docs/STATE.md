# Solence — work state

Read first every session (auto-injected by the SessionStart hook).
Keep under 60 lines. Update at every gate result.

## Now
- Phase: **0 / W — Harness + wiring realism** (docs/REVAMP-PLAN.md §4, docs/WIRING-AUDIT.md)
- Item: `W1 real-plan corpus (ResPlan) + engine runs on real plans`
- Status: in-progress
- Last gate: full PASSED 2026-10-21 (after 0.2)

## Next (in order, one at a time)
1. W1 ResPlan converter + pinned test-split plans + server tests over every real plan
2. W2 PEC sizing: small-conductor limits (2.40.1.4(D)), 60 °C termination column ≤100 A, EGC per Table 2.50.6.13, PH 230 V system as default
3. W3 Wiring topology: device-to-device circuit runs (home run + chain), L/N/G conductor set, wire bill of materials
4. W4 Layer views: presets (electrical/power/lighting/furniture/architectural/all) + lock; E2E on a real plan, 2D DOM + 3D pixel diff
5. 0.3 `assets:fetch` + `check:assets` (Khronos sample assets reachable via GitHub; Poly Haven/ambientCG on the server PC)
6. 0.4 Playwright project wired into the gate (W4 seeds it)
7. 0.5 `refs:capture` + side-by-side report
8. 0.6 `check:tokens`, `test:a11y`, `check:motion`, `check:render`, `check:pdf`

## Passed
- 0.2 (2026-10-21) self-hosted current fonts via next/font/local + @fontsource (no visual change; Archivo waits for Phase C); `.githooks/pre-commit` runs the full gate; `npm install` sets core.hooksPath. Gate: full PASSED.

## Decisions
- 2026-10-16: DESIGN.md v2 "Conductor" replaces v1 entirely.
- 2026-10-16: CubiCasa5K is CC BY-NC-SA 4.0 → test-only, never shipped.
- 2026-10-16: Perf/motion budgets measured on the server PC GPU only.
- 2026-10-21: 0.2 self-hosts the v1 fonts, not Archivo — a typeface swap is a visual change and belongs to Phase C.
- 2026-10-21: Real-plan corpus = ResPlan (17k residential plans, data CC BY 4.0, GitHub-hosted). Converted JSON for pinned test plans is committed with attribution; source zip pinned by sha256.
- 2026-10-21: ResPlan pickle loaded only through an allowlist unpickler (shapely from_wkb + numpy scalar/dtype).
- 2026-10-21: User asked for PEC alignment → treated as the go-ahead for PEC data changes in W2. Every new number stays PEC-VERIFY with its section.

## Open questions for the user
- Domain choice (GitHub Student Pack vs DigitalPlat) — needed before Phase D.
- Real PH plan set (with permission) for the permit-sheet reference + demo house.
- Official PEC 2017 text: values so far come from an unofficial transcription (filipinoengineer wiki); a licensed EE must confirm.
