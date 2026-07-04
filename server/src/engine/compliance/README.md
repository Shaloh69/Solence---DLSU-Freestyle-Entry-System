# engine/compliance/

The PEC rules engine: one file per rule/code section, each exporting a
pure function `inputs -> Violation[]`. The UI, PDF, and API all consume
the same `Violation` shape (ruleId, severity, message, pecReference).

## Rules

Circuit-level (run per sized circuit via `runComplianceChecks`):
- `ampacity.ts` — conductor rated below its breaker
- `continuous-load.ts` — continuous load above 80% of the breaker
- `voltage-drop.ts` — 3% branch / 5% total limits over routed length

Project-level (rooms + loads, via `runProjectChecks`):
- `gfci.ts` — non-GFCI outlets in wet/hazard rooms
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
   boundary.
5. Document the new `ruleId` in `docs/api.md`.
