# Wiring, PEC, CAD-editing & layers audit

Date: 2026-10-21 · Method: read the code, then ran the engine on 12 real
residential plans (ResPlan corpus, `test-assets/plans/resplan/`) and
fixed what the real plans exposed. Status column: ✅ fixed (item + commit),
🔜 planned (item in `docs/STATE.md` / `docs/REVAMP-PLAN.md`).

PEC numbers below come from the unofficial PEC 2017 Part 1 transcription
on the Filipino Engineer wiki. Every value in code is in a `PEC-VERIFY`
file and must be confirmed by a licensed EE.

## 1. How a wire is made today (after W1b/W2)

```
FloorPlan (walls, rooms, doors/windows) + Panel + Loads
  │
  ├─ rasterizeFloorPlan  0.1 m grid: blocked = wall body, nearWall = 0.3 m
  │                      band, inside = building footprint (+0.2 m)
  ├─ routeAll            ONE Dijkstra from the panel over (cell, heading):
  │                      along wall 1.0/m · open ceiling 1.2/m · inside wall
  │                      2.0/m + 1.5 per penetration · outside 4.0/m ·
  │                      bend 0.25 → every device's route read from the
  │                      same tree (shared trunks); devices snap to their
  │                      own room's side of a wall
  ├─ buildCircuits       group by room + type + voltage (dedicated types get
  │                      their own circuit), size, balance legs
  ├─ sizing              required A = non-cont + 125% cont → breaker
  │                      (15/20/30/40/50 for multi-outlet) → conductor
  │                      (60 °C terminals, small-conductor caps) → EGC
  ├─ compliance          ampacity · small-conductor · 80% continuous ·
  │                      voltage drop 3%/5% · GFCI · required 20 A circuits ·
  │                      receptacle spacing · illuminance · general-lighting
  │                      basis · egress
  └─ schedule, directory, PDF
Display: 2D = one SVG polyline per load (circuit color, dashed if the run
leaves the building); 3D = one drei <Line> per load at 2.5 m with a
vertical drop to the device. Wires are not selectable or editable.
```

## 2. Findings

