# Claude Code prompts for the Solence revamp

How to use: the very first time, paste **Kickoff (M0)** — it merges the
revamp into your repo. After that you never hunt for prompts: every
session ends with a **SESSION HANDOFF** block (progress % + the exact
prompt for the next session). Type `/clear`, paste that prompt, repeat.
One item at a time. When the gate passes and Claude has committed, it
carries on with the next item in the same session while context is
fresh (`CONTINUING WITH <id>`); it hands off only when context runs long,
it's blocked on you, or you say stop. Everything Claude must obey is already in `CLAUDE.md`,
`.claude/rules/`, `DESIGN.md` and enforced by hooks — the prompts only
point at the work.

Order (also in `docs/STATE.md`, progress from `docs/ROADMAP.json`):
M0 → 0.1 → V0 → V0b → W3 → W4 (+0.4) → 0.3 → 0.5 → 0.6 → V3 → W5 → W6 →
W8 → W7 → W9 → A → V2 → V1 → W10 → W11 → C1…C4 → W12 → B → V5 → D → E
(V4 waits for your dataset-license decision.)

---

## Kickoff (M0) — first session only

Put `solence-revamp.bundle` somewhere on the laptop first (e.g.
`C:\Users\<you>\Downloads\solence-revamp.bundle`), open a terminal in
your repo folder, run `claude`, then paste — with the real bundle path:

