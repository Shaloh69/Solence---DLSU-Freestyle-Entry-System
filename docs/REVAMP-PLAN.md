# Solence — Production revamp plan (pitching contest)

Audit date: 2026-10-16 · Commit audited: `f197ddf` · Audited by running it,
not just reading it: server tests, client typecheck + production build,
live API + Next.js, Chromium screenshots at 1440px and 390px, and an
end-to-end floor plan → simulate → PDF export.

Hand this file to Claude Code at the start of every revamp session.
`CLAUDE.md` and `DESIGN.md` still bind; where this plan changes them, it
says so and the change is made to `DESIGN.md` **first** (its §10
rejection clause otherwise blocks the work).

---

## 1. What exists today (verified)

State at `f197ddf`, before the revamp. Since then W1b replaced the A*
router (weighted Dijkstra, counted wall penetrations) and W2 took the
rules from 9 to 13 — see docs/RECONCILE.md (b).

| Layer | State | Evidence |
| --- | --- | --- |
| Engine (`server/src/engine`) | **Strong.** Routing (A* on raster grid), PEC load calc + demand factors, breaker/conductor sizing, 9 compliance rules, lumen-method lighting + photometrics, vision import, PDF export | 95/95 vitest tests pass, `tsc` clean |
| API (`server/src/routes`) | Full project CRUD, floorplan/panel/loads, auto-lighting, simulate, results, export, AI recognize; WebSocket push on `/ws` | Live run: 3 circuits sized, 1 warning, PDF 200 |
| Client (`client/`) | Next 15 + HeroUI + R3F. Landing, About, Projects, Editor (2D plan / 3D wiring / Showcase w/ first-person walk), compliance + schedules + lighting tabs | Builds; 0 console errors on any page, both widths |
| Vision (`solence-vision/`) | FastAPI, U-Net + YOLO fusion, CubiCasa5K + FloorPlanCAD converters, 19-class corpus | Weights are gitignored — the old ones live only on FormLabs3B; retrained on the laptop from V0 |
| Design system | `DESIGN.md` is unusually good (tokens, banned list, rejection clause), plus `.claude/` design-review agent + avoid-ai-design skill | Landing largely follows it |
| Hosting | Doc covers Tailscale SSH + Cloudflare **Quick** Tunnel (random URL, one service, demo-only) | `docs/HOSTING.md` |

**Pitch strength nobody is telling:** the landing roadmap lists *AI
floor-plan recognition* as "V2 / planned" — it is already built and
trained. Move it to Shipping and demo it.

## 2. Findings — what blocks "production"

Severity: 🔴 blocks a public launch · 🟠 visible to judges · 🟡 polish.
Status (2026-10-21) → the roadmap item that owns each finding; ✅ = fixed.

### Functionality / backend
1. 🔴 → **A** · **No auth, no ownership.** `projects` table has no `user_id`;
   `GET /projects` returns everyone's projects; the WebSocket lets any
   client subscribe to any project id. On a public URL every visitor sees
   and can delete every project.
2. 🔴 → **A** · **Tier is client-controlled.** `x-solence-tier` request header sets
   the tier, default fallback is `pro`. Anyone gets Pro by adding a header.
3. 🔴 → **A** · **In-memory storage** whenever Supabase isn't configured — a server
   restart mid-pitch wipes all demo data.
4. 🟠 → **W9** · **Permit PDF glyph bug.** PDFKit's built-in Helvetica can't draw
   `²` or `⚠`: conductors print as "2 mm", violations print with "&".
   Fix: embed IBM Plex Sans + JetBrains Mono TTFs (`doc.registerFont`).
5. 🟠 → **W9** · **PDF isn't permit-shaped.** Letter page, no title block (project,
   owner, EE name + PRC no., sheet no. E-1/E-2…, scale, revision, signature
   box), diagram uses ~half the sheet. Real PH electrical plans are A3/A2
   sheets with a title block — compare against an actual submitted plan set.
