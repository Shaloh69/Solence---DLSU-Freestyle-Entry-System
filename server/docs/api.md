# Solence API contract

Base URL: `http://localhost:4000/api` (dev). All bodies are JSON.
Request shapes are validated with Zod ([src/schemas.ts](../src/schemas.ts));
response shapes come from [src/engine/types.ts](../src/engine/types.ts) and
[src/db/repository.ts](../src/db/repository.ts). The frontend mirrors these
types in `client/lib/api-client/types.ts` — keep the two in sync when the
contract changes.

Errors: `{ "error": string }` with 400 (validation, includes `issues`),
403 (tier gating), 404, 409, 422 (simulation preconditions), 500.

**Tiers:** requests resolve to a pricing tier — `x-solence-tier` header
(dev/testing), else the `DEFAULT_TIER` env var, else `pro` — until
Supabase auth carries a plan per user. Free: 1 project, ≤5 circuits per
simulation, no export. Pro: unlimited + export. Firm: + API access +
custom component library. LGU: + audit trail + BIM export (future).
Gated endpoints return 403 with an upgrade message.

## Health

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Service status + whether Supabase is configured |

## Projects

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| POST | `/projects` | `{ name }` | Create a project → 201 `Project` |
| GET | `/projects` | — | List projects |
| GET | `/projects/:id` | — | Fetch one project |
| PATCH | `/projects/:id` | `{ name? }` | Rename |
| DELETE | `/projects/:id` | — | Delete → 204 |

`Project`: `{ id, name, createdAt, updatedAt, floorPlan, panel, loads, lastResult }`

## Floor plan & panel

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| PUT | `/projects/:id/floorplan` | `FloorPlan` | Replace the floor plan |
| PUT | `/projects/:id/panel` | `Panel` | Place/replace the distribution panel |

`FloorPlan`: `{ width, height, walls: Wall[], rooms: Room[], backgroundImage? }`
— meters, origin top-left; `backgroundImage` is an optional image data URL
used as a trace layer. `Wall`: `{ id, start: {x,y}, end: {x,y}, thickness? }`.
`Room`: `{ id, name, type, boundary: {x,y}[] }` with `type` one of
`bathroom | kitchen | garage | laundry | bedroom | living | dining | office | hallway | outdoor | other`.

`Panel`: `{ id, name, position, system, mainBreakerAmps }` with `system` one
of `1P2W-120 | 1P3W-120/240 | 3P4W-230/400`. `mainBreakerAmps: 0` lets the
engine size the main breaker from feeder demand.

## Loads

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| PUT | `/projects/:id/loads` | `ElectricalLoad[]` | Bulk-replace all loads (editor save) |
| POST | `/projects/:id/loads` | `ElectricalLoad` | Place a load → 201 |
| PUT | `/projects/:id/loads/:loadId` | `ElectricalLoad` | Replace a load |
| DELETE | `/projects/:id/loads/:loadId` | — | Remove a load |

`ElectricalLoad`: `{ id, name, type, va, voltage, continuous, position, roomId? }`
with `type` one of `lighting | outlet | appliance | laundry | hvac | motor | equipment`.

## Simulation

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| POST | `/projects/:id/simulate` | `{ cellSize?, clearance? }` | Run route → size → check; stores and returns the result |
| GET | `/projects/:id/results` | — | Last stored `SimulationResult` |

Preconditions (422): floor plan set, panel placed, at least one load.

`SimulationResult`:

```jsonc
{
  "routes": [ { "loadId", "circuitId", "points": [{x,y},…], "lengthM", "fallback" } ],
  "circuits": [ { "id", "description", "loadIds", "connectedVa", "continuousVa",
                  "voltage", "phase", "breakerAmps",
                  "conductor": { "awg", "mm2", "ampacity", "insulation" },
                  "lengthM" } ],
  "schedule": { "panelId", "system", "rows": [PanelScheduleRow…],
                "totalConnectedVa", "totalDemandVa",
                "phaseVa": {"A","B","C"}, "feederAmps", "mainBreakerAmps" },
  "directory": [ { "circuitNumber", "circuitId", "description" } ],
  "violations": [ { "ruleId", "severity", "message", "circuitId?", "pecReference" } ],
  "routingErrors": [ { "loadId", "message" } ]
}
```

Violation `ruleId`s so far: `ampacity`, `continuous-80`,
`voltage-drop-branch`, `voltage-drop-total`.

> **PEC-VERIFY:** every numeric code value behind these results
> (ampacities, demand tiers, resistances, breaker ratings) is a
> placeholder pending verification by a licensed electrical engineer.

## Export

| Method | Path | Description |
| --- | --- | --- |
| POST | `/projects/:id/export` | Permit-ready PDF (`application/pdf` attachment): wiring diagram + legend, panel schedule, conductor schedule, panel directory, open violations. 422 until the project has a floor plan, panel, and stored simulation result. |
