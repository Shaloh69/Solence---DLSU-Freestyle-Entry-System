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

export interface FurnitureItem {
  key: string;
  label: string;
  meshKey: FurnitureMeshKey;
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
    width: 1.5,
    depth: 0.9,
    height: 0.75,
    icon: "square",
  },
  {
    key: "side-table",
    label: "Side Table",
    meshKey: "table",
    width: 0.5,
    depth: 0.5,
    height: 0.5,
    icon: "square",
  },
  {
    key: "dining-chair",
    label: "Dining Chair",
    meshKey: "chair",
    width: 0.45,
    depth: 0.45,
    height: 0.9,
    icon: "armchair",
  },
  {
    key: "office-chair",
    label: "Office Chair",
    meshKey: "chair",
    width: 0.55,
    depth: 0.55,
    height: 1.0,
    icon: "armchair",
  },
  {
    key: "sofa-2seat",
    label: "2-Seat Sofa",
    meshKey: "sofa",
    width: 1.5,
    depth: 0.85,
    height: 0.8,
    icon: "sofa",
  },
  {
    key: "sofa-3seat",
    label: "3-Seat Sofa",
    meshKey: "sofa",
    width: 2.1,
    depth: 0.85,
    height: 0.8,
    icon: "sofa",
  },
  {
    key: "bed-single",
    label: "Single Bed",
    meshKey: "bed",
    width: 1.0,
    depth: 2.0,
    height: 0.55,
    icon: "bed-single",
  },
  {
    key: "bed-double",
    label: "Double Bed",
    meshKey: "bed",
    width: 1.5,
    depth: 2.0,
    height: 0.55,
    icon: "bed-double",
  },
  {
    key: "wardrobe",
    label: "Wardrobe",
    meshKey: "wardrobe",
    width: 1.2,
    depth: 0.6,
    height: 2.0,
    icon: "door-closed",
  },
  {
    key: "desk",
    label: "Desk",
    meshKey: "desk",
    width: 1.2,
    depth: 0.6,
    height: 0.75,
    icon: "square",
  },
  {
    key: "kitchen-counter",
    label: "Kitchen Counter",
    meshKey: "counter",
    width: 2.0,
    depth: 0.6,
    height: 0.9,
    icon: "rectangle-horizontal",
  },
  {
    key: "kitchen-cabinet",
    label: "Kitchen Cabinet",
    meshKey: "cabinet",
    width: 0.8,
    depth: 0.4,
    height: 2.1,
    icon: "archive",
  },
  {
    key: "bookshelf",
    label: "Bookshelf",
    meshKey: "cabinet",
    width: 0.9,
    depth: 0.3,
    height: 1.8,
    icon: "archive",
  },
  {
    key: "tv-stand",
    label: "TV Stand",
    meshKey: "cabinet",
    width: 1.4,
    depth: 0.4,
    height: 0.5,
    icon: "rectangle-horizontal",
  },
];
