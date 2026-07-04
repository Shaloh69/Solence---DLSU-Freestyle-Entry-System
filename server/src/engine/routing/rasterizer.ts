/**
 * Floor-plan-to-grid rasterizer.
 *
 * Converts wall segments into a walkability grid for the A* router:
 *  - `blocked`  — cell center lies inside a wall (impassable)
 *  - `nearWall` — cell center lies within the standoff band around a wall
 *                 (preferred lane so routed wire hugs walls instead of
 *                 beelining across open floor)
 *
 * Works the same whether the plan was drawn by hand or produced by the
 * future solence-vision segmentation service — both reduce to walls,
 * rooms, and openings.
 */
import { FloorPlan, Point, Wall } from "../types.js";

export interface WalkabilityGrid {
  /** Cells per row (x direction). */
  cols: number;
  /** Cells per column (y direction). */
  rows: number;
  /** Edge length of a square cell, meters. */
  cellSize: number;
  /** blocked[y][x] — wall interior. */
  blocked: boolean[][];
  /** nearWall[y][x] — inside the wall-hugging band, not blocked. */
  nearWall: boolean[][];
}

export interface RasterizerOptions {
  /** Grid resolution in meters per cell. */
  cellSize?: number;
  /** Wire standoff band width beyond the wall face, meters. */
  clearance?: number;
  /** Default wall thickness when a wall omits it, meters. */
  defaultWallThickness?: number;
}

const DEFAULTS: Required<RasterizerOptions> = {
  cellSize: 0.1,
  clearance: 0.3,
  defaultWallThickness: 0.15,
};

export function rasterizeFloorPlan(
  plan: FloorPlan,
  options: RasterizerOptions = {}
): WalkabilityGrid {
  const { cellSize, clearance, defaultWallThickness } = {
    ...DEFAULTS,
    ...options,
  };

  if (plan.width <= 0 || plan.height <= 0) {
    throw new Error("Floor plan must have positive width and height");
  }

  const cols = Math.max(1, Math.ceil(plan.width / cellSize));
  const rows = Math.max(1, Math.ceil(plan.height / cellSize));
  const blocked = makeMatrix(rows, cols);
  const nearWall = makeMatrix(rows, cols);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const center: Point = {
        x: (col + 0.5) * cellSize,
        y: (row + 0.5) * cellSize,
      };

      for (const wall of plan.walls) {
        const halfThickness = (wall.thickness ?? defaultWallThickness) / 2;
        const distance = distanceToSegment(center, wall);

        if (distance <= halfThickness) {
          blocked[row][col] = true;
          nearWall[row][col] = false;
          break;
        }
        if (distance <= halfThickness + clearance) {
          nearWall[row][col] = true;
        }
      }
    }
  }

  return { cols, rows, cellSize, blocked, nearWall };
}

/** Convert a floor-plan point (meters) to grid cell indices, clamped. */
export function toCell(
  point: Point,
  grid: WalkabilityGrid
): { col: number; row: number } {
  return {
    col: clamp(Math.floor(point.x / grid.cellSize), 0, grid.cols - 1),
    row: clamp(Math.floor(point.y / grid.cellSize), 0, grid.rows - 1),
  };
}

/** Convert grid cell indices back to the cell-center point in meters. */
export function toPoint(
  col: number,
  row: number,
  grid: WalkabilityGrid
): Point {
  return {
    x: (col + 0.5) * grid.cellSize,
    y: (row + 0.5) * grid.cellSize,
  };
}

function makeMatrix(rows: number, cols: number): boolean[][] {
  return Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
}

function distanceToSegment(point: Point, wall: Wall): number {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.hypot(point.x - wall.start.x, point.y - wall.start.y);
  }

  const t = clamp(
    ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / lengthSq,
    0,
    1
  );
  const projX = wall.start.x + t * dx;
  const projY = wall.start.y + t * dy;

  return Math.hypot(point.x - projX, point.y - projY);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
