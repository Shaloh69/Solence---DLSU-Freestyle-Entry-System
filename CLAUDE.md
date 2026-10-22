# Solence — rules for Claude Code

Monorepo: `client/` (Next.js 15 editor + 3D), `server/` (Express engine
API), `solence-vision/` (FastAPI floor-plan AI). Run locally: `HOW-TO.md`.
API contract: `server/docs/api.md`. Revamp plan: `docs/REVAMP-PLAN.md`.
Machines (`docs/MACHINES.md`): this laptop runs Claude Code, dev, the
vision service and model training (RTX 3050 Laptop, 4 GB VRAM);
**FormLabs3B** (reached over Tailscale as `formlabs3b`) hosts the app
and runs GPU perf checks.

Start of EVERY session, in this order:
0. Show the progress block (`npm run progress`, also printed by the
   SessionStart hook) verbatim as the first thing in your first reply.
1. Read `docs/STATE.md` (current item, last gate result, next step).
2. Read `docs/REVAMP-PLAN.md` only for the phase named in STATE.md; for
   W-items also the `docs/WIRING-AUDIT.md` rows (F-n) the item cites.
3. Say in one line which single item you are working on. Nothing else.

## 1. The gate — nothing moves forward until it passes

- Work on **exactly one item** at a time (one feature, one component,
  one page, one animation). STATE.md names it. Never start the next item
  while the current one is not `passed`.
- "Done" means `npm run gate` exits 0 **and** its summary line is in
  STATE.md. Not "tests should pass", not "looks right".
- Never weaken a check to make it pass: no skipping tests, no `.only`,
  no raising thresholds, no deleting baselines, no `@ts-ignore`,
  no `eslint-disable`, no `expect(true)`. If a threshold is genuinely
  wrong, stop and ask the user, with evidence.
- A failing gate is fixed at the cause. Re-run the full gate after the
  fix, not only the test that failed.
- Visual baselines are (re)generated only when the user says so in this
  session; the PR lists which baselines changed and why.
- Commits happen only after a passing gate (enforced by a hook).

## 2. Design — template first, always

`DESIGN.md` is the design system and it binds. Rules on top of it:

- **No reference, no build.** Before building any page, component, or
  animation, add its entry to `design-refs/registry.json` with at least
  one real reference: a live product page or an official published
  component/template (URL + Playwright capture). Invented "inspiration"
  does not count. AI-generated images do not count.
- Then write `docs/component-specs/<id>.md`: reference used, tokens,
  every state (default/hover/active/focus/disabled/loading/empty/error),
  motion, mobile behavior.
- Build it in isolation first on `/dev/gallery`, all states, both themes.
  Only after it passes does it go into a real screen.
- It is `approved` only when ALL hold: Playwright visual + a11y + token
  + motion checks pass, the side-by-side report vs its reference exists,
  the `design-review` subagent (not you, the builder) wrote `pass`, and
  the user signed off. Until then its status is `in-review`.
- Compose screens only from `approved` components. A screen using an
  unapproved component cannot pass the gate (`npm run check:refs`).
- Never fall back to library defaults (HeroUI/Radix default colors,
  radii, shadows). If a token is missing from DESIGN.md, stop and ask.

## 3. Tests use real data

- Floor plans, 3D models, textures and HDRIs in tests come from
  `test-assets/manifest.json`: real downloaded files with source URL,
  license, author, and sha256. Toy fixtures are fine for unit tests of
  math, never as the only proof a feature works.
- Every asset entry carries a license. NC-licensed sets (CubiCasa5K is
  CC BY-NC-SA 4.0) are test/research only — never shipped in
  `client/public/`.
- Binaries live in `test-assets/cache/` (gitignored), fetched by
  `npm run assets:fetch` (created in item 0.3), verified by hash. Never
  commit them.
- Each feature's E2E runs on at least one real plan from the corpus end
  to end: import → recognize/edit → simulate → compliance → PDF → 3D.

## 4. Engineering hard rules

- **PEC/IES figures are placeholders.** Code tables are flagged
  `PEC-VERIFY` / `LIGHTING-VERIFY`; never present them as verified,
  never inline compliance numbers outside a flagged data file.
- **No domain math in the frontend.** Everything comes from the Express
  engine via `client/lib/api-client/`.
- Contract types stay mirrored between `server/src/engine/types.ts` and
  `client/lib/api-client/types.ts`; change both in the same commit,
  with a test.
- From Phase A on, every endpoint is owner-scoped. A new endpoint
  without an ownership test fails review.
