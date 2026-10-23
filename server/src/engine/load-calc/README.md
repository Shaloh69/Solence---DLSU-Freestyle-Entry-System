# engine/load-calc/

Branch/feeder load calculation per PEC Section 2 (brief Phase 2):
connected + continuous VA rollups, tiered demand factors, feeder
ampacity (1φ and 3φ), and the panel schedule builder.

- `index.ts` — the calculations (pure functions).
- `dwelling.ts` — PEC 2.20 standard dwelling calculation for the feeder/main (W8), step by step.
- `pec-dwelling-calc.ts` — PEC-VERIFY values the dwelling calc adds (area exclusions, small-appliance/laundry rooms and minimum circuits, A/C 100%).
- `pec-demand-factors.ts` — PEC-VERIFY flagged demand tiers and unit
  loads; edit values here, never inline them in code.

Tests: `tests/load-calc.test.ts`, `tests/dwelling-load.test.ts` (hand example + 12 real houses).
