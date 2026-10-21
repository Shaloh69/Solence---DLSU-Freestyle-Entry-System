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

(none at reconciliation time — M0 appends here if `main` moved)
