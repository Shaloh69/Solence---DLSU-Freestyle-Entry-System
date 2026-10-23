/**
 * DXF layer names (W12). One layer per exportable editor layer key
 * (client/lib/layers.ts `LayerKey`), so a layer state in AutoCAD shows
 * the same objects as the matching Solence layer preset. `heatmap` is a
 * raster overlay and is not exported. The engine cannot import client
 * code; tests/dxf.test.ts checks these keys against client/lib/layers.ts.
 */
import type { DxfUnits } from "../types.js";

export type DxfLayerKey =
  | "walls"
  | "rooms"
  | "loads"
  | "lighting"
  | "furniture"
  | "wiring"
  | "violations";

export const DXF_LAYERS: Record<DxfLayerKey, string> = {
  walls: "SOLENCE-WALLS",
  rooms: "SOLENCE-ROOMS",
  loads: "SOLENCE-LOADS",
  lighting: "SOLENCE-LIGHTING",
  furniture: "SOLENCE-FURNITURE",
  wiring: "SOLENCE-WIRING",
  violations: "SOLENCE-VIOLATIONS",
};

/** Doors/windows: drawn with the walls in the editor, kept off the walls layer so a re-import doesn't read them as walls. */
export const DXF_OPENINGS_LAYER = "SOLENCE-OPENINGS";

/** AutoCAD Color Index per layer (display only). */
export const DXF_LAYER_COLORS: Record<string, number> = {
  [DXF_LAYERS.walls]: 7,
  [DXF_LAYERS.rooms]: 8,
  [DXF_LAYERS.loads]: 4,
  [DXF_LAYERS.lighting]: 2,
  [DXF_LAYERS.furniture]: 9,
  [DXF_LAYERS.wiring]: 1,
  [DXF_LAYERS.violations]: 6,
  [DXF_OPENINGS_LAYER]: 3,
};

/** Drawing units ↔ `$INSUNITS` code and meters per drawing unit. */
export const DXF_UNITS: Record<DxfUnits, { insunits: number; meters: number }> = {
  in: { insunits: 1, meters: 0.0254 },
  ft: { insunits: 2, meters: 0.3048 },
  mm: { insunits: 4, meters: 0.001 },
  cm: { insunits: 5, meters: 0.01 },
  m: { insunits: 6, meters: 1 },
};

export function unitsForInsunits(code: number): DxfUnits | undefined {
  return (Object.keys(DXF_UNITS) as DxfUnits[]).find((u) => DXF_UNITS[u].insunits === code);
}
