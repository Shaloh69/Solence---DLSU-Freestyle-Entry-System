# Getting started — the pitch laptop

## What you have

`solence-revamp.bundle` — the revamp commits on top of `f197ddf` (your
`main`): rules + hooks + gate + DESIGN.md v2 · self-hosted fonts · W1
real-plan corpus · W1b router · W2 PEC sizing · docs (audit, prompts) ·
progress tracking + FormLabs3B · full docs reconcile. Claude Code merges it for you (kickoff M0).

## On the laptop (once)

1. Install: Git, Node 20+, Claude Code (`npm install -g @anthropic-ai/claude-code`).
2. Browser tools for design review: `claude mcp add playwright npx @playwright/mcp@latest`
3. Save the bundle, e.g. `C:\Users\<you>\Downloads\solence-revamp.bundle`.
4. Open a terminal in your repo folder, run `claude`, accept "trust this
   folder", paste **Kickoff (M0)** from `docs/PROMPTS.md` (it's also in
   the chat where you got the bundle) with your real bundle path.

Claude Code will: check your repo, merge the bundle on a `revamp` branch,
read all the existing docs, write `docs/RECONCILE.md`, fix outdated docs,
add anything missing to the roadmap, run the gate, commit, push, and
show the progress block. It stops for your OK at each step.

Everything — including the vision service, training and the public
pitch link — runs on this laptop (`docs/MACHINES.md`). The FormLabs3B
server was dropped on 2026-10-22.

## Every session after that

1. `claude` in the repo → the progress block appears automatically.
2. Paste **Session start**, then the prompt for the item STATE.md names.
3. Approve Claude's plan (files + tests), let it build.
4. It can't finish until the gate passes (Stop hook) and can't commit a
   failing gate (pre-commit hook).
5. `/clear`, next item.

## Where everything lives

| File | Role | Who edits |
|---|---|---|
| `CLAUDE.md` | the rules (incl. §7 progress, §8 one machine), loaded every session | you |
| `.claude/rules/*.md` | area rules (frontend, 3D, tests, engine), load only for matching files | you |
| `.claude/settings.json`, `.claude/hooks/*.mjs` | enforcement: progress + state at start, commit gate, protected files, post-edit checks, stop gate | you |
| `.claude/agents/design-review.md` | grades UI against its real reference | you |
| `DESIGN.md` | design system v2 "Conductor" | you (Claude must ask) |
| `docs/ROADMAP.json` | every item, phase, weight, status → the % | Claude per item |
| `docs/STATE.md` | now / next / passed / decisions / open questions | Claude per item |
| `docs/REVAMP-PLAN.md` | audit + phases 0, W, A–E | Claude per item |
| `docs/WIRING-AUDIT.md` | wiring/PEC/CAD/layer findings + feature research | Claude per W-item |
| `docs/MACHINES.md` | the pitch laptop: hardware, vision service + training, perf checks | you |
| `docs/PROMPTS.md` | what you paste | you |
| `docs/RECONCILE.md` | written by the kickoff: old docs vs revamp | Claude (M0) |
| `scripts/gate.mjs`, `gate.config.json`, `progress.mjs` | the gate and the % | Claude may only tighten |
| `server/tests/thresholds.json`, `scripts/hygiene-allowlist.json` | protected limits | you only |
| `test-assets/plans/resplan/` | 12 real houses (CC BY 4.0) | regenerate via script |

## Things only you can provide

- A real Philippine residential electrical plan set (with permission) —
  template for the permit sheets (W9) and the pitch demo house.
- A licensed EE to confirm every `PEC-VERIFY` value before real permit use.
- The domain choice before Phase D.