```
Kickoff, item M0. I have the Solence revamp as a git bundle at
C:\Users\<you>\Downloads\solence-revamp.bundle — the commits built on
top of commit f197ddf of this repo. Treat it as the NEW PHASES of this
project; the original build (brief phases 1–4) is the baseline, already
done. Do these steps in order and stop at every STOP to show me what you
found before continuing:

1. `git status` must be clean — if not, list what's uncommitted and STOP.
   `git fetch origin`, then `git log --oneline f197ddf..origin/main` and
   tell me whether main moved since f197ddf.
2. `git checkout -b revamp origin/main`, then
   `git pull <bundle path> HEAD`. If main moved, this is a real merge:
   keep my newer feature work AND the bundle's rules, docs, tests and
   engine changes; never resolve a conflict by deleting a test, loosening
   a check or dropping a rule. STOP: show the conflict list and how you
   resolved each one.
3. Now read CLAUDE.md (the merged one — its rules apply from here on),
   then the repo's latest documentation as it stands after the merge:
   README.md, HOW-TO.md, docs/HOSTING.md, docs/MACHINES.md, every folder
   README (client/, server/, server/src/engine/**, solence-vision/**),
   server/docs/api.md, solence-vision/HOW-TO.md, DESIGN.md,
   docs/REVAMP-PLAN.md, docs/WIRING-AUDIT.md, docs/ROADMAP.json,
   docs/STATE.md. Use a subagent for the folder READMEs and take its
   summary, not the raw files.
4. docs/RECONCILE.md already exists (reconciled in the sandbox against
   f197ddf). If main had commits after f197ddf, read their diff and
   append an "Upstream changes" section: (a) what they add that the
   revamp keeps, (b) what conflicts with the revamp and how you merged
   it, (c) any doc statement those commits made false — fix it in place,
   (d) any new feature/plan they introduce that docs/ROADMAP.json
   doesn't cover — add it as a ROADMAP item (phase, weight S=1 M=2 L=3,
   todo). Also re-run the stale-doc check: grep every *.md (except
   .claude/skills) for statements contradicted by the code (routing,
   voltage system, rule list, scripts that don't exist in package.json)
   and fix them. Don't renumber existing items. STOP: show me the
   RECONCILE.md diff, the ROADMAP.json diff and the new progress block.
5. `npm install` (root — sets the git hooks path), `npm run install:all`,
   `npm run gate`. It must say GATE PASSED; if not, fix the cause, never
   the check.
6. Mark M0 done (ROADMAP.json + a `- M0 (` line under STATE.md ## Passed),
   set 0.1 in-progress and name it on STATE.md's `- Item:` line, commit
   (the pre-commit gate runs), then `git push -u origin revamp`.
7. End with the output of `npm run handoff`, verbatim — it shows the
   progress and the exact prompt for item 0.1.
```

## Session start (paste first, every session)

You rarely type this yourself: every session ends with a SESSION HANDOFF
block (`npm run handoff`) that already contains this prompt plus the next
item's prompt. This is the source it's built from.

```
Show the progress block from the SessionStart hook first. Read CLAUDE.md
and docs/STATE.md. Work only on the item STATE.md names as "Now". Before
writing code: (1) list the files you will touch, (2) list the
tests/checks that will prove it works, including which ones must fail on
the current code first, (3) name the real-plan or real-asset data they
use. Wait for my OK on that list, then build. You are done only when
`node scripts/gate.mjs` passes, STATE.md and ROADMAP.json mark the item
done with the next one in progress, and the commit went through the
pre-commit gate. Then, if context is still fresh, continue with the next
item in this session (CLAUDE.md §5); otherwise end with the output of
`npm run handoff`, verbatim.
```

## Utility prompts

**Resume after /clear or a crash**
```
Read docs/STATE.md and .artifacts/gate-summary.md. Tell me in 3 lines
where the current item stands and what the next concrete step is. Don't
change anything yet.
```

**Gate is failing**
```
Read .artifacts/gate-summary.md only. Use a subagent to read the full log
of the failing step and return the root cause in one paragraph. Fix the
cause in the code — never the check, threshold, baseline or test
expectation. Re-run the full gate.
```

**Claude is drifting / doing two things at once**
```
Stop. Re-read CLAUDE.md §1 and docs/STATE.md. Revert anything outside the
current item (`git stash` it if useful) and continue only with the item.
```

**Design item (any page, component or animation)**
```
This is a UI item, so CLAUDE.md §2 applies in order: registry entry with
a real reference captured by Playwright → docs/component-specs/<id>.md →
build on /dev/gallery (all states, both themes) → gate → design-review
subagent verdict → my sign-off. Show me the side-by-side report before
asking for sign-off.
```

**End of session (also when stopping mid-item)**
```
Wrap up: update docs/STATE.md (Now / Next / Passed with the gate line /
Decisions / Open questions, under 60 lines) and ROADMAP.json, commit if
the gate passes, then end with the output of `npm run handoff`, verbatim.
```

---

## Item prompts

### 0.1 — Prove the harness on the laptop
```
Item 0.1. Prove every hook fires in this Claude Code session on this
laptop: try (a) editing server/tests/thresholds.json, (b)
`git commit --no-verify`, (c) adding `it.only` to a server test, (d)
`npx playwright test --update-snapshots` — all four must be blocked;
revert anything that slipped through and tell me which hook failed.
Run `npm run gate`. Record results in STATE.md, mark 0.1 done, set 0.1b
in-progress, commit, show progress.
```

### V0 — Vision on the laptop
```
Item V0. The vision service runs and trains on this laptop (RTX 3050
Laptop, 4 GB VRAM). Create solence-vision/.venv with the CUDA torch build
(requirements.txt header) and prove torch.cuda.is_available(). Make
scripts/_common.py put data and training runs under SOLENCE_VISION_DATA
(default C:\SolenceData\vision; weights stay in solence-vision/models/),
with a pytest that fails on the current hardcoded paths. Download
CubiCasa5K there, convert to YOLO + U-Net, run verify_dataset.py for
both and look at the previews. Fit-test one epoch each: yolo26s-seg
--imgsz 640 --batch 2, U-Net --imgsz 512 --batch 2; log peak VRAM and
epoch time to .artifacts/. Start the full runs detached and logged. Serve
the app with uvicorn on 127.0.0.1:8000 and confirm /health answers; tell
me the exact VISION_URL line for server/.env. CubiCasa5K is CC BY-NC-SA:
these weights are research/demo-only until V5. Record in STATE.md, mark
V0 done, set W3 in-progress, commit, show progress.
```

### V0b — Training robustness on 16 GB RAM
```
Item V0b. The laptop YOLO run died at epoch 2: a dataloader worker ran
out of RAM decoding a ~90 MP CubiCasa image. Cap image size when
convert_to_yolo writes images (longest side 2048; labels are normalized,
so they stay valid; never write through a hardlink to raw/), with a
pytest that fails on the current code. Lower dataloader workers in
train_yolo.py. Regenerate the YOLO dataset, verify it, restart
train-laptop.ps1 detached and confirm it gets past epoch 2. Record in
STATE.md, mark V0b done, set W3 in-progress, commit, show progress.
```

### W3 — Circuit topology (device to device)
```
Item W3 (docs/REVAMP-PLAN.md Phase W, docs/WIRING-AUDIT.md F-9, F-10,
F-11). Replace per-load home runs with real circuits: per circuit, one
home run from the panel to the nearest device, then device-to-device
along a minimum spanning tree over router costs, with junction boxes at
branch points. Each segment carries its conductor set (L, N or L2, G
with sizes) and the downstream current; voltage drop sums along the
chain to the farthest device. Add a wire/conduit bill of materials to
SimulationResult (mirror client types, update server/docs/api.md).
Tests first on all 12 ResPlan houses: each circuit's segments form one
connected tree reaching every load; total wire < the old sum of home
runs; BOM equals the sum of segments; chain VD ≤ the old worst-case VD;
existing real-plan, routing and PEC tests still pass. Rendering the new
segments in 2D/3D is part of W3 only as data — visual changes go
through the design rule in a follow-up UI item.
```

### W4 — Layer views + Playwright project (includes 0.4)
```
Item W4 (WIRING-AUDIT §5, F-19). Engine/store first: layer presets
(Architectural, Furniture plan, Electrical without furniture, Lighting
plan, Power plan, Wiring only, Compliance review, All), layer lock,
persisted per project; `data-layer` attributes on every 2D canvas
element. Set up Playwright in client/e2e (launch with
PW_CHROMIUM_PATH if set), add it to gate.config.json as required. A test
helper loads a ResPlan house via the API and furnishes it with items
from client/lib/furniture-library.ts. E2E: 2D element counts per layer
on/off; 3D screenshot pixel diff furniture on vs off above a threshold
in client/e2e/thresholds.json; each preset equals the same manual
toggles; a locked layer can't be selected; no console errors. The
preset picker UI is a design item: registry entry referencing AutoCAD's
Layer States Manager, spec, gallery — before it ships.
```

### 0.3 — Real 3D assets and textures
```
Item 0.3. Implement `npm run assets:fetch` from test-assets/manifest.json
into test-assets/cache/ (sha256 pinned; pin exact asset slugs first,
ask me where a license is unclear), and `npm run check:assets`: Khronos
gltf-validator 0 errors, gltf-transform inspect budgets (DESIGN.md §8),
real-world scale vs meta.json, texture color space/size/seams, license
present. Make the step required in gate.config.json.
```

### 0.5 — Reference capture
```
Item 0.5. `npm run refs:capture`: Playwright visits every
design-refs/registry.json URL, saves 1440 and 390 captures (plus isolated
component states where the source has a demo), records the capture date;
dead URLs are removed, never replaced with invented ones.
`npm run refs:report`: side-by-side HTML per item (ours | reference).
```

### 0.6 — Visual, a11y, token, motion, render, PDF checks
```
Item 0.6. Add /dev/gallery, check:tokens (computed-style scan vs
DESIGN.md), test:a11y (axe, 0 serious/critical), test:visual
(toHaveScreenshot vs approved baselines), check:render and check:motion
per .claude/rules/three-d.md, check:pdf (text extraction). Flip each to
required as it lands. Perf assertions run headed on this PC's GPU.
```

### V3 — Vision tests on real fixtures (laptop)
```
Item V3. Replace the three allowlisted pytest.skip tests in
solence-vision/tests with tests that fail loudly when weights or fixtures
are missing; fixtures = ResPlan houses rendered to PNG at a known scale
(script in solence-vision/scripts, output pinned by sha256) plus their
ground-truth walls/rooms; assert wall IoU and room count within limits
in a protected thresholds file. Pin best.pt sha256 and check it before
torch.load. On the laptop: let the V0 yolo26s-seg and U-Net runs finish
(resume from their last.pt if interrupted), install best.pt, run the
vision tests here. Remove
the three entries from scripts/hygiene-allowlist.json only after the new
tests pass (ask me — that file is protected).
```

### V2 — Catch-up after WebSocket reconnect
```
Item V2 (AUDIT.md Medium). When the realtime socket reconnects while a
recognition job is running, refetch the project once. E2E: start
recognition, drop the socket mid-job, the recognized plan still appears.
```

### V4 — Furniture-detection training
```
Item V4 — only after I've decided the dataset licenses (STATE.md open
questions). Record the licenses in test-assets/manifest.json, convert
the datasets, train on the laptop detached and logged, add regression
tests on held-out real plans, then enable detected furniture in imports.
```

### V1 — Scale calibration for AI imports
```
Item V1 (AUDIT.md Medium). Replace ASSUMED_PX_PER_METER with a
calibration step: user clicks two points on the imported plan and types
the real distance; engine rescales walls/rooms/furniture. Engine + test
first (a ResPlan house rendered at a known scale comes back within 3%),
then the UI step through the design rule.
```

### W5 — Switches
```
Item W5 (F-12). Add a switch device type, auto-placement at the latch
side of the room's door (height as a DESIGN-VERIFY constant), lighting
groups controlled by switches, switch legs in the W3 topology, 2-way
switching for rooms with two doors. Tests on all 12 houses: every
lighting fixture is controlled by exactly one switch in its room or at
its door; switch legs appear in the BOM.
```

### W6 — Derating and conduit fill
```
Item W6 (F-13). Ampacity adjustment for >3 current-carrying conductors
per raceway segment, ambient correction (project setting, default 35 °C
ceiling), conduit trade size by 40% fill — all values in a new
PEC-VERIFY data file with section references. Tests: hand-checked cases
plus all 12 houses (no circuit violates after resizing; fill ≤ 40%).
```

### W8 — Dwelling load computation
```
Item W8 (F-14). Implement the PEC 2.20 dwelling calculation for the
feeder/main: general lighting at the unit load (24 VA/m², PEC-VERIFY)
used in the calc instead of warned, small-appliance and laundry
circuits at 1500 VA, fixed-appliance demand factor, A/C at 100%. The
schedule of loads shows each step. Tests: hand-computed example + all
12 houses (main breaker ≥ computed demand; no general-lighting-basis
warning).
```

### W7 — Service, feeder, one-line diagram
```
Item W7 (F-15). Service entrance (kWh meter, main breaker, service
conductors, grounding electrode conductor) and a one-line/riser diagram
generated from the panel + circuits as data (SVG for the PDF). Tests:
diagram lists every circuit with breaker and conductor; GEC sized from
its PEC-VERIFY table.
```

### W9 — Permit sheet set
```
Item W9 (F-16) — also a design item (pdf-sheet in the registry; the
reference is the real PH plan set from STATE.md open questions — ask me
for it if missing). A3 sheets with embedded fonts: E-1 legend + general
notes, E-2 lighting layout, E-3 power layout, E-4 one-line + schedule of
loads + design analysis; title block with project, owner, PEE name,
PRC/PTR, sheet number, revision, signature box. check:pdf asserts mm²,
every circuit id and every title-block field; render each page to PNG
for the visual check.
```

### A — Production foundation
```
Phase A (REVAMP-PLAN §4). Supabase auth, owner_id on projects,
owner-scoped REST and WebSocket, tier from profiles.tier (header only in
tests), refuse in-memory storage in production, Next rewrites /api and
/ws, trust proxy + CF-Connecting-IP. Tests: two users can't see or
change each other's projects over REST or WS. Ask me before any schema
migration is applied to a real database.
```

### W10 — Editing I
```
Item W10 (WIRING-AUDIT §4): undo/redo with a command history (Ctrl+Z,
Ctrl+Shift+Z), multi-select, copy/paste/duplicate, assign load →
circuit, split/merge circuits, lock a route and drag its vertices,
re-route one run. Engine changes first with tests; every new UI control
goes through the design rule.
```

### W11 — Editing II
```
Item W11: object snaps (endpoint, midpoint, perpendicular, intersection)
+ ortho, typed lengths while drawing, polyline walls, wall join/trim,
rooms detected from closed wall loops (test: rebuild the rooms of all 12
ResPlan houses from their walls, area within 5%), measure, dimensions,
text notes.
```

### C1 — DESIGN.md v2 tokens in code
```
Item C1 (REVAMP-PLAN Phase C step 1). Put DESIGN.md v2 tokens into
client/styles/tokens.css + the Tailwind theme, switch fonts to Archivo
(self-hosted @fontsource-variable/archivo), dark "conduit" default in the
editor and light "sheet" on marketing, remove HeroUI theme overrides.
Add npm run check:tokens (computed-style scan) and make it required.
Visual baselines change here — ask me before regenerating any.
```

### C2 — UI primitives
```
Item C2. Build the DESIGN.md §5 primitives in client/components/ui/ in
the order REVAMP-PLAN Phase C lists, ONE at a time, each through the
full template rule (CLAUDE.md §2): registry entry with captured real
reference → spec → /dev/gallery → gate → design-review subagent →
my sign-off. Include lib/notify.ts (toast API) and migrate the 4 legacy
sonner imports. C2 is done when every listed primitive is approved.
```

### C3 — Animations
```
Item C3. Build the DESIGN.md §6 animations as registry items, one at a
time: wire draw-in, violation flash, figure tick, hero sequence,
showcase reveal (real PBR textures + HDRI from the asset manifest).
Each passes check:motion on the laptop's RTX 3050 and the reduced-motion
screenshot.
```

### C4 — Screens
```
Item C4. Rebuild screens from approved primitives only, one per
session: projects dashboard → editor shell → landing → about → auth →
404/error → mobile summary. Each removes its legacy raw hex colors
(docs/RECONCILE.md "Known debt") and its HeroUI usage. C4 is done when
HeroUI is gone from package.json and the known-debt list is empty.
```

### W12 — DXF
```
Item W12. DXF export (walls, rooms, devices, wiring on named layers that
match the layer presets) and DXF import of walls. Test: export → import
round-trip of all 12 houses preserves walls within 1 cm.
```

### B — Product features
```
Item B (REVAMP-PLAN Phase B). One feature per session, each with an E2E
on a real ResPlan house: sample projects from the corpus + the real PH
bungalow, first-run guide, command palette (approved C2 primitive),
conflict-safe autosave, multi-storey, short-circuit analysis. Add each
as its own ROADMAP item before starting it.
```

### V5 — ResPlan vision converter + shippable weights
```
Item V5. CubiCasa5K weights are CC BY-NC-SA (research/demo only). Write
a ResPlan → YOLO + U-Net converter in solence-vision/scripts (ResPlan is
CC BY 4.0; render plans at a known scale, labels from the vector
geometry), register it in _common.py DATASETS, verify previews, retrain
on the laptop (yolo26s-seg 640/2, U-Net 512/2) detached, and compare on
the V3 fixtures against the CubiCasa weights. Only weights without an NC
source may be served by the hosted app; record their sources and sha256.
```

### D — Hosting
```
Phase D (REVAMP-PLAN §5). Everything runs on this laptop. Script ops/:
start.ps1 / stop.ps1 (build → web, API, vision on 127.0.0.1 → cloudflared
tunnel for one hostname, all detached and logged), health.ps1 (curl
every health endpoint). Vision serves V5 weights only. Ask me before any
DNS change, Windows service install or power-setting change.
```

### E — Pitch hardening
```
Phase E. Seeded demo accounts + reset script, sample projects from the
ResPlan houses, offline fallback via the Tailscale URL, Lighthouse ≥ 90 on
landing, backup video from Showcase. Real, cited market numbers only.
```
