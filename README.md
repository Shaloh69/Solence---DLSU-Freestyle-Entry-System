# Solence

**Draw a floor plan. Get a complete, code-compliant wiring design — automatically.**

Solence is an automatic electrical wiring simulator for the Philippine market. It ingests a floor plan, auto-routes all branch wiring, auto-sizes breakers and conductors, renders a 3D wiring overlay, checks Philippine Electrical Code (PEC) compliance in real time, generates code-aware lighting layouts, and exports permit-ready documents.

> Formerly **BEPVY_Sims**, a luminance/lamp-quantity simulator. That illumination engine wasn't discarded — it powers Solence's lighting design layer (auto fixture placement, per-room lux analysis, illuminance compliance, lux heatmap), fully integrated into the project editor. The old standalone simulator page was removed once the integration shipped (brief §9.1).

## Core loop

1. Upload or draw a floor plan (walls, rooms, doors/windows)
2. Place electrical loads (outlets, lighting, HVAC, equipment) with ratings — or auto-generate lighting per room via the lumen method
3. Auto-route wiring — wall-following pathfinding from each load to the panel
4. Auto-calculate branch/feeder loads and demand factors per PEC Section 2
5. Auto-size breakers and conductors (AWG/mm²) per PEC Table 3.10.1
6. Review the 3D wiring overlay with live PEC violation flags and lux heatmap
7. Export a permit-ready PDF (wiring diagram, panel schedule, conductor schedule)

## Repository map

```
/client            Next.js 15 frontend — CAD-style editor (HeroUI, Tailwind, R3F)
/server            Express + TypeScript API — the entire domain engine
/solence-vision    Python + FastAPI AI floor-plan recognition (v2, scaffolded)
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

Tests: `npm test` (server engine + API suites) · `cd solence-vision && pytest tests/` (fusion + API contract).

## Hosting via Cloudflare Tunnel (free, no port forwarding)

Full walkthrough with every command: [docs/HOSTING.md](docs/HOSTING.md)
— covers exposing all three services under your own domain and
SSH access to run commands on the host remotely (`git pull`, manage
the vision venv, kick off training) from any other machine.

```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel login
cloudflared tunnel create solence
# then edit C:\Users\<you>\.cloudflared\config.yml — see docs/HOSTING.md §3
cloudflared tunnel route dns solence app.yourdomain.com
cloudflared tunnel route dns solence api.yourdomain.com
cloudflared tunnel route dns solence vision.yourdomain.com
cloudflared tunnel route dns solence ssh.yourdomain.com
npm run tunnel
```

## PEC data caveat

⚠️ PEC ampacity tables, demand factors, rule thresholds, and IES illuminance targets in `server/src/engine/**` data files contain **placeholder values that must be supplied/verified by a licensed electrical engineer against the current PEC edition** before any output is used for a real permit submission. Every such file is flagged `PEC-VERIFY` or `LIGHTING-VERIFY`, and every exported PDF carries the disclaimer.

## License

Licensed under the [MIT license](LICENSE).
