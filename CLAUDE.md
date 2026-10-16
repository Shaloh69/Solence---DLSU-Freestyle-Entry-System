# Solence — rules for Claude Code

Monorepo: `client/` (Next.js 15 editor + 3D), `server/` (Express engine
API), `solence-vision/` (FastAPI floor-plan AI). Run locally: `HOW-TO.md`.
API contract: `server/docs/api.md`. Revamp plan: `docs/REVAMP-PLAN.md`.

Start of EVERY session, in this order:
1. Read `docs/STATE.md` (current item, last gate result, next step).
2. Read `docs/REVAMP-PLAN.md` only for the phase named in STATE.md.
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
  `npm run assets:fetch`, verified by hash. Never commit them.
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
- Secrets only in `.env*` (gitignored). Never print them in logs or
  screenshots.

## 5. Context management

- One item per session. After its gate passes: update STATE.md, commit,
  then tell the user to run `/clear` before the next item.
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
