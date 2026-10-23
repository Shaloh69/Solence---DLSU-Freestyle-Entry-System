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

`FloorPlan`: `{ width, height, ceilingHeight?, ambientTempC?, walls: Wall[], rooms: Room[], openings?, backgroundImage? }`
— meters, origin top-left; `backgroundImage` is an optional image data URL
used as a trace layer. `ambientTempC` (W6, project setting, 0–55 °C,
default 35) is the design ambient of the conduit runs (ceiling space) used
for the ampacity correction; out-of-range values return 400. `Opening`: `{ id, wallId, offset, width, kind: "door" | "window" }`
(offset = meters from the wall's start). Doors are free passages for
routing; walls and windows can be crossed by a run only as a counted
penetration (concealed conduit — see `RoutedPath.penetrations`); windows
are cut visually in 3D. `Wall`: `{ id, start: {x,y}, end: {x,y}, thickness? }`.
`Room`: `{ id, name, type, boundary: {x,y}[] }` with `type` one of
`bathroom | kitchen | garage | laundry | bedroom | living | dining | office | hallway | outdoor | other`.

`Panel`: `{ id, name, position, system, mainBreakerAmps }` with `system` one
of `1P2W-230 | 1P2W-120 | 1P3W-120/240 | 3P4W-230/400` — `1P2W-230` (PH
residential, 230 V single-phase) is the editor's default for new panels. `mainBreakerAmps: 0` lets the
engine size the main breaker from feeder demand.

## Loads

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| PUT | `/projects/:id/loads` | `ElectricalLoad[]` | Bulk-replace all loads (editor save) |
| POST | `/projects/:id/loads` | `ElectricalLoad` | Place a load → 201 |
| PUT | `/projects/:id/loads/:loadId` | `ElectricalLoad` | Replace a load |
| DELETE | `/projects/:id/loads/:loadId` | — | Remove a load |

`ElectricalLoad`: `{ id, name, type, va, voltage, continuous, position, roomId?, lumens?, gfci? }`
with `type` one of `lighting | outlet | appliance | laundry | hvac | heating | motor | equipment`
(`heating` = fixed electric space heating, W8b).
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
  "routes": [ { "loadId", "circuitId", "points": [{x,y},…], "lengthM",
                "fallback",        // true = run leaves the building footprint
                "penetrations" } ], // walls passed through (sleeves/holes)
  "circuits": [ { "id", "description", "loadIds", "connectedVa", "continuousVa",
                  "voltage", "phase", "breakerAmps",
                  "conductor": { "awg", "mm2", "ampacity", "insulation",
                                 "terminationTempC" },   // ampacity = usable: termination-capped, derated (W6)
                  "groundingConductor": { "awg", "mm2" }, // PEC Table 2.50.6.13
                  "lengthM",            // panel → farthest device along the device chain
                  "voltageDropPercent", // summed segment by segment along dropChain
                  "dropChain": [ { "lengthM", "amps" } ],  // panel → worst-drop device
                  "derating": { "ambientTempC", "ambientFactor",       // W6, PEC-VERIFY
                                "maxCurrentCarrying", "adjustmentFactor",
                                "ampacity", "resizedFrom?": { "awg", "mm2" } } } ],
  "schedule": { "panelId", "system", "rows": [PanelScheduleRow…],
                "totalConnectedVa", "totalDemandVa",
                "phaseVa": {"A","B","C"}, "feederAmps", "mainBreakerAmps",
                "dwellingCalc?": {                  // W8: PEC 2.20 dwelling calc, PEC-VERIFY
                  "floorAreaM2", "unitLoadVaPerM2", "generalLightingBasisVa",
                  "connectedGeneralVa", "generalLightingVa",
                  "generalLightingSource",          // "unit-load" | "connected"
                  "smallApplianceCircuits", "smallApplianceVa",
                  "laundryCircuits", "laundryVa",
                  "generalSubtotalVa", "generalDemandVa",
                  "fixedApplianceCount", "fixedApplianceConnectedVa",
                  "fixedApplianceFactor", "fixedApplianceDemandVa",
                  "airConditioningVa", "airConditioningFactor", "airConditioningDemandVa",
                  "otherVa", "demandVa", "systemVoltage", "demandAmps",
                  "steps": [ { "id", "label", "basis", "va", "pecReference" } ] } },
  "directory": [ { "circuitNumber", "circuitId", "description" } ],
  "violations": [ { "ruleId", "severity", "message", "circuitId?", "pecReference" } ],
  "routingErrors": [ { "loadId", "message" } ],
  "wiring": {                                  // W3: real circuits, device to device
    "segments": [ { "id", "circuitId",
                    "from",                    // "panel" or upstream load id
                    "to",                      // downstream load id
                    "points": [{x,y},…], "lengthM", "penetrations",
                    "conductors": [ { "role",  // "L" | "L2" | "L3" | "N" | "G" | "S" | "T"
                                      "awg", "mm2", "color",  // colors PEC-VERIFY
                                      "groupId?" } ],  // S/T: the lighting group
                    "downstreamVa", "downstreamAmps",
                    "raceway": { "currentCarrying", "adjustmentFactor",   // W6
                                 "tradeSize", "metricMm",   // PVC Sch 40, e.g. 1/2" = 16
                                 "conductorAreaMm2", "fillPercent", "fillLimitPercent" } } ],
    "junctions": [ { "id", "circuitId", "loadId", "position": {x,y}, "conduits" } ],
    "lightingGroups": [ { "id", "circuitId", "roomId?", "loadIds",   // W5
                          "switchIds",        // one 1-way, or a 2-way pair
                          "boxLoadId" } ],    // fixture the switch leg drops from
    "switches": [ { "id", "groupId", "circuitId", "roomId?",
                    "kind",                  // "1-way" | "2-way"
                    "position": {x,y}, "mountingHeightM",  // DESIGN-VERIFY
                    "doorId?", "pairedSwitchId?" } ],
    "switchLegs": [ { "id", "circuitId", "groupId",
                      "from", "to",          // box load id or switch id → switch id
                      "points": [{x,y},…], "lengthM", "verticalM", "penetrations",
                      "conductors": [ … ], "amps", "raceway": { … } } ],
    "bom": { "wire": [ { "role", "awg", "mm2", "color", "lengthM" } ],
             "conduitLengthM", "junctionBoxes",   // conduit incl. switch legs
             "conduits": [ { "tradeSize", "metricMm", "lengthM" } ],  // W6: by trade size
             "switches": { "oneWay", "twoWay" } }
  }
}
```

`routes` are still one path per device from the panel (kept for the
current 2D/3D layers). `wiring` is how the circuit is actually pulled:
per circuit one home run to the first device, then device to device;
each circuit's segments form a tree rooted at `"panel"`. A device where
three or more conduits meet is a junction box. 240 V circuits on a
120/240 V panel carry L + L2 + G (no neutral); everything else L + N + G.

Switching (W5): the engine places the switches — they are not loads in
the project. Switched fixtures (lighting, not egress) of one room on one
circuit form a lighting group. Its switch sits inside the room beside the
latch side of the room's entrance door (1-way); a room with two or more
entrance doors gets a 2-way pair at two of them. The switch leg drops from
the group's box (its fixture nearest the panel) to the first switch with
L + S + G, and runs S + T + T + G between a 2-way pair; `lengthM`
includes the vertical drops (`verticalM`, ceiling to switch height). On
the circuit tree, S runs where it joins a group's fixtures and L only
where an unswitched device or a group box is downstream. A switched
fixture's voltage drop includes its switch leg (down and back).

Raceways (W6, all factors PEC-VERIFY in `sizing/pec-derating.ts`): each
segment and each switch leg is its own conduit (circuits whose routes run
side by side are separate, parallel conduits — not one shared raceway).
Current-carrying conductors per run: L, L2, L3, N, S and both travelers T,
never G. A circuit's conductor is sized for its worst run: insulation
column × ambient correction (PEC 3.10.1.15(B)(2)(a), 30 °C basis) ×
adjustment for more than three current-carrying conductors
(3.10.1.15(B)(3)(a): 0.80 / 0.70 / 0.50 …), capped by the termination
column, must cover the breaker; it is upsized if not (`resizedFrom`),
while the equipment ground stays sized by the breaker. Each run gets the
smallest PVC Schedule 40 trade size (from 16 mm / 1/2") whose fill, EGC
included, is within Chapter 9 Table 1 (53% / 31% / 40% for 1 / 2 / more
conductors). The `ampacity` violation applies the same derating.

Feeder/main demand (W8) is the PEC 2.20 standard dwelling calculation
(`load-calc/dwelling.ts`, values PEC-VERIFY in `pec-demand-factors.ts`
and `pec-dwelling-calc.ts`): general lighting = the larger of floor area
(garage/outdoor excluded) × 24 VA/m² and the connected lighting +
general-purpose receptacles; small-appliance circuits (kitchen/dining
receptacles, min. 2) and laundry circuits (min. 1 with a laundry room)
each at not less than 1500 VA; lighting demand tiers (3000 VA at 100%,
next at 35%, over 120 kVA at 25%) on that subtotal; fixed appliances at
75% when four or more; A/C, space heating (`heating` loads), motors and
other equipment at 100%. W8b: when a dwelling has both space heating and
A/C only the larger total is counted (non-coincident loads, NEC 220.60
pattern; a tie keeps the A/C; the `heating-ac-noncoincident` step carries
the omitted VA as a negative value), and 25% of the largest single motor
load still counted (`hvac` or `motor` load types) is added as the
`largest-motor` step (NEC 220.50 / 430.24 pattern). New fields:
`spaceHeatingVa`, `spaceHeatingFactor`, `spaceHeatingDemandVa`,
`nonCoincidentOmitted` (`heating` | `air-conditioning` | null),
`nonCoincidentOmittedVa`, `largestMotorVa`, `largestMotorLoadId`,
`largestMotorFactor`, `largestMotorAdderVa`.
`schedule.totalDemandVa` and `feederAmps` come from it, an auto-sized
main breaker is the next standard rating ≥ `demandAmps`, and `steps`
(also printed on the PDF's panel-schedule page) shows each line.

`SimulationResult` also carries `roomLighting` (per-room average lux vs
target, fixture count) and `luxHeatmap` (workplane illuminance samples
for the heatmap layer).

Violation `ruleId`s so far: `ampacity`, `small-conductor`,
`continuous-80`, `voltage-drop-branch`, `voltage-drop-total`,
`gfci-required`, `required-branch-circuit`, `receptacle-spacing`,
`illuminance-none`, `illuminance-low`, `illuminance-high`,
`egress-dedicated-circuit`. (`general-lighting-basis` was retired in W8:
the unit load is used in `schedule.dwellingCalc`, not warned.)

## Realtime (WebSocket)

Connect to `ws://<api-host>/ws`, send `{ "type": "subscribe", "projectId" }`.
Server pushes `{ "type": "subscribed" }` then `{ "type": "simulation", projectId, result }`
after every recompute, and staged `{ "type": "ai-progress", projectId, jobId, stage, message? }`
events relayed from solence-vision during floor-plan recognition
(`queued → running_wall_segmentation → running_detection → fusing → done|error`).

## AI floor-plan recognition

| Method | Path | Description |
| --- | --- | --- |
| POST | `/projects/:id/recognize` | multipart image upload; starts a solence-vision job, relays progress over `/ws`, and on completion replaces the project's floor plan with the recognized walls/openings/rooms and appends confidently-detected furniture. |

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
