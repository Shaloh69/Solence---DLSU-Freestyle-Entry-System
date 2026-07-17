/**
 * Furniture library (brief §11.1) — interior spatial-planning objects,
 * a SEPARATE category from the electrical component library
 * (component-library.ts). Furniture draws no current, is never part of
 * load-calc/sizing/compliance, and has no PEC rules attached — keep
 * that distinction explicit here rather than folding it into LoadType.
 *
 * `footprint` is the plan-view rectangle (meters) used for 2D rendering
 * and snap-to-grid/snap-to-wall; `meshKey` selects the low-poly Three.js
 * geometry in wiring-overlay's furniture renderer.
 */

export type FurnitureMeshKey =
  | "table"
  | "chair"
  | "sofa"
  | "bed"
  | "wardrobe"
  | "desk"
  | "counter"
  | "cabinet"
  | "lamp-floor"
  | "lamp-table"
  | "rug"
  | "appliance"
  | "plant"
  | "mirror";

export type FurnitureCategory =
  | "seating"
  | "tables"
  | "beds"
  | "storage"
  | "kitchen"
  | "office"
  | "laundry"
  | "outdoor"
  | "lighting"
  | "decor";

/**
 * Portable lamps are furniture AND light sources (Phase 2 §2.1a): a
 * placed item carrying `emitsLight` also creates a linked lighting load
 * (same position, deleted/moved together) so it feeds the lux
 * calculation, circuits, and compliance like any ceiling fixture — one
 * object, both natures, never two disconnected systems.
 */
export interface EmitsLight {
  lumens: number;
  va: number;
  /** Correlated color temperature, Kelvin (§9.1a). */
  cct: number;
}

/**
 * Style packs (Phase 2 §4.2): a curated, visually-consistent group of
 * furniture the project selects as a whole — the palette filters at the
 * pack level so anything placed is guaranteed to belong together.
 * Single pack for the MVP; a sourced Kenney pack lands as a second
 * entry (assets under public/assets/models/furniture/, rows ingested
 * into Supabase component_library).
 */
export const STYLE_PACKS: Record<string, { label: string; source: string }> = {
  "solence-default": {
    label: "Solence Default",
    source: "procedural three.js primitives (no external assets)",
  },
};

export const DEFAULT_STYLE_PACK = "solence-default";

export interface FurnitureItem {
  key: string;
  label: string;
  meshKey: FurnitureMeshKey;
  category: FurnitureCategory;
  /** STYLE_PACKS id — palette filtering happens at the pack level. */
  stylePack: string;
  /** Plan-view footprint, meters. */
  width: number;
  depth: number;
  height: number;
  /** Icon name rendered by the palette (lucide-react). */
  icon: string;
  /** Present on portable lamps — see EmitsLight. */
  emitsLight?: EmitsLight;
}

