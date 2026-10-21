# Solence — work state

Read first every session (auto-injected by the SessionStart hook).
Keep under 60 lines. Update at every gate result.

## Now
- Phase: **0 — Harness**
- Item: `0.1b FormLabs3B on the tailnet: OpenSSH, clone, gate, vision service reachable`
- Status: in-progress (manual part first: docs/MACHINES.md §1, §2, §4 at FormLabs3B)
- Last gate: GATE PASSED · full · 2026-10-21T11:58:32.859Z (laptop)
- Progress: `npm run progress` (docs/ROADMAP.json is the source; never estimate by hand)

## Next (in order, one at a time — prompts in docs/PROMPTS.md)
1. 0.1b FormLabs3B on the tailnet (now, docs/MACHINES.md)
3. W3 circuit topology · 4. W4 layer views + Playwright · 5. 0.3 real assets · 6. 0.5 refs capture · 7. 0.6 checks
8. V3 vision tests + finish YOLO run (FormLabs3B) · 9. W5 switches · 10. W6 derating · 11. W8 load calc · 12. W7 service + one-line · 13. W9 permit sheets
14. A auth · 15. V2 WS catch-up · 16. V1 scale calibration · 17. W10 editing I · 18. W11 editing II · 19. C1–C4 design · 20. W12 DXF · 21. B · 22. D hosting · 23. E pitch · (V4 blocked on dataset licenses)

## Passed
- 0.1 (2026-10-21) Hooks probed live in Claude Code on the laptop. Bash: thresholds.json edit, `--no-verify` commit, playwright `--update-snapshots` all blocked by pre-tool; `it.only` flagged by post-edit + hygiene step (exit 1), reverted. FAILED before fix: the PowerShell tool bypassed pre-tool entirely (`--no-verify` reached git, `--update-snapshots` reached npx; nothing committed or written), and read-only `git config core.hooksPath` was blocked. Fixed: matcher adds PowerShell, hooksPath rule blocks only set/unset ≠ .githooks; re-probed live → blocked/allowed. New required fast gate step `hooks` (scripts/check-hooks.mjs, 19 cases; 7 fail on the old hook). Gate: GATE PASSED · full · 2026-10-21T11:58:32.859Z (laptop).
- M0 (2026-10-21) Fresh clone of GitHub `main` (= f197ddf, upstream unmoved) → bundle fast-forwarded onto `revamp` (b7f786c), no conflicts. Stale-doc re-check fixed 16 files (vision README /health + AFCI + CLASSES, 13→19 classes, api.md recognize path, PDF legend wording, route/module lists, unbuilt scripts marked with their item). Windows fixes: hygiene path separators, `install:all` no longer adds a `file:..` self-dependency. Gate: GATE PASSED · full · 2026-10-21T09:53:28.334Z, 306 server tests.
- 0.0 (2026-10-16) rules (CLAUDE.md, .claude/rules), hooks, gate runner, DESIGN.md v2, design-refs registry, asset manifest, REVAMP-PLAN.
- W2 (2026-10-21) PEC sizing: 60 °C termination column for circuits ≤100 A (1.10.1.14(C)), small-conductor caps 2.0/3.5/5.5 mm² → 15/20/30 A (2.40.1.4(D)), multi-outlet ratings 15/20/30/40/50 A only (2.10.2.1), EGC per Table 2.50.6.13 on every circuit, 20 A circuits for kitchen/dining/laundry/bath receptacles + rule (2.10.1.11(C)), receptacle-spacing rule (2.10.3.3(A)(1), conservative), ampacity rule recomputes usable rating from the table. New system 1P2W-230 (PH residential) = default for new panels; auto-lighting uses panel branch voltage. Converter now closes/opens room polygons (removed slits). Before: 20 A breaker got 2.0 mm², 30 A got 3.5 mm². tests/pec-alignment.test.ts 62 checks; 306 total.
- W1b (2026-10-21) Router rewritten: weighted Dijkstra over (cell, heading), walls crossable as counted penetrations (never lengthwise), bend cost, footprint mask grown 0.2 m, one search from the panel for all devices, room-side snapping. Real plans: 0 unreachable loads (was 11 on resplan-8), ≤1 penetration/route, wire total −30–40%, voltage-drop errors gone. tests/routing-real-plans.test.ts (60 checks) fails 23× on the old router. `fallback` now means "leaves the building" (contract docs updated). Removed `pathfinding`.
- W1 (2026-10-21) 12 ResPlan test-split plans (1/2/3/4+ BR) converted + committed with attribution; wall IoU 0.95–0.96, 100% openings matched. tests/real-plans.test.ts: 85 checks (contract, full simulate, one circuit per load, protection, dedicated appliances, schedule totals, PDF). Found: unreachable rooms (resplan-8), through-wall stubs, 1.5 km star wiring → W1b/W3.
- 0.2 (2026-10-21) self-hosted current fonts via next/font/local + @fontsource (no visual change; Archivo waits for Phase C); `.githooks/pre-commit` runs the full gate; `npm install` sets core.hooksPath. Gate: full PASSED.

