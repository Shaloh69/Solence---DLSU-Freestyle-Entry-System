# components/wiring-overlay/

The react-three-fiber 3D view: extruded walls with door/window cuts
(deterministic wall-segment splitting — lintels above doors, sill/head
bands around windows; no CSG), panel cabinet, loads at mounting height,
wiring at conduit height with vertical drops (one line per load from
the panel until W3 introduces device-to-device segments), and the lux
heatmap. Routes that leave the building (`fallback`) render dashed.
Color coding matches the 2D canvas via `lib/circuit-colors.ts`; layer
toggles come from the editor store.

Note: `react/no-unknown-property` is disabled for this folder in
`.eslintrc.json` — R3F elements aren't DOM elements.
