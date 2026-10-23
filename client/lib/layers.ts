/**
 * CAD layers and layer-state presets (W4, WIRING-AUDIT §5 / F-19).
 *
 * Presets are the "layer states" of the electrical-drawing workflow
 * (cf. AutoCAD's Layer States Manager): one click switches the editor
 * between the views a designer actually prints or reviews. Pure UI
 * state — no domain math.
 */
export type LayerKey =
  | "walls"
  | "rooms"
  | "loads"
  | "lighting"
  | "furniture"
  | "wiring"
  | "heatmap"
  | "violations";

export const LAYER_KEYS: LayerKey[] = [
  "walls",
  "rooms",
  "loads",
  "lighting",
  "furniture",
  "wiring",
  "heatmap",
  "violations",
];

export type LayerState = Record<LayerKey, boolean>;

export const DEFAULT_LAYERS: LayerState = {
  walls: true,
  rooms: true,
  loads: true,
  lighting: true,
  furniture: true,
  wiring: true,
  heatmap: false,
  violations: true,
};

export const NO_LOCKS: LayerState = {
  walls: false,
  rooms: false,
  loads: false,
  lighting: false,
  furniture: false,
  wiring: false,
  heatmap: false,
  violations: false,
};

export type LayerPresetId =
  | "architectural"
  | "furniture"
  | "electrical"
  | "lighting"
  | "power"
  | "wiring"
  | "compliance"
  | "all";

export interface LayerPreset {
  id: LayerPresetId;
  label: string;
  layers: LayerState;
}

const only = (...on: LayerKey[]): LayerState =>
  Object.fromEntries(LAYER_KEYS.map((key) => [key, on.includes(key)])) as LayerState;

export const LAYER_PRESETS: LayerPreset[] = [
  { id: "architectural", label: "Architectural", layers: only("walls", "rooms") },
  { id: "furniture", label: "Furniture plan", layers: only("walls", "rooms", "furniture") },
  {
    id: "electrical",
    label: "Electrical (no furniture)",
    layers: only("walls", "rooms", "loads", "lighting", "wiring"),
  },
  { id: "lighting", label: "Lighting plan", layers: only("walls", "rooms", "lighting", "heatmap") },
  { id: "power", label: "Power plan", layers: only("walls", "rooms", "loads", "wiring") },
  { id: "wiring", label: "Wiring only", layers: only("walls", "wiring") },
  {
    id: "compliance",
    label: "Compliance review",
    layers: only("walls", "rooms", "loads", "lighting", "wiring", "violations"),
  },
  { id: "all", label: "All", layers: only(...LAYER_KEYS) },
];

export function presetById(id: string): LayerPreset | undefined {
  return LAYER_PRESETS.find((preset) => preset.id === id);
}

/** The preset whose layers match exactly, if any (for showing the active view). */
export function matchingPreset(layers: LayerState): LayerPreset | undefined {
  return LAYER_PRESETS.find((preset) => LAYER_KEYS.every((key) => preset.layers[key] === layers[key]));
}

/** Parses `?lock=furniture,walls` into a lock state; unknown keys are ignored. */
export function parseLocks(value: string | null): LayerState {
  const keys = (value ?? "").split(",").map((s) => s.trim());

  return Object.fromEntries(LAYER_KEYS.map((key) => [key, keys.includes(key)])) as LayerState;
}

/* ---------- per-project persistence (this browser only) ---------- */

const storageKey = (projectId: string) => `solence.layers.${projectId}`;

export interface SavedLayerState {
  layers: LayerState;
  locked: LayerState;
}

export function loadLayerState(projectId: string): SavedLayerState | null {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));

    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedLayerState>;

    return {
      layers: { ...DEFAULT_LAYERS, ...saved.layers },
      locked: { ...NO_LOCKS, ...saved.locked },
    };
  } catch {
    return null;
  }
}

export function saveLayerState(projectId: string, state: SavedLayerState): void {
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(state));
  } catch {
    // Private mode / blocked storage: layer state simply isn't remembered.
  }
}
