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
  | "cabinet";

export type FurnitureCategory =
  | "seating"
  | "tables"
  | "beds"
  | "storage"
  | "kitchen";

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