## Decisions
- 2026-10-16: DESIGN.md v2 "Conductor" replaces v1 entirely.
- 2026-10-16: CubiCasa5K is CC BY-NC-SA 4.0 → test-only, never shipped.
- 2026-10-16: Perf/motion budgets measured on the FormLabs3B GPU only.
- 2026-10-21: 0.2 self-hosts the v1 fonts, not Archivo — a typeface swap is a visual change and belongs to Phase C.
- 2026-10-21: Real-plan corpus = ResPlan (17k residential plans, data CC BY 4.0, GitHub-hosted). Converted JSON for pinned test plans is committed with attribution; source zip pinned by sha256.
- 2026-10-21: ResPlan pickle loaded only through an allowlist unpickler (shapely from_wkb + numpy scalar/dtype).
- 2026-10-21: User asked for PEC alignment → treated as the go-ahead for PEC data changes in W2. Every new number stays PEC-VERIFY with its section.
- 2026-10-21: Post-edit hook is a ratchet (blocks only NEW hex/sonner/fetch/suppressions vs HEAD) so legacy files stay editable; legacy debt listed in docs/RECONCILE.md is removed in Phase C.
- 2026-10-21: Progress = docs/ROADMAP.json weighted points; July AUDIT.md open items became Phase V (V1–V4).

- 2026-10-21: Laptop working copy = D:\Projects-Shem\Websites\2026-2027\Solence (real path, not the C:\Projects junction); kickoff files kept in ..\_kickoff\.
- 2026-10-21: User: a passed item doesn't end the session — continue with the next item while context is fresh (`CONTINUING WITH <id>`, accepted by the Stop hook); hand off only when context runs long, blocked, or told to stop.
- 2026-10-21: `install:all` runs `npm install` inside each folder — `npm install --prefix` adds the root package as a dependency on npm 10.9.3/Windows.

## Open questions for the user
- `scripts/hygiene-allowlist.json` (user-only) says the vision skips go in item 0.3; REVAMP-PLAN finding 17 and the docs say V3 — which one?
- Domain choice (GitHub Student Pack vs DigitalPlat) — needed before Phase D.
- Machines: laptop = Claude Code + dev; FormLabs3B = hosting, vision service, training, GPU perf checks (docs/MACHINES.md).
- Real PH plan set (with permission) for the permit-sheet reference + demo house.
- Official PEC 2017 text: values so far come from an unofficial transcription (filipinoengineer wiki); a licensed EE must confirm.
- Dataset licenses for furniture detection (FloorPlanCAD terms, Kaggle CC BY-NC) — blocks V4.
- `SOLENCE_BUGFIX_AUTO_LIGHTING_GRID.md` (cited by the Phase 3 brief) is missing — share it or name the two bugs.
