# engine/routing/

Floor-plan-to-grid rasterizer + weighted router for concealed conduit
(brief §2.2, reworked in W1b — see docs/WIRING-AUDIT.md).

- `rasterizer.ts` — walls (+ door gaps) → grid with `blocked` (wall
  body), `nearWall` (preferred band along walls) and `inside` (building
  footprint, grown by `FOOTPRINT_TOLERANCE_M` to close slivers).
- `router.ts` — Dijkstra over (cell, heading). Walls are crossable at a
  cost (each crossing counted as a penetration), never runnable
  lengthwise; bends cost a little; leaving the footprint costs a lot.
  `routeAll` routes every device from one search from the panel, so
  routes share trunks. Endpoints snap to an open cell on their own
  room's side of a wall.
- `routing-costs.ts` — the cost model (DESIGN-VERIFY assumptions, not
  PEC values).

Tests: `tests/routing.test.ts`, `tests/openings.test.ts`, and
`tests/routing-real-plans.test.ts` (12 real ResPlan houses).
Gotcha: merge option objects field-by-field (`??`), never spread —
callers pass explicitly-undefined keys.
