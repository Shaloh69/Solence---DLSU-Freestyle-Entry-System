# routes/

The HTTP surface. Routes validate with Zod (`../schemas.ts`), call the
repository and engine, and return contract shapes — no domain math here.

- `health.ts` — service + Supabase status.
- `projects.ts` — everything project-scoped: CRUD, floor plan/panel/load
  placement, auto-lighting, simulate, results, PDF export. Simulation
  results are also pushed over the realtime gateway.

Adding an endpoint: Zod schema in `schemas.ts` → handler here (wrap
async handlers with the local `wrap` so errors reach the middleware) →
document in `../../docs/api.md` → mirror request/response types in
`client/lib/api-client/`. Tier limits are enforced with `tierOf(res)`
at the gate points (creation, simulate, export).
