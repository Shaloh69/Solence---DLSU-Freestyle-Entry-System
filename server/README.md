# solence-api (Express backend)

The domain engine and REST/WebSocket API for Solence. All wiring
simulation logic — routing, load calc, breaker/conductor sizing, PEC
compliance, photometrics, PDF export — lives here, so any client (the
Next.js frontend today, the Firm-tier API or a mobile client later)
gets identical results.

Run/test/deploy instructions: [HOW-TO.md](HOW-TO.md). API contract:
[docs/api.md](docs/api.md).

## What lives here

- `src/engine/` — the pure domain engine, no Express imports; see its README.
- `src/routes/` — HTTP surface, all under `/api`: `health.ts`,
  `projects.ts` (projects, floor plan, panel, loads, lighting, simulate,
  results, export) and `vision.ts` (`POST /projects/:id/recognize`).
- `src/db/` — repository layer: in-memory (dev/tests) or Supabase.
- `src/realtime/` — WebSocket gateway pushing simulation results per project.
- `src/middleware/` — error handling (Zod-aware), tier gating and rate
  limiting (`rate-limit.ts`).
- `src/schemas.ts` — Zod request validation; the runtime half of docs/api.md.
- `src/tiers.ts` — Free/Pro/Firm/LGU feature flags.
- `tests/` — vitest: engine unit tests, supertest API integration tests,
  and real-plan suites (`real-plans`, `routing-real-plans`,
  `pec-alignment`) over the 12 ResPlan houses in `test-assets/plans/resplan/`.
  Limits in `tests/thresholds.json` (protected — only the user loosens them).
- `supabase/schema.sql` — the Postgres schema to run in Supabase.

## Hosting (Cloudflare Tunnel)

> Runs on **the pitch laptop** (docs/MACHINES.md). Until Phase D picks a
> domain, the public demo path is a Quick Tunnel to the client only; the
> config below is the Phase D named-tunnel setup.

Full guide: [docs/HOSTING.md](../docs/HOSTING.md). Once tunneled,
allow the public frontend origin through CORS:

```powershell
# server/.env
CORS_ORIGINS=https://app.yourdomain.com
```

Ingress line for this service in `~/.cloudflared/config.yml` (the
`/ws` realtime gateway proxies over the same hostname — no separate
WebSocket config needed):

```yaml
  - hostname: api.yourdomain.com
    service: http://localhost:4000
```

## Conventions

- Engine code never imports Express types; routes never do math.
- Every PEC/IES numeric value lives in a dedicated data file flagged
  `PEC-VERIFY`/`LIGHTING-VERIFY` (`sizing/pec-table-3-10-1.ts`,
  `sizing/breaker-sizes.ts`, `sizing/pec-overcurrent.ts`,
  `load-calc/pec-demand-factors.ts`, `lighting/lighting-data.ts`); router
  weights are `DESIGN-VERIFY` in `routing/routing-costs.ts`. A licensed EE
  must confirm figures before permit use. Never inline them elsewhere.
- Engine rules for Claude Code: `.claude/rules/engine.md`.
- New endpoints: add the Zod schema in `schemas.ts`, document the shape
  in `docs/api.md`, and mirror types in `client/lib/api-client/types.ts`.