export const FURNITURE_LIBRARY: FurnitureItem[] = [
  {
    key: "dining-table",
    label: "Dining Table",
    meshKey: "table",
    category: "tables",
    stylePack: DEFAULT_STYLE_PACK,
    width: 1.5,
    depth: 0.9,
    height: 0.75,
    icon: "square",
  },
  {
    key: "side-table",
    label: "Side Table",
    meshKey: "table",
    category: "tables",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.5,
    depth: 0.5,
    height: 0.5,
    icon: "square",
  },
  {
    key: "dining-chair",
    label: "Dining Chair",
    meshKey: "chair",
    category: "seating",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.45,
    depth: 0.45,
    height: 0.9,
    icon: "armchair",
  },
  {
    key: "office-chair",
    label: "Office Chair",
    meshKey: "chair",
    category: "seating",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.55,
    depth: 0.55,
    height: 1.0,
    icon: "armchair",
  },
  {
    key: "sofa-2seat",
    label: "2-Seat Sofa",
    meshKey: "sofa",
    category: "seating",
    stylePack: DEFAULT_STYLE_PACK,
    width: 1.5,
    depth: 0.85,
    height: 0.8,
    icon: "sofa",
  },
  {
    key: "sofa-3seat",
    label: "3-Seat Sofa",
    meshKey: "sofa",
    category: "seating",
    stylePack: DEFAULT_STYLE_PACK,
    width: 2.1,
    depth: 0.85,
    height: 0.8,
    icon: "sofa",
  },
  {
    key: "bed-single",
    label: "Single Bed",
    meshKey: "bed",
    category: "beds",
    stylePack: DEFAULT_STYLE_PACK,
    width: 1.0,
    depth: 2.0,
    height: 0.55,
    icon: "bed-single",
  },
  {
    key: "bed-double",
    label: "Double Bed",
    meshKey: "bed",
    category: "beds",
    stylePack: DEFAULT_STYLE_PACK,
    width: 1.5,
    depth: 2.0,
    height: 0.55,
    icon: "bed-double",
  },
  {
    key: "wardrobe",
    label: "Wardrobe",
    meshKey: "wardrobe",
    category: "storage",
    stylePack: DEFAULT_STYLE_PACK,
    width: 1.2,
    depth: 0.6,
    height: 2.0,
    icon: "door-closed",
  },
  {
    key: "desk",
    label: "Desk",
    meshKey: "desk",
    category: "tables",
    stylePack: DEFAULT_STYLE_PACK,
    width: 1.2,
    depth: 0.6,
    height: 0.75,
    icon: "square",
  },
  {
    key: "kitchen-counter",
    label: "Kitchen Counter",
    meshKey: "counter",
    category: "kitchen",
    stylePack: DEFAULT_STYLE_PACK,
    width: 2.0,
    depth: 0.6,
    height: 0.9,
    icon: "rectangle-horizontal",
  },
  {
    key: "kitchen-cabinet",
    label: "Kitchen Cabinet",
    meshKey: "cabinet",
    category: "kitchen",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.8,
    depth: 0.4,
    height: 2.1,
    icon: "archive",
  },
  {
    key: "bookshelf",
    label: "Bookshelf",
    meshKey: "cabinet",
    category: "storage",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.9,
    depth: 0.3,
    height: 1.8,
    icon: "archive",
  },
  {
    key: "tv-stand",
    label: "TV Stand",
    meshKey: "cabinet",
    category: "storage",
    stylePack: DEFAULT_STYLE_PACK,
    width: 1.4,
    depth: 0.4,
    height: 0.5,
    icon: "rectangle-horizontal",
  },
  // ---- Phase 2 §2.1a room-complete expansion (procedural MVP set;
  // sourced GLB packs slot in later per public/assets conventions) ----
  {
    key: "armchair",
    label: "Armchair",
    meshKey: "chair",
    category: "seating",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.8,
    depth: 0.85,
    height: 0.95,
    icon: "armchair",
  },
  {
    key: "sofa-sectional",
    label: "Sectional Sofa",
    meshKey: "sofa",
    category: "seating",
    stylePack: DEFAULT_STYLE_PACK,
    width: 2.8,
    depth: 1.6,
    height: 0.8,
    icon: "sofa",
  },
  {
    key: "ottoman",
    label: "Ottoman",
    meshKey: "chair",
    category: "seating",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.6,
    depth: 0.6,
    height: 0.4,
    icon: "square",
  },
  {
    key: "coffee-table",
    label: "Coffee Table",
    meshKey: "table",
    category: "tables",
    stylePack: DEFAULT_STYLE_PACK,
    width: 1.1,
    depth: 0.6,
    height: 0.45,
    icon: "square",
  },
  {
    key: "bed-queen",
    label: "Queen Bed",
    meshKey: "bed",
    category: "beds",
    stylePack: DEFAULT_STYLE_PACK,
    width: 1.6,
    depth: 2.05,
    height: 0.55,
    icon: "bed-double",
  },
  {
    key: "nightstand",
    label: "Nightstand",
    meshKey: "cabinet",
    category: "beds",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.45,
    depth: 0.4,
    height: 0.55,
    icon: "archive",
  },
  {
    key: "dresser",
    label: "Dresser",
    meshKey: "cabinet",
    category: "storage",
    stylePack: DEFAULT_STYLE_PACK,
    width: 1.2,
    depth: 0.5,
    height: 0.85,
    icon: "archive",
  },
  {
    key: "vanity",
    label: "Vanity / Dressing Table",
    meshKey: "desk",
    category: "storage",
    stylePack: DEFAULT_STYLE_PACK,
    width: 1.0,
    depth: 0.45,
    height: 0.78,
    icon: "square",
  },
  {
    key: "mirror",
    label: "Mirror",
    meshKey: "mirror",
    category: "decor",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.7,
    depth: 0.08,
    height: 1.7,
    icon: "rectangle-horizontal",
  },
  {
    key: "rug",
    label: "Rug",
    meshKey: "rug",
    category: "decor",
    stylePack: DEFAULT_STYLE_PACK,
    width: 2.0,
    depth: 1.4,
    height: 0.02,
    icon: "rectangle-horizontal",
  },
  {
    key: "plant",
    label: "Plant",
    meshKey: "plant",
    category: "decor",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.45,
    depth: 0.45,
    height: 1.2,
    icon: "square",
  },
  {
    key: "filing-cabinet",
    label: "Filing Cabinet",
    meshKey: "cabinet",
    category: "office",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.45,
    depth: 0.6,
    height: 1.3,
    icon: "archive",
  },
  {
    key: "bar-stool",
    label: "Bar Stool",
    meshKey: "chair",
    category: "kitchen",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.4,
    depth: 0.4,
    height: 1.0,
    icon: "armchair",
  },
  {
    key: "refrigerator-unit",
    label: "Refrigerator (unit)",
    meshKey: "appliance",
    category: "kitchen",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.75,
    depth: 0.75,
    height: 1.8,
    icon: "archive",
  },
  {
    key: "washer-unit",
    label: "Washer (unit)",
    meshKey: "appliance",
    category: "laundry",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.6,
    depth: 0.6,
    height: 0.85,
    icon: "archive",
  },
  {
    key: "dryer-unit",
    label: "Dryer (unit)",
    meshKey: "appliance",
    category: "laundry",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.6,
    depth: 0.6,
    height: 0.85,
    icon: "archive",
  },
  {
    key: "laundry-shelving",
    label: "Storage Shelving",
    meshKey: "cabinet",
    category: "laundry",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.9,
    depth: 0.4,
    height: 1.8,
    icon: "archive",
  },
  {
    key: "workbench",
    label: "Workbench",
    meshKey: "desk",
    category: "storage",
    stylePack: DEFAULT_STYLE_PACK,
    width: 1.6,
    depth: 0.6,
    height: 0.9,
    icon: "square",
  },
  {
    key: "outdoor-chair",
    label: "Outdoor Chair",
    meshKey: "chair",
    category: "outdoor",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.55,
    depth: 0.55,
    height: 0.85,
    icon: "armchair",
  },
  {
    key: "outdoor-table",
    label: "Outdoor Table",
    meshKey: "table",
    category: "outdoor",
    stylePack: DEFAULT_STYLE_PACK,
    width: 1.2,
    depth: 1.2,
    height: 0.72,
    icon: "square",
  },
  // Portable lamps — furniture AND light sources (§2.1a): placing one
  // also places a linked lighting load so it feeds lux + circuits.
  {
    key: "lamp-floor",
    label: "Floor Lamp",
    meshKey: "lamp-floor",
    category: "lighting",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.35,
    depth: 0.35,
    height: 1.6,
    icon: "lamp",
    emitsLight: { lumens: 800, va: 9, cct: 2700 },
  },
  {
    key: "lamp-table",
    label: "Table Lamp",
    meshKey: "lamp-table",
    category: "lighting",
    stylePack: DEFAULT_STYLE_PACK,
    width: 0.25,
    depth: 0.25,
    height: 0.5,
    icon: "lamp",
    emitsLight: { lumens: 470, va: 6, cct: 2700 },
  },
];

/** Items in the active style pack, grouped by category for the palette. */
export function furnitureByCategory(
  stylePack: string = DEFAULT_STYLE_PACK,
): Map<FurnitureCategory, FurnitureItem[]> {
  const groups = new Map<FurnitureCategory, FurnitureItem[]>();

  for (const item of FURNITURE_LIBRARY) {
    if (item.stylePack !== stylePack) continue;
    const list = groups.get(item.category) ?? [];

    list.push(item);
    groups.set(item.category, list);
  }

  return groups;
}
