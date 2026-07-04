# components/wiring-overlay/

The react-three-fiber 3D view: extruded walls with door/window cuts
(deterministic wall-segment splitting — lintels above doors, sill/head
bands around windows; no CSG), panel cabinet, loads at mounting height,
wiring at conduit height with vertical drops, and the lux heatmap.
Color coding matches the 2D canvas via `lib/circuit-colors.ts`; layer
toggles come from the editor store.

Note: `react/no-unknown-property` is disabled for this folder in
`.eslintrc.json` — R3F elements aren't DOM elements.
