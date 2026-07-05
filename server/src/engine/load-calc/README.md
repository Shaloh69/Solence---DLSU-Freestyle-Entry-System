# engine/load-calc/

Branch/feeder load calculation per PEC Section 2 (brief Phase 2):
connected + continuous VA rollups, tiered demand factors, feeder
ampacity (1φ and 3φ), and the panel schedule builder.

- `index.ts` — the calculations (pure functions).
- `pec-demand-factors.ts` — PEC-VERIFY flagged demand tiers and unit
  loads; edit values here, never inline them in code.

Tests: `tests/load-calc.test.ts`.