- Secrets only in `.env*` (gitignored). You cannot read `.env` files
  (settings deny it): when a value must change, tell the user the exact
  line to add. Never print secrets in logs or screenshots.

## 5. Context management

- One item at a time. After its gate passes: update STATE.md and
  ROADMAP.json, commit. Then, if context is still fresh (no compaction
  this session and well under half the window used), **don't end the
  session**: show the progress block, put `CONTINUING WITH <next id>` on
  its own line, and start the next item's prompt from docs/PROMPTS.md in
  this session (pre-build list first, wait for OK). Otherwise hand off (§9).
- If a session runs long, `/compact` with a focus line, e.g.
  "keep: current item, failing checks, files touched".
- Broad searches go to the `Explore` subagent; take its conclusion, not
  file dumps.
- Design review and triage of large reports go to subagents with fresh
  context. The builder never grades its own work.
- Never paste full logs, test output, or screenshots into the
  conversation. Write them to `.artifacts/` (gitignored); read only the
  summary or the failing lines.
- Read large files by section (offset/limit): `editor-store.ts`,
  `InspectorPanel.tsx`, `FloorPlanCanvas.tsx`, `app/page.tsx`.
- Area rules live in `.claude/rules/` and load only when you touch
  matching files. Keep this file under 200 lines.
- Durable decisions go in STATE.md "Decisions", one line each, so the
  next session doesn't re-decide them.

## 6. Stop and ask when

- A check fails and the fix needs a design or engineering decision.
- No real reference can be found for something that must be built.
- An asset's license is unclear.
- Any change to PEC data files, auth, tiers/billing, or hosting config.
- Anything irreversible: deleting data, force-push, DNS changes.

## 7. Progress — always visible, never guessed

- Progress is computed by `npm run progress` from `docs/ROADMAP.json`
  (weighted items: S=1, M=2, L=3). Never estimate a percentage by hand.
- Show the progress block: at the start of every session, after every
  gate run, when an item passes, and in any answer about status. Show the
  one-line form (`node scripts/progress.mjs --line`) at the end of every
  reply that changed files.
- When an item passes: set it `done` in ROADMAP.json, add its `- <id> (`
  line under STATE.md ## Passed, set the next item `in-progress` and
  name it on STATE.md's `- Item:` line — the gate's `progress` step
  fails otherwise.
- New work discovered mid-item becomes a new ROADMAP item (with weight
  and phase), not part of the current one.

## 8. Two machines

- Code changes happen on the laptop. FormLabs3B gets them only by
  `git pull` over SSH (`ssh <user>@formlabs3b`) — never edit files there.
- Vision service and training run on the laptop: data and runs under
  `SOLENCE_VISION_DATA` (C:), `yolo26s-seg --imgsz 640 --batch 2` and
  U-Net `--imgsz 512 --batch 2` (4 GB VRAM). CubiCasa5K-trained weights
  are research/demo-only (CC BY-NC-SA) until V5.
- GPU benchmarks and `check:motion` perf assertions run on FormLabs3B.
- Start long jobs (training, services) detached (docs/HOSTING.md §3) and
  read their logs; don't hold the session open on them.
- Dev uses the laptop's vision service: `VISION_URL=http://localhost:8000`
  in `server/.env`; it binds to 127.0.0.1 unless the user says otherwise.
- Never expose FormLabs3B ports publicly except through the Cloudflare
  tunnel in Phase D. Ask before changing its firewall, services or DNS.

## 9. Every session ends with the handoff

- The last thing in your final reply of a session is the output of
  `npm run handoff`, pasted **verbatim** inside the reply: the progress
  block (current %) and the exact prompt the user pastes after `/clear`.
  Never write the next prompt yourself and never paraphrase it — it is
  assembled from docs/PROMPTS.md for the item ROADMAP.json has
  in-progress.
- "End of a session" means any of: the user says stop, pause, or done
  for today; you are blocked waiting on the user's decision (beyond the
  next item's pre-build OK); the context is getting long and you are
  about to suggest `/compact` or `/clear`. An item passing is not by
  itself the end — continue per §5 while context is fresh. Mid-item,
  update STATE.md first so the resume prompt picks up where you stopped.
- Before running it: ROADMAP.json and STATE.md must name the right
  in-progress item (the next unblocked todo item after the one that
  passed).
- Enforced: after a commit in a session, the Stop hook won't let the
  session end until a reply contains the `SESSION HANDOFF` block or a
  `CONTINUING WITH <id>` line naming ROADMAP's in-progress item; the
  gate's `handoff` step fails if any remaining item has no prompt.
- New roadmap items need a `### <id> — title` prompt in docs/PROMPTS.md
  in the same commit.
