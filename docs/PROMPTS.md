# Claude Code prompts for the Solence revamp

How to use: the very first time, paste **Kickoff (M0)** — it merges the
revamp into your repo. After that, every session: open Claude Code in
the repo root, paste **Session start**, then the prompt for the item
`docs/STATE.md` names. One item per session.
When the gate passes and Claude has committed, run `/clear` and start the
next item. Everything Claude must obey is already in `CLAUDE.md`,
`.claude/rules/`, `DESIGN.md` and enforced by hooks — the prompts only
point at the work.

Order (also in `docs/STATE.md`, progress from `docs/ROADMAP.json`):
M0 → 0.1 → 0.1b → W3 → W4 (+0.4) → 0.3 → 0.5 → 0.6 → W5 → W6 → W8 → W7 →
W9 → A → W10 → W11 → C1…C4 → W12 → B → D → E

---

## Kickoff (M0) — first session only

Put `solence-revamp.bundle` somewhere on the laptop first (e.g.
`C:\Users\<you>\Downloads\solence-revamp.bundle`), open a terminal in
your repo folder, run `claude`, then paste — with the real bundle path:

```
Kickoff, item M0. I have the Solence revamp as a git bundle at
C:\Users\<you>\Downloads\solence-revamp.bundle — 7 commits built on top
of commit f197ddf of this repo. Treat it as the NEW PHASES of this
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
4. Write docs/RECONCILE.md with four lists:
   (a) what the old docs describe that the revamp keeps;
   (b) what the revamp changed (DESIGN.md v1 → v2, the router model,
       230 V default, PEC sizing, fonts, hosting on FormLabs3B …);
   (c) statements in the old docs that are now false — fix each one in
       place in that doc (for example routing described as wall-band A*,
       120/240 V defaults, Quick-Tunnel-only hosting, "server PC");
   (d) features, plans or roadmap items in the old docs or code that
       docs/ROADMAP.json doesn't cover — add each as a new ROADMAP item
       with a phase, a weight (S=1, M=2, L=3) and status todo; mark items
       the old code already delivers as done only if a test proves it.
   Don't renumber existing items. STOP: show me the ROADMAP.json diff
   and the new progress block.
5. `npm install` (root — sets the git hooks path), `npm run install:all`,
   `npm run gate`. It must say GATE PASSED; if not, fix the cause, never
   the check.
6. Mark M0 done (ROADMAP.json + a `- M0 (` line under STATE.md ## Passed),
   set 0.1 in-progress and name it on STATE.md's `- Item:` line, commit
   (the pre-commit gate runs), then `git push -u origin revamp`.
7. Show the progress block (`npm run progress`) and tell me to /clear and
   paste the 0.1 prompt from docs/PROMPTS.md.
```

## Session start (paste first, every session)

```
Show the progress block from the SessionStart hook first. Read CLAUDE.md
and docs/STATE.md. Work only on the item STATE.md names as "Now". Before writing code: (1) list the files you will touch, (2) list
the tests/checks that will prove it works, including which ones must
fail on the current code first, (3) name the real-plan or real-asset
data they use. Wait for my OK on that list, then build. You are done
only when `node scripts/gate.mjs` passes, STATE.md is updated (item moved
to Passed with its gate line), and the commit went through the
pre-commit gate, ROADMAP.json marks it done, and you've shown the new
progress block. Then stop and tell me to /clear.
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

**End of session**
```
Update docs/STATE.md (Now / Next / Passed with the gate line / Decisions /
Open questions). Keep it under 60 lines. Commit. Then tell me to /clear.
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

### 0.1b — FormLabs3B on the tailnet
Do the manual part of docs/MACHINES.md first (§1 join the tailnet, §2
keep it connected, §4 OpenSSH as Administrator on FormLabs3B — these need
you at that PC once). Then:
```
Item 0.1b. FormLabs3B is on the tailnet as `formlabs3b` with OpenSSH.
Over `ssh <my-windows-user>@formlabs3b`: check `tailscale status`,
`nvidia-smi`, node/npm/python/git versions; clone the repo to
C:\Projects\Solence (or pull if it exists), checkout `revamp`, run
`npm install`, `npm run install:all`, `npm run gate`. Set up the vision
venv per solence-vision/HOW-TO.md, start the vision service detached
(docs/HOSTING.md §3) with `--host 0.0.0.0 --port 8000`, and confirm from
this laptop that `curl http://formlabs3b:8000/health` answers. Set
VISION_URL=http://formlabs3b:8000 in server/.env on the laptop (not
committed). Record versions, GPU, paths in CLAUDE.local.md and the
result in STATE.md; mark 0.1b done, set W3 in-progress, commit, show
progress. Ask me before changing any firewall rule or Windows service.
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

### Phase A — Production foundation
```
Phase A (REVAMP-PLAN §4). Supabase auth, owner_id on projects,
owner-scoped REST and WebSocket, tier from profiles.tier (header only in
tests), refuse in-memory storage in production, Next rewrites /api and
/ws, trust proxy + CF-Connecting-IP. Tests: two users can't see or
change each other's projects over REST or WS. Ask me before any schema
migration is applied to a real database.
```

### W10 / W11 — CAD editing
```
Item W10 (WIRING-AUDIT §4): undo/redo with a command history (Ctrl+Z,
Ctrl+Shift+Z), multi-select, copy/paste/duplicate, assign load →
circuit, split/merge circuits, lock a route and drag its vertices,
re-route one run. Engine changes first with tests; every new UI control
goes through the design rule.
```
```
Item W11: object snaps (endpoint, midpoint, perpendicular, intersection)
+ ortho, typed lengths while drawing, polyline walls, wall join/trim,
rooms detected from closed wall loops (test: rebuild the rooms of all 12
ResPlan houses from their walls, area within 5%), measure, dimensions,
text notes.
```

### Phase C — Design rebuild (one prompt per step)
```
Phase C step <C1 tokens | C2 primitive "<id>" | C3 animation "<id>" |
C4 screen "<id>" | C5 permit sheet>. Follow CLAUDE.md §2 exactly; one
registry item in review at a time.
```

### W12 — DXF
```
Item W12. DXF export (walls, rooms, devices, wiring on named layers that
match the layer presets) and DXF import of walls. Test: export → import
round-trip of all 12 houses preserves walls within 1 cm.
```

### Phase D — Hosting
```
Phase D (REVAMP-PLAN §5). Script ops/ for this PC: cloudflared named
tunnel as a Windows service for one hostname, PM2 or NSSM services for
web/api/vision, deploy.ps1 (pull → install → gate → restart),
health.ps1. Stop and ask me before any DNS change.
```

### Phase E — Pitch hardening
```
Phase E. Seeded demo accounts + reset script, sample projects from the
ResPlan houses, offline fallback via the Tailscale URL, Lighthouse ≥ 90 on
landing, backup video from Showcase. Real, cited market numbers only.
```
