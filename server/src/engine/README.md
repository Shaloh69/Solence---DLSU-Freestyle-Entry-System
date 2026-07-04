# engine/

The pure domain engine: floor plan + panel + loads in, routed wiring +
sized circuits + schedules + violations out. Everything here is plain
TypeScript functions with no Express/DB imports, which is what makes the
whole thing unit-testable — these are the parts a licensed engineer
relies on.

## Modules

- `types.ts` — the shared domain model (geometry, loads, circuits,
  panels, schedules, violations). Mirrored in `client/lib/api-client/types.ts`.
- `geometry.ts` — polygon/segment helpers shared by rasterizer, lighting, rules.
- `routing/` — floor-plan rasterizer (walkability grid with a near-wall
  standoff band; doors become routable gaps) + A* wall-following router
  over the `pathfinding` package.
- `load-calc/` — branch loads, PEC Section 2 demand tiers, feeder
  ampacity, panel schedule builder. Data: `pec-demand-factors.ts` (PEC-VERIFY).
- `sizing/` — 125%-continuous required amps, standard breaker selection,
  conductor lookup, phase balancing. Data: `pec-table-3-10-1.ts`,
  `breaker-sizes.ts` (both PEC-VERIFY).
- `compliance/` — the rules engine; see its README for the extension pattern.
- `lighting/` — the ported BEPVY lumen-method engine: photometric core,
  per-room fixture auto-placement, room analysis + lux heatmap.
  Data: `lighting-data.ts` (LIGHTING-VERIFY).
- `circuits.ts` — groups loads into branch circuits and sizes them.
- `simulate.ts` — the orchestrator running the full core loop as one
  pure function; its `SimulationResult` is the API's central shape.
- `pdf/` — permit-ready PDF generator (pdfkit).

## Extending

Add domain math here, expose it through `simulate.ts` (or a route), and
write its vitest suite in `../../tests/` first-class — no engine change
ships untested. Keep every code-table number in a `*-data.ts`/`pec-*.ts`
file with the VERIFY flag.
