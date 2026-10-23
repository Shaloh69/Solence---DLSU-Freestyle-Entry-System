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
- `routing/` — floor-plan rasterizer (wall bodies, near-wall band,
  building footprint) + weighted concealed-conduit router: walls are
  crossable as counted penetrations; one search from the panel routes
  every device.
- `load-calc/` — branch loads, PEC Section 2 demand tiers, feeder
  ampacity, panel schedule builder. Data: `pec-demand-factors.ts` (PEC-VERIFY).
- `sizing/` — 125%-continuous required amps, breaker selection,
  termination- and small-conductor-aware conductor selection, grounding
  conductor, phase balancing. Data: `pec-table-3-10-1.ts`,
  `breaker-sizes.ts`, `pec-overcurrent.ts` (all PEC-VERIFY).
- `compliance/` — the rules engine; see its README for the extension pattern.
- `lighting/` — the ported BEPVY lumen-method engine: photometric core,
  per-room fixture auto-placement, room analysis + lux heatmap.
  Data: `lighting-data.ts` (LIGHTING-VERIFY).
- `circuits.ts` — groups loads into branch circuits and sizes them
  (each load is still its own home run from the panel; device-to-device
  circuit topology is item W3, docs/WIRING-AUDIT.md F-9).
- `switching/` — W5: which doors are a room's entrances, lighting groups
  (switched fixtures per room per circuit), switch auto-placement at the
  latch side of the entrance door (1-way, or a 2-way pair for two
  entrances). Data: `switch-data.ts` (DESIGN-VERIFY); switch-leg
  conductors in `sizing/switch-leg-conductors.ts` (PEC-VERIFY).
  `topology.ts` wires the switch legs and the switched leg S.
- `raceways.ts` — W6: per conduit run (each segment / switch leg is its
  own raceway) counts current-carrying conductors, derates for the
  project ambient (`floorPlan.ambientTempC`, default 35 °C) and for >3
  conductors, upsizes the circuit conductor, sizes PVC conduit by
  Chapter 9 fill. Data: `sizing/pec-derating.ts` (PEC-VERIFY).
- `service/` — W7: service entrance (kWh meter, main breaker, service
  conductors sized to the main with derating, grounding electrode
  conductor) and the one-line (riser) diagram as nodes/edges + SVG
  (the PDF draws the same primitives). Data: `service/pec-service.ts`
  (PEC-VERIFY; meter classes UTILITY-VERIFY).
- `simulate.ts` — the orchestrator running the full core loop as one
  pure function; its `SimulationResult` is the API's central shape.
- `pdf/` — permit-ready PDF generator (pdfkit).
- `vision-import.ts` — converts a solence-vision `/recognize` result
  (pixel walls/openings/rooms) into a `FloorPlan` in meters
  (`VISION-VERIFY` assumed scale until item V1).

## Extending

Add domain math here, expose it through `simulate.ts` (or a route), and
write its vitest suite in `../../tests/` first-class — no engine change
ships untested, and every change also runs on the 12 real houses in
`test-assets/plans/resplan/`. Keep every code-table number in a `*-data.ts`/`pec-*.ts`
file with the VERIFY flag.