6. 🟠 → **W10** · **No undo/redo** in `editor-store.ts` (916 lines, no history). A CAD
   tool without Ctrl+Z is the first thing a judge will try.
7. 🟠 → **C2/C4** · **Destructive actions have no confirm.** Project delete is one click,
   no modal, no undo toast.
8. 🟠 → **B** · **Empty editor is a blank grid.** No sample project, no first-run
   guide. A pitch demo needs "Open sample house" → wired + checked in 1 click.
9. ✅ **0.2** · Fonts load from Google at build time (`next/font/google`); the build
   fails offline. Self-host via `@fontsource` so FormLabs3B builds
   without internet. *(Verified: swapping to @fontsource builds clean.)*
10. 🟡 → **V3** · `torch.load(..., weights_only=False)` — unpickles arbitrary code;
    fine for own weights, but pin hashes of `best.pt`.
11. 🟡 → **A** · Rate limiter is per-process in-memory and keyed on `req.ip` —
    behind Cloudflare Tunnel every request has the same IP unless
    `app.set("trust proxy", ...)` + `CF-Connecting-IP` is used.

### Design (from screenshots)
12. 🟠 → **C4** · **Projects page is the weakest screen.** No page title, input +
    card float over clouds, card uses an icon-in-a-rounded-square (a
    DESIGN.md §7 banned item), HeroUI default grey input and pink danger
    button. Rebuild as a proper dashboard shell.
13. 🟠 → **C4** · **Editor chrome still reads as stock HeroUI:** grey filled inputs,
    amber flat buttons for *Auto-light* / *AI Recognize* (amber is reserved
    for caution/eyebrows — §2 scarcity rule), pink delete chips. Two solid
    teal actions visible at once (active tool + Re-check).
14. 🟡 → **C4** · Landing: scroll-reveal sections are invisible until scrolled (fine
    for users, bad for link previews/SEO — render visible on the server,
    animate from a JS-added class). Reduced-motion path verified correct.
15. 🟡 → **C4** · Mobile editor is honest ("open on a larger screen") but the tabs
    overflow off-screen with no affordance.
16. ✅ **0.0** (DESIGN.md v2 §5–6) · No toast/modal/dialog system defined in DESIGN.md beyond the toast
    shadow token — this is the gap the revamp fills (§4).

17. 🟠 → **V3** · **Vision tests pass without testing anything.** `test_unet_model`,
    `test_yolo_model` and one API test `pytest.skip` when weights or
    fixture images are missing — so a green run proves nothing. Caught by
    the new hygiene check; allowlisted until item V3 replaces them with
    real-fixture tests.

Wiring, PEC, CAD-editing and layer findings (F-1…F-19, 2026-10-21) are in
`docs/WIRING-AUDIT.md`; F-1…F-8 are fixed (W1b, W2). Open items from the
July `AUDIT.md` are mapped at its top.

