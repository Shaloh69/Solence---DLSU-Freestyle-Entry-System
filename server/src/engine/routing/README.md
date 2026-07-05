# engine/routing/

Floor-plan-to-grid rasterizer + wall-following A* router (brief §2.2).

- `rasterizer.ts` — walls (+ door gaps) → walkability grid with a
  near-wall standoff band; doors unblock cells, windows stay blocked.
- `router.ts` — `pathfinding`-based A*: wall-band-first routing with an
  open-floor fallback, endpoint snapping, and path compression.

Extend by adding options to `RasterizerOptions`/`RouteOptions` rather
than new entry points; tests live in `tests/routing.test.ts` and
`tests/openings.test.ts`. Gotcha: merge option objects field-by-field
(`??`), never spread — callers pass explicitly-undefined keys.
