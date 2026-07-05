# engine/sizing/

Breaker + conductor sizing (brief Phase 2): 125%-continuous required
amps, next-standard-breaker selection, PEC Table 3.10.1 conductor
lookup (conductor protects against the breaker, not just the load),
and greedy phase balancing.

- `index.ts` — sizing functions.
- `pec-table-3-10-1.ts` — PEC-VERIFY flagged ampacity + resistance data.
- `breaker-sizes.ts` — PEC-VERIFY flagged standard ratings.

Tests: `tests/sizing.test.ts`.
