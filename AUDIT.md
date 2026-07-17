# Solence Audit — 2026-07-17

Phase 3 §2 full-system audit. Method: code-level verification (greps,
test runs, contract tracing) plus test-suite evidence; findings needing
a live browser are explicitly marked **manual-pending** rather than
guessed. Re-run this audit after any major feature lands (§2.0.3).

## Summary

**1 Critical, 1 High, 4 Medium, 4 Low** findings · 5 fixed
automatically this pass · 3 need your input · items requiring a browser
session are listed under Manual verification.

## Functional completeness (§2.1) — spec vs reality

| Spec area | Status | Evidence |
|---|---|---|
| P1 Phases 0–8 (engine, API, editor, tiers, export) | **Done** | 95 server tests green; per-area suites (sizing/load-calc/compliance/routing/lighting/api/tiers/realtime) |
| P1 §9 lighting layer integration | **Done** | `engine/lighting/`, auto-place route, heatmap, compliance rules |
| P1 §9.1a photometric fidelity (daylight/height/CCT) | **Done (this pass)** | `daylight.ts`, `ROOM_CCT_DEFAULTS`, ceilingHeight threading, §9.1a test suite incl. the never-reduces-code-counts invariant |
| P1 §10 design system | **Done** | DESIGN.md binding; rendered-page re-verification manual-pending |
| P1 §11.1/11.2 furniture + 2D/3D manipulation | **Done** | TransformControls w/ drag gate; shared store both views |
| P2 §0.1/§1 Showcase Mode + construction reveal | **Done** | `components/showcase/`; reduced-motion + once-per-session logic in `ConstructionReveal.tsx` |
| P2 §2 asset pipeline (+§2.1a taxonomy, §2.5 Supabase) | **Done (code)** | per-item/meta.json/GLB conventions; `component_library` schema + `ingest-assets.ts`; §2.1a room-complete library (36 items incl. lamps-as-light-sources); no sourced GLB assets yet (deliberate: CC0 sourcing is manual work) |
| P2 §4 parametric openings + style packs | **Done** | `opening-{presets,geometry}.ts`, `OpeningMeshes` in both 3D views |
| P2 §6.1 room-taxonomy fix | **Done + verified** | 13 classes; per-class instance counts verified on conversion (outdoor 7191 / hallway 5553 / storage 4165 / utility 1366 / dining 882) |
| P2 §6.4/§7 yolo26m + merging + augmentation | **Code done; training in progress** | `merge_datasets.py` + tests; m-seg run interrupted at epoch ~48+ by formlab3b shutdowns — resumes from checkpoint |
| P2 §8 environment effects | **Done** | grass/rain/wind, showcase-only mounting |
| P3 §1 furniture detection | **Code done; training gated** | fusion OBB-via-mask + placement w/ 0.5 confidence gate + tests; dataset downloads await license decisions (below) |
| Recorded Electricals ↔ PDF same source | **Done** | both read the stored `SimulationResult` (`project.lastResult`); no second calculation path |
| `SOLENCE_BUGFIX_AUTO_LIGHTING_GRID.md` two bugs | **UNVERIFIABLE** | the referenced file does not exist anywhere (repo, C:\Projects\Solence) — see needs-input |

## Findings

### [Critical] No authentication/authorization on any API route
- **Where:** `server/src/routes/*` — zero auth middleware exists; tier gating trusts an `x-solence-tier` header.
- **What's wrong:** any network peer can list/modify/delete every project and trigger GPU inference. This is a *known, designed* interim state (Supabase Auth pending provisioning — P1 explicitly deferred it), but the public Quick Tunnel demo exposes these routes to the internet while it runs.
- **Fix:** needs your input — provisioning Supabase (auth + ownership checks) is the real fix and is a gated external-service decision. Interim mitigation while demoing: treat tunnel URLs as secrets, kill tunnels after sessions (already the operational habit).

### [High] AI inference endpoint had no rate limiting
- **Where:** `server/src/routes/vision.ts` `/projects/:id/recognize`.
- **What's wrong:** unlimited GPU-inference requests = cost/availability risk on a public tunnel.
- **Fix:** **applied** — in-memory fixed-window limiter (6/min/IP, 429 + Retry-After), `middleware/rate-limit.ts`.

### [Medium] Upload accepted any file type
- **Where:** same route's multer config (had size limit only).
- **Fix:** **applied** — `fileFilter` rejects non-`image/*` server-side; PIL still re-validates content on the Python side. Decompression bombs: PIL's default `MAX_IMAGE_PIXELS` guard applies.

### [Medium] Low-confidence AI room types presented as certain
- **Where:** `engine/vision-import.ts` — room confidence was discarded on import.
- **Fix:** **applied** — rooms under 0.5 confidence are named "Room N (check type?)" so the flag is visible everywhere the room name renders; the type still applies so wet-area rules err toward firing. (Furniture already had a hard 0.5 gate; walls/openings carry confidence in the payload.)

