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
- `src/routes/` — HTTP surface (projects, loads, simulate, lighting, export).
- `src/db/` — repository layer: in-memory (dev/tests) or Supabase.
- `src/realtime/` — WebSocket gateway pushing simulation results per project.
- `src/middleware/` — error handling (Zod-aware) and tier gating.
- `src/schemas.ts` — Zod request validation; the runtime half of docs/api.md.
- `src/tiers.ts` — Free/Pro/Firm/LGU feature flags.
- `tests/` — vitest: engine unit tests + supertest API integration tests.
- `supabase/schema.sql` — the Postgres schema to run in Supabase.

## Conventions

- Engine code never imports Express types; routes never do math.
- Every PEC/IES numeric value lives in a dedicated data file flagged
  `PEC-VERIFY`/`LIGHTING-VERIFY` — a licensed EE must confirm figures
  before permit use. Do not inline code-compliance numbers elsewhere.
- New endpoints: add the Zod schema in `schemas.ts`, document the shape
  in `docs/api.md`, and mirror types in `client/lib/api-client/types.ts`.