| # | Finding | Evidence | Status |
|---|---|---|---|
| F-1 | **20 A breaker got 2.0 mm² wire, 30 A got 3.5 mm².** Sizing read the 90 °C THHN column and ignored the small-conductor rule; the ampacity check read the same column, so it never fired. Unsafe output. | probe: 3500 VA @230 V → 20 A, 2.0 mm² | ✅ W2 |
| F-2 | Default system was US 120/240 V; lights/outlets at 120 V → ~2× real current. PH residential is 230 V. Auto-lighting fixtures hard-coded 120 V. | `editor-store` default, `DEFAULT_FIXTURE` | ✅ W2 (`1P2W-230` default) |
| F-3 | Multi-outlet circuits could get 25/35/45 A breakers; PEC 2.10.2.1 allows only 15/20/30/40/50 A. | sizing test | ✅ W2 |
| F-4 | No equipment grounding conductor anywhere (Table 2.50.6.13). | types | ✅ W2 (per circuit) |
| F-5 | Kitchen/bath/laundry receptacles sized by load (15 A); PEC 2.10.1.11(C) requires 20 A circuits. | real plans | ✅ W2 (builder + rule) |
| F-6 | No receptacle-spacing check (2.10.3.3(A)(1), 1.8 m). | — | ✅ W2 (conservative: perimeter, doorways not excluded) |
| F-7 | **Rooms with no door were unreachable** — wires could only cross walls at doors. ResPlan 8: kitchen + hall, 11 loads unrouted. Real PH houses run concealed conduit through ceilings/walls. | real-plan run | ✅ W1b |
| F-8 | **Through-wall stubs / wrong-side feeds**: a device inside a wall snapped to the nearest open cell (either side) and a straight stub was drawn through the wall. ResPlan 125: 128 routes. | real-plan run | ✅ W1b |
| F-9 | **Star topology**: every device has its own home run from the panel; circuits are formed *after* routing. A 4-BR house summed to ~1.5 km of wire (≈1 km after W1b). Real circuits run panel → first box → device to device. Wire quantities and the 3D/2D picture (bundles of parallel lines) are wrong. | real-plan run | ✅ W3 (2026-10-23): `wiring.segments` = home run + device-to-device tree; conduit −47% on the 12 plans (3.8 km vs 7.2 km of home runs). The 2D/3D layers still draw `routes` — UI follow-up |
| F-10 | Circuit length = longest single route; voltage drop assumes all current at the farthest point. Conservative but not the real chain. | `circuits.ts` | ✅ W3: VD summed per segment along `dropChain` (max 1.6% on the 12 plans) |
| F-11 | Conductors are a single abstract wire: no L / N (or L2) / G set, no conduit, no junction or utility boxes, no switch legs. Plans can't show tick marks or home-run arrows (standard plan notation). | types | 🟡 W3: L/N/L2/G per segment, junction boxes, wire + conduit BOM. W5: switch legs (L+S+G, S+T+T+G) + switched leg S on the tree, in the BOM. Tick marks / home-run arrows → UI follow-up |
| F-12 | No switches at all; lighting fixtures connect straight to the panel. Permit layouts must show switches. | `LoadType` | ✅ W5 (2026-10-23): engine-placed `SwitchDevice`s (not loads) — lighting group per room per circuit, 1-way at the latch side of the entrance door (1.3 m, DESIGN-VERIFY), 2-way pair for ≥2 entrances; switch legs routed in `wiring.switchLegs`, S/L on the tree only where needed, in the BOM; VD includes the leg. 12 plans: 107 1-way + 10 2-way switches, 117 legs, 438 m of leg conduit. Drawing switches/legs + PH legend symbols → W5b (UI) |
| F-13 | No derating: >3 current-carrying conductors in a raceway (0.80/0.70/0.50) or ambient >30 °C (PH ceilings run 35–40 °C: ×0.91/0.82 at 60 °C). No conduit size / fill (40% for >2 conductors). | sizing | ✅ W6 (2026-10-23): engine/raceways.ts + sizing/pec-derating.ts (PEC-VERIFY): ambient correction 3.10.1.15(B)(2)(a) on the insulation column (project setting `floorPlan.ambientTempC`, default 35 °C), adjustment 3.10.1.15(B)(3)(a) 0.80/0.70/0.50/0.45/0.40/0.35 for >3 current-carrying (L/L2/L3/N/S/T, not G), capped by the termination column; circuit conductor upsized for its worst run, EGC unchanged; PVC Sch 40 trade size per run by Chapter 9 Table 1 fill (53/31/40%), conduit BOM by size; `ampacity` rule derates. Assumption: each segment/switch leg is its own conduit — 310 of 1065 segments on the 12 plans share a path with another circuit's run (parallel conduits, not bundled). 12 plans: max 3 current-carrying per run, all 1/2" conduit, max fill 14% (THHN) / 24% (TW); TW at 35–40 °C upsizes all 295 circuits, no violations |
| F-14 | `general-lighting-basis` fires on every real plan: the engine *warns* that LED load is below 24 VA/m² instead of *using* the unit load in the feeder calc, as the code requires. | real-plan run | ✅ W8 (2026-10-23): feeder/main from the PEC 2.20 dwelling calc (`load-calc/dwelling.ts`, `schedule.dwellingCalc`): general lighting = max(area × 24 VA/m², connected lighting + general receptacles), small-appliance (min. 2) + laundry circuits at ≥1500 VA, lighting tiers, fixed appliances 75% at ≥4, A/C 100%; steps printed on the PDF; `general-lighting-basis` rule retired. 12 plans: demand 11.5–22.7 kVA, main 50–100 A ≥ demand current, no basis warning. W8b (2026-10-23): + largest motor 25% (hvac/motor) and heating/A-C non-coincidence (new `heating` load type); 12 plans 11.9–23.2 kVA, mains 50–100 A |
| F-15 | Feeder/service: no service entrance, kWh meter, grounding electrode conductor, one-line/riser diagram. Permit needs a one-line diagram + schedule of loads + design analysis (>70 A main). | OCBO permit list | 🟡 W7 (2026-10-23): `SimulationResult.service` — kWh meter, main breaker (manual or computed from the W8 demand), service conductors sized to the main with ambient/count derating + conduit, GEC from PEC-VERIFY Table 2.50.3.17 by service conductor size, ground rod; `SimulationResult.oneLine` — riser diagram as nodes/edges + SVG, every circuit with breaker, poles and conductors, printed on its own PDF page. 12 plans: service 14–50 mm², GEC 8.0/14 mm². Design analysis + A3 E-4 sheet → W9 |
| F-16 | PDF: A4 (not A3), built-in Helvetica (can't print `²`/`⚠`), no title block, no PH symbol legend/notes/one-line (circuit legend only). | audit 2026-10-16 | 🔜 W9 |
| F-17 | Wires are not editable: no manual route, no assigning a load to a circuit, no locking a route. | editor-store actions | 🔜 W10 |
| F-18 | CAD editing gaps (see §4). | editor-store | 🔜 W10–W12 |
| F-19 | Layers: 8 on/off toggles only — no presets ("electrical plan without furniture"), lock, per-view state, persistence. No tests. | LayersPanel | 🔜 W4 |

## 3. PEC coverage matrix

| Requirement (PEC 2017 Part 1) | Engine | Test |
|---|---|---|
| 125% continuous (2.10.2.2 / 2.10.2.3) | ✅ | sizing, real-plans |
| Branch ratings 15/20/30/40/50 (2.10.2.1) | ✅ W2 | pec-alignment |
| Small conductors 2.40.1.4(D) | ✅ W2 | pec-alignment ×12 plans |
| Terminations 1.10.1.14(C) | ✅ W2 | pec-alignment |
| Standard OCPD ratings 2.40.1.6(A) | ✅ (to 600 A) | sizing |
| EGC Table 2.50.6.13 | ✅ W2 | pec-alignment |
| GFCI locations 2.10.1.8(A) | ⚠ room types only — not "within 1.8 m of a sink", not dishwasher | compliance |
| Required dwelling circuits 2.10.1.11(C) | ✅ W2 (kitchen/dining/laundry/bath) — garage 🔜 | pec-alignment |
| Receptacle spacing 2.10.3.3(A)(1) | ✅ W2 (conservative) — countertop 600 mm rule 🔜 | pec-alignment |
| Voltage drop 3%/5% (FPN, recommendation) | ✅ (worst-case length) | compliance |
| Ampacity adjustment / ambient (3.10) | ✅ W6 (one raceway per segment) | derating ×12 plans |
| Conduit fill (Ch. 9 Table 1) | ✅ W6 (PVC Sch 40) | derating ×12 plans |
| Dwelling load calculation (2.20) | ⚠ placeholder tiers | load-calc |
| Grounding electrode conductor (2.50) | ✅ W7 (Table 2.50.3.17, PEC-VERIFY; rod-electrode cap not applied) | service-oneline ×12 plans |

## 4. CAD editability (vs AutoCAD conventions)

Has: select/move/delete, wall tool (segment), room tool (rectangle only),
door/window placement, panel/load/furniture placement, rotate furniture,
grid snap 0.25 m, inspector edits, trace image, 3D gizmo.

Missing, by priority for a pitch demo:
1. **Undo/redo** (none; first thing a judge tries) — W10
2. Multi-select (shift/box), copy/paste/duplicate, delete many — W10
3. Object snaps (endpoint, midpoint, perpendicular, intersection) +
   ortho; typed length while drawing ("4.2 Enter") — W11
4. Polyline walls (continuous), wall join/trim, rooms auto-detected from
   closed wall loops (any shape, not only rectangles) — W11
5. Measure tool + dimension lines + text notes — W11
6. Wiring edits: assign load → circuit, split/merge circuits, drag a
   route vertex and lock it, re-route one run — W10
7. Symbol blocks with the PH plan legend (outlets, switches, lights,
   panel, JB) — W5/W9
8. DXF import/export (open the plan in AutoCAD; trace a DXF) — W12

## 5. Layer views

Today the 8 layer flags (walls, rooms, loads, lighting, furniture,
wiring, heatmap, violations) are honored by both the 2D canvas and the
3D overlay; showcase honors only wiring. Planned (W4):

- **Presets** (AutoCAD "layer states"): Architectural · Furniture plan ·
  Electrical (no furniture) · Lighting plan · Power plan · Wiring only ·
  Compliance review · All. A preset sets every layer; editing a layer
  after applying it marks the view "Custom".
- **Lock** a layer: visible, not selectable/draggable.
- Persist the layer state per project; print/PDF sheets use their own
  preset (lighting sheet = Lighting plan).
- Tests: store unit tests for every preset; Playwright E2E on a real
  plan with furniture — 2D: count `[data-layer="furniture"]` elements
  on/off; 3D: pixel diff with furniture on vs off must exceed a
  threshold, and Electrical preset must equal furniture-off; locked
  layer can't be selected.

## 6. Features that would make it "real" (research)

From how real tools work — Revit electrical (circuits → wires, home
runs added automatically, arc wiring for concealed runs, chamfered for
exposed), SEE Electrical Building+ (auto cable routing, single-line
diagrams generated from the plan, bill of materials), AutoCAD layer
states — and what a PH permit needs (OCBO list: legend, general notes,
layout with circuits/outlets/switches/panels, schedule of loads,
one-line diagram, design analysis; signed and sealed by a PEE):

| Feature | Why it matters | Item |
|---|---|---|
| Device-to-device circuits, L/N/G sets, junction boxes, home-run arrows, tick marks | Plans look and quantify like real ones | W3 |
| Switches + switch legs (1-way, 2-way/3-way), auto-placed at door latch side | Every lighting layout has them | W5 |
| Derating (conductor count, PH ambient) + conduit sizing/fill | Correct wire + pipe sizes | W6 |
| Service entrance, meter, main, GEC, one-line/riser diagram generated from the plan | Required permit sheet | W7 |
| PEC 2.20 dwelling load computation used for the feeder (not warned) | Correct feeder/main | W8 |
| A3 permit sheet set (E-1 legend+notes, E-2 lighting, E-3 power, E-4 riser+schedule+computations), title block with PEE/PRC/PTR | The deliverable an engineer submits | W9 |
| Bill of materials: wire by size (m), conduit (m), boxes, breakers, devices; optional PH price list | Contractors quote from it | W3/W9 |
| Undo/redo, multi-select, snaps, polyline walls, dimensions | Feels like CAD | W10–W11 |
| Manual wiring overrides (assign, lock, re-route) | Engineer stays in control | W10 |
| DXF import/export | Works with AutoCAD files they already have | W12 |
| Multi-storey | Most PH houses are 2 storeys | later |
| Short-circuit / available fault current, breaker AIC | Roadmap V3, strong pitch item | later |

## 7. Sources

- PEC 2017 Article 2.10 (wiki transcription): https://filipinoengineer.com/wiki/Philippine_Electrical_Code_2017_Part_1/Chapter_2._Wiring_and_Protection/Article_2.10_-_Branch_Circuits
- PEC 2017 Article 2.40 (wiki): https://filipinoengineer.com/wiki/Philippine_Electrical_Code_2017_Part_1/Chapter_2._Wiring_and_Protection/Article_2.40_-_Overcurrent_Protection
- Table 2.50.6.13 EGC: https://filipinoengineer.com/blog/2024/02/philippine-electrical-code-equipment-grounding-and-equipment-grounding-conductors.html
- Ampacity adjustment / ambient / terminations study guide: https://open-exam-prep.com/study-guides/ph-prc-electrical-engineering/pec1-safety-sizing-protection/conductor-sizing-ampacity-voltage-drop
- Electrical permit requirements (Puerto Princesa OCBO): https://ocbo.puertoprincesa.ph/wp-content/uploads/2022/08/Electrical-Requirements-Part-I.pdf
- Revit — add wiring to circuits: https://help.autodesk.com/cloudhelp/2026/ENU/Revit-MEPEng/files/GUID-553F57D3-F2A9-4FF8-BD95-C4C190728FEE.htm
- AutoCAD Layer Properties Manager: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-LT/files/GUID-B297EBD9-D68C-47E1-87CE-1B3798496599.htm
- SEE Electrical Building+: https://www.ige-xao.com/wp-content/uploads/documentation/en/SEB+/SEE-Electrical-Building+V8R2-UK-201905-Screen.pdf
- ResPlan dataset: https://github.com/m-agour/ResPlan
