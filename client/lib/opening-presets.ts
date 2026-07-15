/**
 * Door/window families and named type presets (Phase 2 brief §4.1) —
 * the BIM family/type/instance pattern without any BIM file format:
 * a FAMILY defines parametric behavior (how opening-geometry.ts builds
 * the mesh), a TYPE is a named preset pre-filling those parameters,
 * and an INSTANCE is a placed Opening whose exact width always wins
 * over the preset (presets are a starting point, never a lock).
 *
 * Style consistency comes from the style token: every generated door
 * and window in a project pulls its colors from one STYLE_TOKENS entry
 * (tied to the furniture style-pack system, §4.2), so openings never
 * carry an independent baked-in look.
 */

export interface OpeningStyleToken {
  frame: string;
  leaf: string;
  glass: string;
  handle: string;
}

/** One entry per interior style pack (furniture-library STYLE_PACKS). */
export const STYLE_TOKENS: Record<string, OpeningStyleToken> = {
  "solence-default": {
    frame: "#6b7280",
    leaf: "#a16207",
    glass: "#7dd3fc",
    handle: "#d1d5db",
  },
};

export interface DoorParams {
  family: "hinged-door";
  /** Meters; the placed Opening's width always overrides this. */
  width: number;
  height: number;
  frameThickness: number;
  frameDepth: number;
  /** 1 = single leaf, 2 = double leaf. */
  leaves: 1 | 2;
  /** Which side the hinge sits on, looking along the wall direction. */
  swing: "left" | "right";
}

export interface WindowParams {
  family: "fixed-window";
  width: number;
  /** Sill and head heights come from wall-geometry constants. */
  frameThickness: number;
  frameDepth: number;
  /** Number of vertical panes the glazing is split into. */
  panes: 1 | 2 | 3;
}

export interface OpeningPreset<P> {
  key: string;
  label: string;
  params: P;
}

export const DOOR_PRESETS: OpeningPreset<DoorParams>[] = [
  {
    key: "door-standard-0.9",
    label: "Standard Door 0.9 m",
    params: {
      family: "hinged-door",
      width: 0.9,
      height: 2.1,
      frameThickness: 0.05,
      frameDepth: 0.18,
      leaves: 1,
      swing: "left",
    },
  },
  {
    key: "door-standard-0.7",
    label: "Standard Door 0.7 m",
    params: {
      family: "hinged-door",
      width: 0.7,
      height: 2.1,
      frameThickness: 0.05,
      frameDepth: 0.18,
      leaves: 1,
      swing: "left",
    },
  },
  {
    key: "door-narrow-0.6",
    label: "Narrow Door 0.6 m",
    params: {
      family: "hinged-door",
      width: 0.6,
      height: 2.1,
      frameThickness: 0.04,
      frameDepth: 0.16,
      leaves: 1,
      swing: "left",
    },
  },
  {
    key: "door-double-1.6",
    label: "Double Door 1.6 m",
    params: {
      family: "hinged-door",
      width: 1.6,
      height: 2.1,
      frameThickness: 0.05,
      frameDepth: 0.18,
      leaves: 2,
      swing: "left",
    },
  },
];

export const WINDOW_PRESETS: OpeningPreset<WindowParams>[] = [
  {
    key: "window-1.2",
    label: "Window 1.2 m",
    params: {
      family: "fixed-window",
      width: 1.2,
      frameThickness: 0.05,
      frameDepth: 0.12,
      panes: 2,
    },
  },
  {
    key: "window-0.6",
    label: "Small Window 0.6 m",
    params: {
      family: "fixed-window",
      width: 0.6,
      frameThickness: 0.04,
      frameDepth: 0.12,
      panes: 1,
    },
  },
  {
    key: "window-1.8",
    label: "Wide Window 1.8 m",
    params: {
      family: "fixed-window",
      width: 1.8,
      frameThickness: 0.05,
      frameDepth: 0.12,
      panes: 3,
    },
  },
];

export const DEFAULT_DOOR_PRESET = DOOR_PRESETS[0];
export const DEFAULT_WINDOW_PRESET = WINDOW_PRESETS[0];

/** Preset whose width best matches a placed opening's actual width. */
export function nearestPreset<P extends { width: number }>(
  presets: OpeningPreset<P>[],
  width: number,
): OpeningPreset<P> {
  let best = presets[0];
  let bestDelta = Math.abs(best.params.width - width);

  for (const preset of presets) {
    const delta = Math.abs(preset.params.width - width);

    if (delta < bestDelta) {
      best = preset;
      bestDelta = delta;
    }
  }

  return best;
}