### [Medium] A WebSocket drop during AI recognition silently loses the result
- **Where:** `/recognize` returns 202 immediately; the floor-plan update reaches the client only via the WS `applied` event (`editor-store.ts`). The WS auto-reconnects+resubscribes (3s), but an event fired during the gap is not replayed.
- **What's wrong:** worst case, recognition succeeds server-side and the client never refreshes — silent stall, exactly §2.2's scenario.
- **Fix:** needs a small follow-up — on WS reconnect while `isRecognizing`, refetch the project (one `GET /projects/:id`) as a catch-up. Not applied this pass to keep the audit commit reviewable; flagged as the next code change.

### [Medium] Pixel→meter scale is an assumed constant
- **Where:** `engine/vision-import.ts` `ASSUMED_PX_PER_METER` (flagged `VISION-VERIFY` since Phase 3 §1 landed).
- **What's wrong:** recognized geometry (and now detected-furniture sizes) is proportionally right but absolutely wrong unless the plan happens to match the assumption; affects load-calc distances.
- **Fix:** needs product decision — a scale-calibration UI step ("click two points, enter the real distance") is the correct fix; queued as the top v-next item.

### [Low] `api.md` drift
- **Fix:** **applied** — recognize contract + ai-progress events documented, `egress-dedicated-circuit` added to the ruleId list.

### [Low] Working 3D view doesn't tint fixtures by CCT
- **Where:** `WiringOverlay3D` fixture markers stay circuit-colored; §9.1a asked for CCT in "both" views.
- **What's wrong (or isn't):** deliberate deviation — the working view's color channel already encodes circuit/violation state (its whole job); adding CCT there would collide with it. Showcase Mode carries the full CCT rendering (tinted emissives + real lights).
- **Fix:** accepted deviation, documented here; revisit only if you want a dedicated "lighting design" color mode toggle in the working view.

### [Low] Dead reference: `SOLENCE_BUGFIX_AUTO_LIGHTING_GRID.md`
- **Where:** Phase 3 doc §0/§2.1 requires confirming "the two bugs" from that file are fixed.
- **What's wrong:** the file doesn't exist in the repo or `C:\Projects\Solence`.
- **Fix:** needs your input — share the file (or name the two bugs) and I'll verify against running code. Possibly related: the auto-lighting grid-layout behavior and lux-heatmap alignment both have passing tests today.

### [Low] Ultralytics update available
- **Where:** training logs note `8.4.89 → 8.4.98`.
- **Fix:** defer — never upgrade the training env mid-run; bump after the current model ships.

## Security sweep (§2.5) — clean items
- Secrets: `.env`/`.env.local` gitignored, none committed, `.env.example` files contain no real values, no keys in history since the repo migration (the old BEPVY MySQL password remains treated as burned).
- CORS: scoped via `CORS_ORIGINS` env (defaults to localhost); tunnel origins are added explicitly per session.
- Large artifacts: no weights/datasets committed; `runs/`, `data/`, `models/`, `*.log` gitignored.
- Input validation: every JSON route parses through zod schemas; bulk loads capped (500); background image size-capped and data-URL-shape-checked.

## Hygiene sweep (§2.6) — clean items
- Per-folder READMEs present (spot-checked engine submodules, scripts, assets tree).
- `solence-vision/HOW-TO.md` current (augmentation rationale, VRAM limits, merge workflow documented this week).
- Scripts idempotency: `versioned_output()` prevents silent overwrites; conversion re-runs verified in practice (twice this week, `--force` behavior correct).
- Asset conventions: no sourced assets yet, so `{category}-{subtype}-{number}`/meta.json compliance is vacuously satisfied; ingestion script validates on arrival.

## Manual verification required (needs a browser/hands)
1. **Performance numbers** (§2.3): FPS during construction reveal, grass+rain+wind simultaneously, draw-call counts on a worst-case commercial plan, GSAP+Motion bundle KB, Recorded Electricals update cost at high circuit counts. DevTools Performance panel; no automated browser is available in this environment (design-review agent ran source-level only).
- 2. **Design/banned-pattern re-check on rendered pages** (§2.2/§2.7) in light+dark, four breakpoints.
3. **Toast behavior sweep** (§2.2): each async action's success/error/warning path; errors must not auto-dismiss.
4. **Showcase boundary** (§2.7): verified in code (environment mounts only inside `ShowcaseView`; working views have no sky/grass/rain imports) — worth one visual toggle pass to confirm.
5. **Reduced-motion**: code paths exist (reveal `progress(1)`, SkyBackground/navbar gates); verify with the OS setting once.

## Needs your input (called out per §2.8)
1. **Supabase provisioning** → unlocks real auth/authz (Critical above), Storage-backed assets, and durable projects.
2. **Dataset licenses** (P3 §1.2): FloorPlanCAD terms (research license — commercial status unconfirmed) and Kaggle "architecture" (CC BY-NC — incompatible with commercial use as-is). Until you decide, furniture-detection training has no data; code is ready.
3. **`SOLENCE_BUGFIX_AUTO_LIGHTING_GRID.md`** — file missing; share it so the two bugs can be verified as fixed.
