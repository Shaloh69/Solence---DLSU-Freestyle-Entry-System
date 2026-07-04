/**
 * Wire router: grid A* (via the `pathfinding` package) wrapped with
 * wall-following behavior and path post-processing.
 *
 * Strategy: first try to route entirely inside the near-wall standoff
 * band (plus short connector stubs at each endpoint), which makes the
 * wire hug walls the way real conduit runs do. If the band is not
 * connected between the endpoints, fall back to any non-wall cell and
 * mark the result so the UI can surface it.
 */
import PF from "pathfinding";
import { Point, RoutedPath } from "../types.js";
import { toCell, toPoint, WalkabilityGrid } from "./rasterizer.js";

export interface RouteOptions {
  /**
   * Radius (in cells) around each endpoint opened up in wall-following
   * mode so loads in open floor can reach the wall band.
   */
  connectorRadius?: number;
}

export function routeWire(
  panelPosition: Point,
  loadPosition: Point,
  loadId: string,
  grid: WalkabilityGrid,
  options: RouteOptions = {}
): RoutedPath {
  const connectorRadius =
    options.connectorRadius ?? Math.ceil(1.0 / grid.cellSize);

  const start = nearestOpenCell(toCell(panelPosition, grid), grid);
  const goal = nearestOpenCell(toCell(loadPosition, grid), grid);

  if (!start || !goal) {
    throw new Error(
      `No routable cell near ${!start ? "panel" : `load ${loadId}`} position`
    );
  }

  // Attempt 1: wall-hugging — only the near-wall band plus connector
  // stubs around the endpoints are walkable.
  const bandPath = findPath(start, goal, grid, {
    wallFollowing: true,
    connectorRadius,
  });

  const cells =
    bandPath ??
    // Attempt 2: anywhere that is not inside a wall.
    findPath(start, goal, grid, { wallFollowing: false, connectorRadius });

  if (!cells) {
    throw new Error(
      `No route from panel to load ${loadId} — floor plan may enclose one of them completely`
    );
  }

  const compressed = PF.Util.compressPath(cells) as number[][];
  const points = compressed.map(([col, row]) => toPoint(col, row, grid));

  // Anchor the polyline to the true endpoint positions.
  points[0] = panelPosition;
  points[points.length - 1] = loadPosition;

  return {
    loadId,
    points,
    lengthM: polylineLength(points),
    fallback: bandPath === null,
  };
}

function findPath(
  start: { col: number; row: number },
  goal: { col: number; row: number },
  grid: WalkabilityGrid,
  opts: { wallFollowing: boolean; connectorRadius: number }
): number[][] | null {
  const pfGrid = new PF.Grid(grid.cols, grid.rows);

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const walkable = opts.wallFollowing
        ? grid.nearWall[row][col]
        : !grid.blocked[row][col];

      pfGrid.setWalkableAt(col, row, walkable);
    }
  }

  if (opts.wallFollowing) {
    // Open connector stubs so endpoints away from walls can reach the band.
    openDisk(pfGrid, grid, start, opts.connectorRadius);
    openDisk(pfGrid, grid, goal, opts.connectorRadius);
  }

  pfGrid.setWalkableAt(start.col, start.row, true);
  pfGrid.setWalkableAt(goal.col, goal.row, true);

  const finder = new PF.AStarFinder({
    diagonalMovement: PF.DiagonalMovement.Never,
  });
  const path = finder.findPath(
    start.col,
    start.row,
    goal.col,
    goal.row,
    pfGrid
  );

  return path.length > 0 ? path : null;
}

function openDisk(
  pfGrid: InstanceType<typeof PF.Grid>,
  grid: WalkabilityGrid,
  center: { col: number; row: number },
  radius: number
): void {
  for (let row = center.row - radius; row <= center.row + radius; row++) {
    for (let col = center.col - radius; col <= center.col + radius; col++) {
      if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) continue;
      const dr = row - center.row;
      const dc = col - center.col;

      if (dr * dr + dc * dc <= radius * radius && !grid.blocked[row][col]) {
        pfGrid.setWalkableAt(col, row, true);
      }
    }
  }
}

/** Nearest non-wall cell to the given cell, spiral search. */
function nearestOpenCell(
  cell: { col: number; row: number },
  grid: WalkabilityGrid
): { col: number; row: number } | null {
  if (!grid.blocked[cell.row][cell.col]) return cell;

  const maxRadius = Math.max(grid.cols, grid.rows);

  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let row = cell.row - radius; row <= cell.row + radius; row++) {
      for (let col = cell.col - radius; col <= cell.col + radius; col++) {
        if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
          continue;
        }
        if (
          Math.max(Math.abs(row - cell.row), Math.abs(col - cell.col)) ===
            radius &&
          !grid.blocked[row][col]
        ) {
          return { col, row };
        }
      }
    }
  }

  return null;
}

function polylineLength(points: Point[]): number {
  let length = 0;

  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    );
  }

  return length;
}
