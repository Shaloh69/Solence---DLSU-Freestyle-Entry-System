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

`FloorPlan`: `{ width, height, walls: Wall[], rooms: Room[], openings?, backgroundImage? }`
— meters, origin top-left; `backgroundImage` is an optional image data URL
used as a trace layer. `Opening`: `{ id, wallId, offset, width, kind: "door" | "window" }`
(offset = meters from the wall's start). Doors are routable gaps; windows
stay blocked for routing and are cut visually in 3D. `Wall`: `{ id, start: {x,y}, end: {x,y}, thickness? }`.
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

`ElectricalLoad`: `{ id, name, type, va, voltage, continuous, position, roomId?, lumens?, gfci? }`
with `type` one of `lighting | outlet | appliance | laundry | hvac | motor | equipment`.
`lumens` is the photometric output for lighting fixtures (estimated from VA
when absent, flagged); `gfci` marks a GFCI-protected outlet.

## Lighting

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| POST | `/projects/:id/lighting/auto` | `{ roomIds?, targetLux?, fixture?, replaceExisting? }` | Auto-generate fixtures per room via the lumen method; returns `{ project, placements }`. Auto fixtures have `lf-` id prefixes and are ordinary editable loads. |

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

`SimulationResult` also carries `roomLighting` (per-room average lux vs
target, fixture count) and `luxHeatmap` (workplane illuminance samples
for the heatmap layer).

Violation `ruleId`s so far: `ampacity`, `continuous-80`,
`voltage-drop-branch`, `voltage-drop-total`, `gfci-required`,
`illuminance-none`, `illuminance-low`, `illuminance-high`,
`general-lighting-basis`.

## Realtime (WebSocket)

Connect to `ws://<api-host>/ws`, send `{ "type": "subscribe", "projectId" }`.
Server pushes `{ "type": "subscribed" }` then `{ "type": "simulation", projectId, result }`
after every recompute, and staged `{ "type": "ai-progress", projectId, jobId, stage, message? }`
events relayed from solence-vision during floor-plan recognition
(`queued → running_wall_segmentation → running_detection → fusing → done|error`).

## AI floor-plan recognition

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/projects/:id/recognize` | multipart image upload; starts a solence-vision job, relays progress over `/ws`, and on completion replaces the project's floor plan with the recognized walls/openings/rooms and appends confidently-detected furniture. |

Recognition-derived furniture (Phase 3 §1.3): each detected symbol
carries `category, confidence, center, size, rotationDeg` from the
vision service; detections below confidence 0.5 are skipped rather than
silently placed, unknown categories are ignored, and footprints are
clamped to per-category sane bounds. `VISION-VERIFY`: pixel→meter scale
uses an assumed default until plan-scale calibration is implemented.

> **PEC-VERIFY:** every numeric code value behind these results
> (ampacities, demand tiers, resistances, breaker ratings) is a
> placeholder pending verification by a licensed electrical engineer.

## Export

| Method | Path | Description |
| --- | --- | --- |
| POST | `/projects/:id/export` | Permit-ready PDF (`application/pdf` attachment): wiring diagram + legend, panel schedule, conductor schedule, panel directory, open violations. 422 until the project has a floor plan, panel, and stored simulation result. |
