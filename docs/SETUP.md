# Getting the revamp into your repo and working in Claude Code

## What you're receiving

Six commits on top of `f197ddf` (your current `main`):

| Commit | What |
|---|---|
| revamp: harness, rules, DESIGN.md v2… | `CLAUDE.md`, `.claude/rules/*`, `.claude/settings.json` + hooks, gate scripts, DESIGN.md v2, registry, asset manifest, REVAMP-PLAN, STATE |
| 0.2 | self-hosted fonts, `.githooks/pre-commit` |
| W1 | ResPlan real-plan corpus + converter + 85 engine checks |
| W1b | concealed-conduit router |
| W2 | PEC 2017 sizing + rules + 230 V |
| docs | WIRING-AUDIT, PROMPTS, SETUP, plan/state updates |

## 1. Put it in the repo (on the server PC)

You get `solence-revamp.bundle` (all six commits in one file).

```powershell
cd C:\Projects\Solence            # your clone
git status                        # must be clean; commit or stash first
git checkout -b revamp            # work on a branch, not main
git pull C:\path\to\solence-revamp.bundle HEAD
git log --oneline -7              # the six commits on top of f197ddf
```

(No bundle? `git am C:\path\to\patches\*.patch` does the same from the
patch files.)

Then push the branch so it's on GitHub too:

```powershell
git push -u origin revamp
```

## 2. Install and prove the gate

```powershell
npm install            # root; its "prepare" script sets core.hooksPath=.githooks
npm run install:all    # client + server
npm run gate           # must print: GATE PASSED · full
```

Every `git commit` now runs the full gate first (about 2 minutes, mostly
the Next.js build). If it fails, the commit is refused and
`.artifacts/gate-summary.md` says why.

## 3. Claude Code

```powershell
npm install -g @anthropic-ai/claude-code       # if not installed
claude mcp add playwright npx @playwright/mcp@latest   # browser tools for design review
cd C:\Projects\Solence
claude
```

On first start Claude Code asks to trust the project — accept, so the
hooks in `.claude/settings.json` load. The SessionStart hook prints
`docs/STATE.md` automatically.

## 4. The loop

1. Paste **Session start** from `docs/PROMPTS.md`.
2. Paste the prompt for the item STATE.md names (first one: **0.1**).
3. Approve Claude's file/test list, let it build.
4. Claude finishes only when the gate passes and STATE.md is updated
   (the Stop hook blocks it otherwise).
5. `/clear`, next item.

## 5. Where everything lives

| File | Role | Who edits |
|---|---|---|
| `CLAUDE.md` | the rules (<200 lines), loaded every session | you |
| `.claude/rules/frontend.md`, `three-d.md`, `tests.md`, `engine.md` | area rules, load only when matching files are touched | you |
| `.claude/settings.json`, `.claude/hooks/*.mjs` | enforcement: commit gate, protected files, post-edit checks, stop gate, session state | you |
| `.claude/agents/design-review.md` | grades UI against its real reference, never the builder | you |
| `DESIGN.md` | design system v2 "Conductor" | you (Claude must ask) |
| `docs/REVAMP-PLAN.md` | audit + all phases | you / Claude per item |
| `docs/WIRING-AUDIT.md` | wiring, PEC, CAD, layers findings + feature research | Claude per W-item |
| `docs/STATE.md` | current item, next items, decisions, open questions | Claude every item |
| `docs/PROMPTS.md` | what you paste | you |
| `scripts/gate.mjs`, `gate.config.json` | the gate; steps become required as they're built | Claude may only tighten |
| `server/tests/thresholds.json`, `scripts/hygiene-allowlist.json` | protected limits | you only |
| `design-refs/registry.json` | real references per page/component | Claude, you sign off |
| `test-assets/plans/resplan/` | 12 real houses (CC BY 4.0) + converter output | regenerate via script |
| `test-assets/manifest.json` | every real asset with license + sha256 | Claude, you approve licenses |

## 6. Things only you can provide

- A real Philippine residential electrical plan set (with permission) —
  the template for the permit sheets (W9) and the pitch demo house.
- A licensed EE to confirm every `PEC-VERIFY` value before any real permit use.
- The domain choice before Phase D.
