# Solence

**Draw a floor plan. Get a complete, code-compliant wiring design — automatically.**

Solence is an automatic electrical wiring simulator for the Philippine market. It ingests a floor plan, auto-routes all branch wiring, auto-sizes breakers and conductors, renders a 3D wiring overlay, checks Philippine Electrical Code (PEC) compliance in real time, generates code-aware lighting layouts, and exports permit-ready documents.

> Formerly **BEPVY_Sims**, a luminance/lamp-quantity simulator. That illumination engine wasn't discarded — it powers Solence's lighting design layer (auto fixture placement, per-room lux analysis, illuminance compliance, lux heatmap), fully integrated into the project editor. The old standalone simulator page was removed once the integration shipped (brief §9.1).

## Core loop

1. Upload or draw a floor plan (walls, rooms, doors/windows)
2. Place electrical loads (outlets, lighting, HVAC, equipment) with ratings — or auto-generate lighting per room via the lumen method
3. Auto-route wiring — concealed-conduit routing in the ceiling plane: runs follow walls, pass through a wall where that beats the detour (each penetration counted), and every device is fed from its own room's side
4. Auto-calculate branch/feeder loads and demand factors per PEC Section 2
5. Auto-size breakers and conductors (mm² / AWG) per PEC 2017: 125% continuous, 60 °C terminations for circuits ≤100 A, small-conductor limits (2.0 mm² ≤ 15 A, 3.5 mm² ≤ 20 A, 5.5 mm² ≤ 30 A), equipment grounding conductor per Table 2.50.6.13; default system 230 V single-phase (PH residential)
6. Review the 3D wiring overlay with live PEC violation flags and lux heatmap
7. Export a permit-ready PDF (wiring diagram, panel schedule, conductor schedule)

## Revamp in progress (pitching contest)

The project is being taken to production in gated phases. Start here:

- **Getting started (the pitch laptop):** [docs/SETUP.md](docs/SETUP.md)
- **What to paste into Claude Code:** [docs/PROMPTS.md](docs/PROMPTS.md)
- **Where we are:** `npm run progress` (computed from [docs/ROADMAP.json](docs/ROADMAP.json)) and [docs/STATE.md](docs/STATE.md)
- **Plan and phases:** [docs/REVAMP-PLAN.md](docs/REVAMP-PLAN.md) · wiring/PEC findings: [docs/WIRING-AUDIT.md](docs/WIRING-AUDIT.md)
- **Rules for Claude Code:** [CLAUDE.md](CLAUDE.md), `.claude/rules/`, design system [DESIGN.md](DESIGN.md) (v2 — the current UI is v1 and is rebuilt in Phase C)
- **Gate:** `npm run gate` — every commit runs it (`.githooks/pre-commit`)

## Repository map

```
/client            Next.js 15 frontend — CAD-style editor (HeroUI, Tailwind, R3F)
/server            Express + TypeScript API — the entire domain engine
/solence-vision    Python + FastAPI AI floor-plan recognition (v2, models trained)
```

Each folder has its own README explaining what lives inside and how to
extend it; start with:

- **Run everything locally:** [HOW-TO.md](HOW-TO.md)
- Frontend map: [client/README.md](client/README.md)
- Backend map + API contract: [server/README.md](server/README.md), [server/docs/api.md](server/docs/api.md)
- Engine internals: [server/src/engine/README.md](server/src/engine/README.md) — and the rule-authoring guide in [server/src/engine/compliance/README.md](server/src/engine/compliance/README.md)
- AI service: [solence-vision/README.md](solence-vision/README.md), training walkthrough in [solence-vision/HOW-TO.md](solence-vision/HOW-TO.md)

All wiring-simulation domain logic (routing, load calculation, PEC checks, photometrics, PDF export) lives in the Express service; the frontend talks to it through the typed client in `client/lib/api-client/` and receives live results over the `/ws` gateway.

## Quick start

```bash
npm install            # root dev tooling (concurrently)
npm run install:all    # client + server dependencies

cp client/.env.example client/.env.local
cp server/.env.example server/.env

npm run dev            # client :3000 + API :4000 (in-memory storage until Supabase is configured)
```

Tests: `npm test` (server engine + API suites, incl. 12 real ResPlan houses in `test-assets/plans/resplan/`) · `cd solence-vision && pytest tests/` (fusion + API contract) · `npm run gate` (everything a commit must pass).

## Machines and hosting

- **One laptop runs everything** — development, Claude Code, web + API,
  the vision service, model training (RTX 3050, 4 GB) and GPU perf
  checks. Setup: [docs/MACHINES.md](docs/MACHINES.md).
- Public URL: Cloudflare named tunnel from the laptop once a domain is
  chosen (Phase D); a Quick Tunnel (`cloudflared tunnel --url
  http://localhost:3000`) remains the zero-setup fallback for a short
  demo. Details: [docs/HOSTING.md](docs/HOSTING.md).

## PEC data caveat

⚠️ PEC ampacity tables, demand factors, rule thresholds, and IES illuminance targets in `server/src/engine/**` data files contain **placeholder values that must be supplied/verified by a licensed electrical engineer against the current PEC edition** before any output is used for a real permit submission. Every such file is flagged `PEC-VERIFY` or `LIGHTING-VERIFY` (router cost weights: `DESIGN-VERIFY`), and every exported PDF carries the disclaimer. The PEC 2017 values added in the revamp come from an unofficial transcription — see [docs/WIRING-AUDIT.md](docs/WIRING-AUDIT.md) §7.

## License

Licensed under the [MIT license](LICENSE).
