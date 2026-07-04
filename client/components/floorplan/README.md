# components/floorplan/

The 2D drafting surface and its chrome.

- `FloorPlanCanvas.tsx` — the SVG editor: wall/room drawing, door/window
  placement, load drag-drop, selection/move, grid + wall snapping, layer
  filtering, route/heatmap rendering, keyboard shortcuts (V/W/R/P/D/N).
- `EditorToolbar.tsx` — tools, 2D/3D toggle, Auto-light, live-check
  switch, run + export buttons.
- `InspectorPanel.tsx` — properties for the current selection (or plan
  settings when nothing is selected): room name/type, load ratings,
  GFCI, lumens, panel system, trace-image upload.
- `LayersPanel.tsx` — CAD layer toggles (shared with the 3D view).
- `StatusBar.tsx` — cursor coordinates, snap state, shortcut reference.

Conventions: all state flows through `lib/editor-store.ts` (components
hold only transient interaction state like drag-in-progress); canvas
coordinates are floor-plan meters, converted once in `toPlanPoint`. New
tools = extend the `Tool` union in the store, add the tool button, and
handle the click in `handleCanvasClick`.
