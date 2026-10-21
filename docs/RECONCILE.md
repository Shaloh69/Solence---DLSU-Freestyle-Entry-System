# Old docs vs the revamp

Reconciled 2026-10-21 against `main` at `f197ddf` (no upstream commits
after it at the time). The kickoff (M0) re-checks this against anything
committed upstream since, and appends below "Upstream changes".

## (a) Kept from the original build

- Monorepo shape: `client/` Next.js editor, `server/` Express engine,
  `solence-vision/` FastAPI AI. All domain math stays in the server.
- Engine pipeline: rasterize → route → circuits → sizing → compliance →
  schedule/directory → PDF; lumen-method lighting (BEPVY), lux heatmap.
- API contract and WebSocket gateway; tier flags (Free/Pro/Firm/LGU).
- 2D canvas, 3D overlay, Showcase (construction reveal, grass/rain/wind,
  first-person walk), furniture library, parametric openings.
- Vision v2 (U-Net + YOLO26-seg fusion, CubiCasa5K + FloorPlanCAD
  converters, 19-class corpus) — now owned by Phase V.
- `PEC-VERIFY` / `LIGHTING-VERIFY` discipline; per-folder READMEs.

## (b) Changed by the revamp

| Area | Before | Now | Where |
|---|---|---|---|
| Design system | DESIGN.md v1 (navy/teal, Space Grotesk + Plex + JetBrains Mono) | DESIGN.md v2 "Conductor"; v1 UI stays until rebuilt in Phase C | DESIGN.md, C1–C4 |
| Agent rules | short CLAUDE.md | CLAUDE.md §1–8 + `.claude/rules/` + enforcing hooks + gate | 0.0 |
| Fonts | `next/font/google` (build needs network) | `next/font/local` + pinned `@fontsource` | 0.2 |
| Commits | anything | full gate on every commit (`.githooks/pre-commit`) | 0.2 |
| Test data | hand-made fixtures | + 12 real ResPlan houses (CC BY 4.0) | W1 |
| Routing | wall-band A* (`pathfinding`), walls only crossable at doors, nearest-cell snapping | weighted Dijkstra, counted wall penetrations, footprint mask, shared search, room-side snapping; `pathfinding` removed | W1b |
| `RoutedPath.fallback` | "left the wall band" | "leaves the building"; new `penetrations` | W1b, api.md |
| Sizing | 90 °C column; 20 A → 2.0 mm² | 60 °C terminations ≤100 A, small-conductor caps, 15/20/30/40/50 A multi-outlet, EGC per circuit | W2 |
| Rules | 9 | + `small-conductor`, `required-branch-circuit`, `receptacle-spacing` | W2 |
| Default system | 1P3W-120/240 (US) | 1P2W-230 (PH residential) | W2 |
| Hosting | "your PC" + Quick Tunnel | FormLabs3B over Tailscale + OpenSSH; named tunnel in Phase D | MACHINES.md, D |
| Progress | none | `npm run progress` from docs/ROADMAP.json | CLAUDE.md §7 |

## (c) Old statements that were false — fixed in place

