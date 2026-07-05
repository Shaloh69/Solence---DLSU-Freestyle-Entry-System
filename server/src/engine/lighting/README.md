# engine/lighting/

The ported BEPVY lumen-method photometric engine (brief §9): fixture
auto-placement solving the original fewest-fixtures-to-target-lux
objective, per-room illuminance analysis, and the lux heatmap.

- `photometric.ts` — RCR, CU, maintenance factors, lamp counts, layouts,
  inverse-square point illuminance (pure functions, ported 1:1).
- `auto-place.ts` — per-room fixture generation; outputs ordinary
  `ElectricalLoad`s so lighting flows through circuits/sizing/routing.
- `analysis.ts` — room average-lux vs target + heatmap samples.
- `lighting-data.ts` — LIGHTING-VERIFY flagged targets/factors.

All illuminance targets are placeholders pending licensed-EE
verification; never present them as authoritative.
