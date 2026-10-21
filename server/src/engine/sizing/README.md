# engine/sizing/

Breaker + conductor sizing: 125%-continuous required amps, breaker
selection (multi-outlet circuits only 15/20/30/40/50 A per PEC 2.10.2.1;
individual circuits any standard rating; `minBreakerAmps` for the 20 A
circuits 2.10.1.11(C) requires), conductor selection that the breaker
may protect — usable ampacity = insulation column capped by the
termination column (60 °C for circuits ≤100 A, 75 °C above,
1.10.1.14(C)) and within the small-conductor limits (2.40.1.4(D)) —
equipment grounding conductor (Table 2.50.6.13), and greedy phase
balancing.

- `index.ts` — sizing functions (`sizeBranchCircuit`, `sizeConductor`,
  `effectiveAmpacity`, `terminationTempFor`, `smallConductorLimit`,
  `sizeEquipmentGroundingConductor`, `balancePhases`).
- `pec-table-3-10-1.ts` — PEC-VERIFY ampacity (TW = 60 °C, THW = 75 °C,
  THHN = 90 °C columns) + resistance data.
- `breaker-sizes.ts` — PEC-VERIFY standard ratings.
- `pec-overcurrent.ts` — PEC-VERIFY small-conductor caps, termination
  rule, multi-outlet ratings, EGC table, required circuits, receptacle
  spacing (section references from the unofficial PEC 2017 transcription).

Tests: `tests/sizing.test.ts`, `tests/pec-alignment.test.ts`.