| File | Was | Fixed to |
|---|---|---|
| README.md | "wall-following pathfinding from each load"; sizing "per PEC Table 3.10.1" only; remote access = generic PC + Quick Tunnel | concealed-conduit routing; PEC 2017 sizing summary + 230 V; FormLabs3B + MACHINES/HOSTING; revamp entry points |
| HOW-TO.md | vision `uvicorn --port 8000` only; hosting "your own domain via Cloudflare Tunnel" | `--host 0.0.0.0` on FormLabs3B + `VISION_URL`; gate section; FormLabs3B hosting |
| server/docs/api.md | "windows stay blocked for routing"; systems without 230 V; Circuit shape without grounding/termination; ruleId list of 10 | penetrations; `1P2W-230`; `groundingConductor`, `terminationTempC`; 13 ruleIds |
| server/README.md, client/README.md, solence-vision/README.md | "Current setup uses Tailscale + Quick Tunnel" | FormLabs3B + Phase D note |
| client/README.md | "Toasts via sonner" | new code via `lib/notify.ts`; v1/v2 design note; 230 V default; self-hosted fonts |
| solence-vision/README.md | "model regression tests skip until weights exist" (presented as fine) | allowlisted debt, replaced in V3 |
| solence-vision/HOW-TO.md | serve on localhost only | `--host 0.0.0.0` on FormLabs3B, detached |
| server/src/engine/README.md, sizing/README.md, compliance/README.md | old sizing + 7 listed rules | termination/small-conductor/EGC sizing, all rules, real-plan test requirement |
| server/src/engine/routing/README.md | `pathfinding` A* | new router model |
| server/src/engine/pdf/README.md | "permit-ready" | known gaps → W9 |
| server/HOW-TO.md | "edit schema.sql" | migrations folder from Phase A; gate before commit |
| docs/HOSTING.md | "DLSU project" Student Pack note; vision on localhost | UCLM email; `--host 0.0.0.0`; FormLabs3B header |
| .claude/rules/*.md | `check:refs`, `gate:ui`, `check:test-hygiene` (no such scripts); corpus via manifest only | real scripts (`npm run check:refs`, `npm run check:hygiene`, `npm run gate`); `real-plans.ts` helper |
| AUDIT.md (July) | open findings with no owner | historical header mapping each to A / V1–V4 / 0.6 / D |

## (d) Uncovered items → added to docs/ROADMAP.json

| From | Item |
|---|---|
| AUDIT.md [Medium] px→m scale assumed | **V1** scale calibration |
| AUDIT.md [Medium] WS drop loses AI result | **V2** catch-up refetch |
| AUDIT.md YOLO run interrupted; REVAMP-PLAN finding 10; vision pytest skips | **V3** |
| AUDIT.md needs-input #2 dataset licenses | **V4** (blocked) |

Already-delivered old features are the baseline (not counted) — none
were marked done without a test.

## Known debt (ratcheted — may not grow, removed in Phase C)

- Direct `sonner` imports: `app/layout.tsx`, `app/projects/[id]/editor/page.tsx`,
  `components/floorplan/InspectorPanel.tsx`, `lib/editor-store.ts`.
- Raw hex colors (count): `app/page.tsx` 31, `components/showcase/ShowcaseView.tsx` 22,
  `components/floorplan/FloorPlanCanvas.tsx` 20, `components/wiring-overlay/WiringOverlay3D.tsx` 12,
  `styles/globals.css` 6, `components/SkyBackground.tsx` 4, `lib/opening-presets.ts` 4,
  `components/primitives.ts` 3, `components/showcase/GroundPlane.tsx` 2, `lib/pdf-import.ts` 1.
- `eslint-disable` comments: 6 (editor page, error page, WiringOverlay3D,
  FirstPersonRig ×2, GrassField).
- Vision `pytest.skip`s: 3 (allowlisted until V3).

## Upstream changes

M0, 2026-10-21: `git log f197ddf..origin/main` is empty — `main` had not
moved, so the bundle fast-forwarded onto `revamp` (no merge commit, no
conflicts).

- (a) Kept from upstream: nothing new to keep.
- (b) Conflicts: none.
- (c) Doc statements made false by upstream: none.
- (d) New upstream features/plans for the roadmap: none — ROADMAP.json
  unchanged by this section.

### Stale-doc re-check (M0)

Every tracked `*.md` except `.claude/skills/` grepped against the code
(routing, voltage system, rule list, npm scripts, file paths). Confirmed
correct: 13 `ruleId`s in code = api.md list; `1P2W-230` default mirrored
in both `types.ts` and the editor store; 230 V in load-calc. Fixed in place:

| File | Was | Fixed to |
|---|---|---|
| CLAUDE.md §3 | `npm run assets:fetch` as if it exists | "(created in item 0.3)" |
| .claude/rules/frontend.md | `npm run check:tokens` as if it exists | "(created in item 0.6; post-edit hook blocks new hex until then)" |
| docs/REVAMP-PLAN.md §1 | "A* on raster grid … 9 compliance rules" read as current | dated as the `f197ddf` state; points to W1b/W2 |
| docs/WIRING-AUDIT.md F-16 | "Letter/A4 … no legend" | A4 (code), circuit legend exists; PH symbol legend missing |
| server/docs/api.md | recognize row `/api/projects/:id/recognize` under an `/api` base URL | `/projects/:id/recognize` |
| server/README.md | routes "(projects, loads, simulate, lighting, export)"; middleware without rate limit | real files `health.ts`/`projects.ts`/`vision.ts`; `rate-limit.ts` |
| server/src/engine/README.md | no `vision-import.ts` | listed |
| server/src/engine/sizing/README.md | export list missing `requiredAmps`, `sizeBreaker`, `balanceThreePhase` | complete |
| server/src/engine/lighting/README.md | no `daylight.ts`, `index.ts` | listed (daylight is advisory) |
| server/src/engine/pdf/README.md | "no … legend" (code draws a circuit legend) | no PH symbol legend / notes / one-line |
| server/src/engine/routing/rasterizer.ts (comment) | "grid for the A* router" | "conduit router" |
| client/README.md | routes omit `/` and `/about` | listed |
| solence-vision/README.md | `/health` = `{"unet":true,"yolo":true}`; "GFCI/AFCI rules" (no AFCI rule exists); `CLASSES` in `convert_to_yolo.py`; allowlist path | real `/health` body + "weights live on FormLabs3B, fresh clone → 503"; GFCI + required circuits; `cubicasa_svg.py`; repo-root path |
| solence-vision/scripts/README.md | run order omits `convert_floorplancad.py`, `merge_datasets.py` | added |
| solence-vision/HOW-TO.md | "13-class taxonomy"; model-test skips presented as normal | 19 classes (`CLASSES`); skips = allowlisted debt → V3 |

### Windows-only bugs found running the harness on the laptop (M0)

The sandbox was Linux; two scripts misbehaved on Windows (npm 10.9.3):

| File | Symptom | Fix |
|---|---|---|
| scripts/check-test-hygiene.mjs | allowlisted vision skips reported as failures — `relative()` gives `\` paths, the allowlist uses `/` | normalize to `/` (same as `.claude/hooks/post-edit.mjs`); allowlist untouched |
| package.json `install:all` | `npm install --prefix <dir>` (either flag order) added `"solence-monorepo": "file:.."` to client/server `package.json` + a junction to the repo root | `cd client && npm install && cd ../server && npm install` |

Left as is on purpose: AUDIT.md (July, historical — "13 classes" was true
then); docs/PROMPTS.md and REVAMP-PLAN.md naming scripts that their own
items create (`assets:fetch`, `refs:capture`, `check:*`);
`.claude/rules/three-d.md` already says when its scripts arrive.
