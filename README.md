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

## Repository structure

```
/client            Next.js 15 (App Router) frontend — HeroUI v2, Tailwind, Three.js
/server            Express + TypeScript API — routing engine, load calc, sizing,
                   PEC compliance, PDF export. Supabase (Postgres + Storage + Auth).
/solence-vision    v2 AI floor-plan recognition (Python + FastAPI) — placeholder,
                   not started until the core simulator works end-to-end.
```

All wiring-simulation domain logic (routing, load calculation, PEC checks, PDF export) lives in the Express service. The frontend talks to it through a typed API client in `client/lib/api-client/`.

## Development

```bash
npm install            # root dev tooling (concurrently)
npm run install:all    # client + server dependencies

cp client/.env.example client/.env.local   # fill in values
cp server/.env.example server/.env         # fill in values

npm run dev            # both apps: client on :3000, server on :4000
```

Or individually: `npm run dev:client` / `npm run dev:server`.

- API contract: [server/docs/api.md](server/docs/api.md)
- Server tests: `npm test` (vitest — engine unit tests + API integration tests)
- Supabase schema: [server/supabase/schema.sql](server/supabase/schema.sql) (the API falls back to in-memory storage when Supabase is not configured)

## PEC data caveat

⚠️ PEC ampacity tables, demand factors, and rule thresholds in `server/src/engine/**/pec-*.ts` contain **placeholder values that must be supplied/verified by a licensed electrical engineer against the current PEC edition** before any output is used for a real permit submission. Each data file is flagged with a `PEC-VERIFY` comment.

## License

Licensed under the [MIT license](LICENSE).
