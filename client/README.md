# Solence client (Next.js)

The frontend: a CAD-style drafting surface over the Express API. All
engine math (routing, sizing, compliance, photometrics) comes from the
backend through `lib/api-client/` — components never compute code
compliance locally.

Run: `npm run dev` (or from the repo root, which starts the API too).
Note: dev/build/start route through `scripts/next-real.js`, which
resolves the `C:\Projects` junction to its real path — required, see
the script's header.

## Map

- `app/` — routes. `/projects` (list), `/projects/[id]/editor` (the
  editor). The old standalone `/simulator` page was deleted per brief
  §9.1 — lighting lives in the editor's lighting layer, backed by
  `server/src/engine/lighting/`. Auth is not wired yet — the legacy
  BEPVY MySQL/JWT stack was removed; Supabase Auth lands once a
  Supabase project is provisioned (tiers resolve via header/env).
- `components/floorplan/` — canvas, toolbar, inspector, layers, status bar.
- `components/loads/` — the drag-and-drop component library palette.
- `components/wiring-overlay/` — react-three-fiber 3D view.
- `components/compliance/`, `components/panel-schedule/`,
  `components/lighting/` — results panels driven by `SimulationResult`.
- `lib/api-client/` — typed fetch wrappers + mirrored contract types.
- `lib/editor-store.ts` — the zustand store; see comments at top.
- `lib/component-library.ts`, `lib/circuit-colors.ts` — palette data and
  shared color coding.

## Conventions

- Server components by default; `"use client"` only where interaction,
  canvas, or Three.js requires it.
- Toasts via sonner for every async action (success/error/warning/info
  per section 4.2 of the brief) — no ad-hoc alerts.
- Keep `lib/api-client/types.ts` in lockstep with
  `server/src/engine/types.ts` and `server/docs/api.md`.
