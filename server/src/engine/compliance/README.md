# engine/compliance/

The PEC rules engine: one file per rule/code section, each exporting a
pure function `inputs -> Violation[]`. The UI, PDF, and API all consume
the same `Violation` shape (ruleId, severity, message, pecReference).

## Rules

Circuit-level (run per sized circuit via `runComplianceChecks`):
- `ampacity.ts` — conductor's usable ampacity (insulation column capped
  by the 60/75 °C termination column, recomputed from the table) below
  its breaker — PEC Table 3.10.1 + 1.10.1.14(C)
- `small-conductor.ts` — 2.0/3.5/5.5 mm² above 15/20/30 A — 2.40.1.4(D)
- `continuous-load.ts` — continuous load above 80% of the breaker
- `voltage-drop.ts` — 3% branch / 5% total limits over routed length
- `egress-lighting.ts` — egress fixtures must sit on a dedicated circuit

Project-level (rooms + loads + circuits, via `runProjectChecks`):
- `gfci.ts` — non-GFCI outlets in wet/hazard rooms
- `required-branch-circuits.ts` — kitchen/dining/laundry/bath receptacles
  on circuits below 20 A — 2.10.1.11(C)
- `receptacle-spacing.ts` — habitable-room wall point more than 1.8 m
  from an outlet (conservative: perimeter, doorways not excluded) —
  2.10.3.3(A)(1)
- `lighting-illuminance.ts` — simulated under-/over-lit rooms (uses the
  photometric engine, not wattage counting)
- `general-lighting-load.ts` — connected lighting below the VA/m² basis

Plus `panel-directory.ts` (not a rule): generates circuit descriptions.

## Adding a rule

1. New file, one exported pure function returning `Violation[]`.
   Pick a stable kebab-case `ruleId` and severity (`error` = code
   violation, `warning` = advisory).
2. Wire it into `runComplianceChecks` (circuit-level) or
   `runProjectChecks` (project-level) in `index.ts`.
3. Numeric thresholds from the PEC go in a data file flagged PEC-VERIFY,
   never inline as verified fact.
4. Add tests in `tests/` covering the pass case, the fail case, and the
   boundary — plus a run over the real ResPlan houses
   (`tests/helpers/real-plans.ts`), which must not raise the new rule on
   a correct fit-out.
5. Document the new `ruleId` in `docs/api.md`.
