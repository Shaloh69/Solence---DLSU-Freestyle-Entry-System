# Solence

**Draw a floor plan. Get a complete, code-compliant wiring design — automatically.**

Solence is an automatic electrical wiring simulator for the Philippine market. It ingests a floor plan, auto-routes all branch wiring, auto-sizes breakers and conductors, renders a 3D wiring overlay, checks Philippine Electrical Code (PEC) compliance in real time, and exports permit-ready documents.

> Formerly **BEPVY_Sims**, a luminance/lamp-quantity simulator. The lighting simulator remains available at `/simulator`.

## Core loop

1. Upload or draw a floor plan
2. Place electrical loads (outlets, lighting, HVAC, equipment) with ratings
3. Auto-route wiring — wall-following pathfinding from each load to the panel
4. Auto-calculate branch/feeder loads and demand factors per PEC Section 2
5. Auto-size breakers and conductors (AWG/mm²) per PEC Table 3.10.1
6. Review the 3D wiring overlay with live PEC violation flags
7. Export a permit-ready PDF (wiring diagram, panel schedule, conductor schedule)

## Architecture

```
/          Next.js 15 (App Router) frontend — HeroUI v2, Tailwind, Three.js
/server    Express + TypeScript API — routing engine, load calc, sizing,
           PEC compliance, PDF export. Supabase (Postgres + Storage + Auth).
```

All wiring-simulation domain logic (routing, load calculation, PEC checks, PDF export) lives in the Express service. The frontend talks to it through a typed API client in `lib/api-client/`.

## Development

### Frontend (Next.js)

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
```

### Backend (Express API)

```bash
cd server
npm install
cp .env.example .env         # fill in values
npm run dev                  # http://localhost:4000
```

Run both from the repo root in two terminals, or `npm run dev:all` (requires backend deps installed).

## PEC data caveat

⚠️ PEC ampacity tables, demand factors, and rule thresholds in `server/src/engine/**/pec-*.ts` contain **placeholder values that must be supplied/verified by a licensed electrical engineer against the current PEC edition** before any output is used for a real permit submission. Each data file is flagged with a `PEC-VERIFY` comment.

## License

Licensed under the [MIT license](LICENSE).