> **Design is replaced, not improved.** DESIGN.md v1 ("instrument
> panel": navy/teal, three typefaces, mono-caps eyebrows everywhere) is
> retired. DESIGN.md v2 "Conductor" is the new system. Findings 12–16 are
> resolved by rebuilding on v2, not by patching v1 screens.

## 3. How work flows (applies to every phase)

```
pick ONE item from STATE.md
  └─ UI?  → registry entry + real reference captured → spec → /dev/gallery build
  └─ code → tests first on real corpus data
        ↓
node scripts/gate.mjs  ──fail──► fix the cause (never the check) ──┐
        │ pass                                                     │
        ▼                                                          │
design-review subagent (UI items) ──fail───────────────────────────┘
        │ pass + user sign-off
        ▼
STATE.md updated → commit (hook re-runs full gate) → next item (same session while context is fresh, else handoff + /clear)
```

Enforcement that already exists and was tested (see §7):
- **Stop hook** runs the fast gate whenever the tree is dirty; Claude Code
  cannot finish a turn with red checks.
- **Commit hook** runs the full gate; `git commit` is refused on failure;
  `--no-verify` and force-push are blocked.
- **Protected files**: visual baselines, render thresholds, corpus
  expectations, the hygiene allowlist, and "required" flags in the gate
  config can't be loosened without the user.
- **Post-edit hook**: raw hex colors in client code, `fetch` outside the
  API client, direct `sonner` imports, `.only/.skip`, `waitForTimeout`,
  and suppression comments are bounced back immediately.
- **check-design-refs**: no UI primitive without a registry entry, no
  `in-review` without a captured reference + spec, no `approved` without
  side-by-side report + design-review pass + user sign-off, and only one
  item in review at a time.

## 4. Phases

### Phase 0 — Harness (before any feature; nothing else starts until done)
Each item = one gate pass (one at a time). Flip its gate step to
`required: true` the moment it exists.
- 0.1 Verify gate + hooks on the laptop (where Claude Code runs).
- 0.1b FormLabs3B on the tailnet, OpenSSH, repo + gate (docs/MACHINES.md).
  Vision moved to the laptop (V0).
- 0.2 ✅ Self-host the current fonts (next/font/local + @fontsource; no
  visual change — Archivo arrives with Phase C); `.githooks/pre-commit`
  runs the full gate for every commit.
- 0.3 **Real corpus.** `npm run assets:fetch` downloads every
  `test-assets/manifest.json` entry to `test-assets/cache/`, pins exact
  files + sha256. `check:assets`: Khronos `gltf-validator` (0 errors),
  `gltf-transform inspect` budgets, real-world scale vs meta.json,
  texture color space / size / seam checks, license present. Replace the
  skipping vision tests with corpus-backed ones that fail when inputs are
  missing.
- 0.4 (now part of **W4**; the server-side real-plan suites already exist
  from W1/W1b/W2) **Real-plan E2E** (Playwright): for each pinned CubiCasa plan →
  upload → AI recognize → compare to ground-truth SVG (room count ±1,
  wall IoU ≥ threshold in `test-assets/expectations/<id>.json`) → place
  panel + loads → simulate → compliance → PDF (text extracted, asserts
  `mm²`, title block fields) → 3D view renders. Console errors fail.
- 0.5 **Reference capture**: `refs:capture` visits every registry URL with
  Playwright, saves 1440 + 390 captures (and isolated component demo
  states) under `design-refs/`, records capture date. Dead URL → removed,
  never replaced by an invented one. `refs:report` builds the
  side-by-side HTML (ours | reference) per item.
- 0.6 `/dev/gallery` route + `check:tokens` (scan computed styles for any
  color/font/radius/shadow/duration not in DESIGN.md), `test:a11y`
  (axe-core, 0 serious/critical), `test:visual` (toHaveScreenshot vs
  approved baselines).
- 0.7 `check:render` (fixed camera paths over real-asset scenes:
  luminance range, missing-texture detection, `renderer.info` budgets,
  pixelmatch vs baseline) and `check:motion` (rAF frame-time p95 ≤ 20 ms,
  max ≤ 50 ms, CLS 0, reduced-motion screenshot, hidden-tab pause).
  Perf assertions run headed on the FormLabs3B GPU over Tailscale; CI
  headless runs correctness only.
- Exit criterion: every gate step in `gate.config.json` is `required`.

### Phase W — Wiring realism & PEC (findings in docs/WIRING-AUDIT.md)
Engine items run on the 12 real ResPlan houses (`test-assets/plans/
resplan/`, CC BY 4.0). Every item: tests first, prove they fail on the
old code, then implement, full gate, commit. UI parts of W-items still
follow the template rule (registry → spec → gallery → review).
- W1 ✅ Real-plan corpus: ResPlan converter (allowlist unpickler,
  door-anchored scale, wall centerlines IoU ≥ 0.80, openings on walls,
  room cleanup) + `tests/real-plans.test.ts`.
- W1b ✅ Concealed-conduit router: walls crossable as counted
  penetrations, bend cost, footprint mask, one search from the panel,
  room-side snapping. `tests/routing-real-plans.test.ts`.
- W2 ✅ PEC sizing: 60 °C terminations ≤100 A, small-conductor caps,
  multi-outlet ratings, EGC, required 20 A circuits, receptacle spacing,
  `1P2W-230` default. `tests/pec-alignment.test.ts`.
- W3 Circuit topology: per circuit, a home run from the panel to the
  nearest device, then device→device (minimum spanning tree over route
  costs, through junction boxes at branch points). Each segment carries
  its conductor set (L + N/L2 + G, sizes) and the downstream current;
  voltage drop sums segment by segment to the far device. Outputs a wire
  bill of materials (m per size and color) and conduit length. 2D: one
  line per conduit segment, tick marks (L/N/G count), home-run arrow
  with circuit number. Tests on all 12 plans: each circuit is one
  connected tree; total wire < sum of home runs; BOM = sum of segments;
  VD per chain ≤ old worst-case VD.
- W4 Layer views: presets (Architectural, Furniture plan, Electrical
  (no furniture), Lighting plan, Power plan, Wiring only, Compliance
  review, All), lock, persisted per project; `data-layer` attributes on
  every 2D element. Sets up the Playwright project (item 0.4). Tests:
  store unit tests per preset; E2E on a real plan furnished by a test
  helper: 2D element counts on/off, 3D pixel diff on/off, preset ==
  manual toggles, locked layer not selectable.
- W5 Switches & switch legs: switch load type, auto-place at door latch
  side (1.2–1.4 m, DESIGN-VERIFY), each lighting group controlled by a
  switch; switch legs in the topology; PH legend symbols.
- W6 Derating + raceways: >3 current-carrying conductors (0.80/0.70/
  0.50), ambient correction (default 35 °C ceiling, configurable),
  conduit size by fill (40% >2 conductors), all PEC-VERIFY.
- W7 Service & feeder: service entrance, kWh meter, main breaker,
  service conductors, grounding electrode conductor, generated one-line
  (riser) diagram.
- W8 Dwelling load computation (PEC 2.20): general lighting at
  24 VA/m² used (not warned), small-appliance + laundry 1500 VA,
  fixed-appliance 75% (≥4), A/C at 100%; schedule of loads in PH format.
- W9 Permit sheet set (A3, embedded fonts): E-1 legend + general notes,
  E-2 lighting layout, E-3 power layout, E-4 one-line + schedule of loads
  + design analysis; title block (project, owner, PEE name, PRC/PTR,
  sheet no., revision, signature box). `check:pdf` extracts text and
  asserts `mm²`, title-block fields, every circuit id. Template: a real
  PH plan set (open question in STATE).
- W10 Editing I: undo/redo (command history), multi-select, copy/
  paste/duplicate, assign load → circuit, split/merge circuits, lock a
  route and drag its vertices, re-route one run.
- W11 Editing II: object snaps + ortho, typed lengths, polyline walls,
  wall join/trim, rooms auto-detected from closed wall loops (any
  shape), measure + dimensions + text notes.
- W12 DXF import/export (walls/rooms/devices on named layers that match
  the Solence layer presets).

### Phase V — Vision service on the laptop
From the July AUDIT.md, now gated like everything else. Runs and trains
on the laptop (RTX 3050, 4 GB; docs/MACHINES.md §6); the API calls it at
`http://localhost:8000`.
- V0 Laptop setup: CUDA venv, data under `SOLENCE_VISION_DATA` (C:),
  CubiCasa5K prepared + fit-tested (yolo26s-seg 640/2, U-Net 512/2),
  full runs started detached, service on 127.0.0.1:8000.
- V1 Scale calibration for AI-imported plans: user clicks two points and
  enters the real distance; replaces `ASSUMED_PX_PER_METER`. Test: a
  ResPlan house rendered to an image at a known scale, recognized,
  calibrated → wall lengths within 3%.
- V2 Catch-up after a WebSocket reconnect during recognition (refetch the
  project). Test: drop the socket mid-job in E2E, result still appears.
- V3 Vision regression tests on real fixtures (remove the allowlisted
  `pytest.skip`s; missing weights/fixtures fail loudly), pin `best.pt`
  sha256 (finding 10), finish the V0 yolo26s-seg/U-Net runs on the laptop.
- V4 Furniture-detection training — blocked until you decide the dataset
  licenses (AUDIT.md needs-input #2).
- V5 ResPlan (CC BY 4.0) → vision converter + retrain, so the weights the
  hosted app serves carry no CubiCasa5K NC restriction. Before Phase D.

### Phase A — Production foundation (unchanged scope, now gated)
Auth (Supabase) + `owner_id` + owner-scoped REST and WS; tier from
`profiles.tier`, header only in tests; refuse in-memory storage in
production; Next rewrites `/api` + `/ws` (one hostname); PDF font
embedding; `trust proxy` + `CF-Connecting-IP`.
Gate adds: two-user isolation tests over REST **and** WS.

### Phase B — Product features
(Undo/redo and the permit sheet set moved to W10 and W9.) Sample
projects built from the real ResPlan houses + the real PH bungalow,
first-run guide, command palette, conflict-safe autosave, multi-storey,
short-circuit analysis (roadmap V3, pulled forward). Each item's E2E
runs on a real plan.

### Phase C — Design rebuild on DESIGN.md v2 (replacement, not polish)
Order, each item gated individually:
1. Tokens → `client/styles/tokens.css` + Tailwind theme; remove HeroUI
   theme overrides; dark "conduit" default in editor, light "sheet" on
   marketing.
2. Primitives in `client/components/ui/` in this order: button, input
   (+unit), segmented/tabs, tooltip, dialog, confirm-dialog, toast via
   `lib/notify.ts`, drawer, command palette, schedule table, empty state,
   skeleton, progress/stepper, status bar, compliance item.
3. Animations as their own items: wire draw-in, violation flash, figure
   tick, hero sequence, showcase reveal (real PBR textures + HDRI).
4. Screens, rebuilt from approved primitives only: projects dashboard →
   editor shell → landing → about → auth → 404/error → mobile summary.
5. Permit sheet as a `pdf-sheet` item against a real PH plan set.
HeroUI is removed from a screen when that screen is rebuilt; the last
screen removes the dependency.

### Phase D — Self-hosting (§5)
### Phase E — Pitch hardening
Seeded demo accounts + reset script, offline fallback via Tailscale URL,
Lighthouse ≥ 90 (perf/a11y/SEO), OG image, backup video recorded from
Showcase, real cited market figures only.

## 5. Self-hosting — FormLabs3B + Tailscale + Cloudflare

**Domain reality:** Cloudflare doesn't give away domains — the Tunnel and
the DNS zone are free, the domain is not. Two $0 routes that work with a
Cloudflare named tunnel (domain must use Cloudflare nameservers):
- **GitHub Student Developer Pack** (you're a student — likely qualifies):
  free first-year domain via its registrar partners.
- **DigitalPlat FreeDomain** (`*.dpdns.org`, `*.us.kg` etc.): free
  subdomains that can be delegated to Cloudflare nameservers.
Pick one before Phase D; the Student Pack domain looks more credible on a
pitch slide.

**Target topology**
```
Internet ──► Cloudflare (DNS, TLS, WAF, cache) ──► cloudflared (Windows service on FormLabs3B)
                                                   └─► solence.<domain> → localhost:3000 (Next, proxies /api + /ws → :4000)
Tailscale (private) ──► FormLabs3B: SSH, Supabase/Postgres admin  (never public)
                    ──► laptop: :8000 vision (V5 weights; binding decided in D)
```
Steps for Claude Code to script (`ops/` folder, PowerShell):
1. `cloudflared tunnel login` → `tunnel create solence` →
   `config.yml` ingress for one hostname → `tunnel route dns` →
   `cloudflared service install` (survives reboot).
2. Run Next (`next start`) + API (`node dist/index.js`) + vision
   (`uvicorn`) as services — PM2 (`pm2-windows-startup`) or NSSM.
3. Cloudflare dashboard: SSL Full, Always HTTPS, a WAF rate rule on
   `/api/projects/*/recognize`, Bot Fight Mode on.
4. Optional: Cloudflare Access (free ≤50 users) in front of a
   `admin.<domain>` path; Tailscale stays the admin path.
5. `ops/deploy.ps1`: `git pull` → install → build → test → restart services
   (run over Tailscale SSH). `ops/health.ps1`: curl health endpoints, alert.
6. Power plan: disable sleep, auto-login-free service startup, UPS if
   available; this one PC *is* production.
Rewrite `docs/HOSTING.md` around this; keep Quick Tunnel as the
emergency fallback.


## 6. Context management for Claude Code

- `CLAUDE.md` (< 200 lines) holds only rules that apply everywhere.
  Area detail lives in `.claude/rules/*.md` with `paths:` frontmatter, so
  it loads only when matching files are touched: `frontend.md`
  (client), `three-d.md` (showcase/overlay/assets), `tests.md`,
  `engine.md` (server).
- `docs/STATE.md` is the handoff: current item, last gate line, next
  items, decisions, open questions. The SessionStart hook injects it, so
  every fresh session starts oriented without re-reading the repo.
- One item at a time → gate → commit → next item while context is fresh (CLAUDE.md §5), else handoff → `/clear`. Long session →
  `/compact` with an explicit "keep" list.
- Logs and screenshots go to `.artifacts/`; Claude reads
  `.artifacts/gate-summary.md` (the gate writes only failing tails into
  it), not raw output.
- Subagents: `Explore` for broad searches; `design-review` for grading
  (fresh context, never the builder); a fresh subagent to triage a large
  failure report and return the root cause in a paragraph.
- Personal machine-specific notes (paths on FormLabs3B, GPU name) go
  in `CLAUDE.local.md` (gitignored).
- Progress is computed, never estimated: `npm run progress` reads
  `docs/ROADMAP.json`; the SessionStart hook prints it, every gate
  summary carries the one-line form, and the gate's `progress` step fails
  if ROADMAP and STATE.md disagree (CLAUDE.md §7).

## 7. Verified in the audit sandbox

2026-10-16 (harness):

| Check | Result |
|---|---|
| Stop hook, injected type error | blocks with failing summary; second attempt doesn't loop |
| Blocked as intended | threshold edit, `--no-verify`, `--update-snapshots`, un-requiring a gate step, raw hex in `components/ui`, `.only` in a test, UI primitive without registry entry |
| Allowed as intended | normal edits, making a gate step required |
| Palette contrast | every text/action/signal pair ≥ 4.5:1 in both themes |

2026-10-21 (after 0.2, W1, W1b, W2, docs):

| Check | Result |
|---|---|
| Full gate | PASS — hygiene, progress, typechecks, 306 server tests (incl. 12 real houses), design refs, client build |
| Post-edit hook (ratchet) | legacy files editable; new hex, new sonner import, new suppression, new UI file with hex → blocked |
| Commit | Claude hook defers to `.githooks/pre-commit` (one gate per commit); `--no-verify` and changing `core.hooksPath` blocked |
| New routing tests vs old router | 23 failures on the old code, all pass on the new |
| Bundle | applies cleanly to a fresh clone of the GitHub repo (no upstream commits after f197ddf) |

## 8. Kickoff

The first-ever session is **Kickoff (M0)** in `docs/PROMPTS.md`: Claude
Code merges the revamp bundle onto a `revamp` branch, reads the repo's
latest docs, writes `docs/RECONCILE.md`, folds anything uncovered into
`docs/ROADMAP.json`, runs the gate, commits and pushes. Every later
session: "Session start" + the item prompt. Laptop first (0.1), then
FormLabs3B (0.1b).
