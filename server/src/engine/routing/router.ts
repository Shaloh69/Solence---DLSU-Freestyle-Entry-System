/**
 * Wire router — weighted shortest paths on the floor-plan grid.
 *
 * Model (see routing-costs.ts): conduit runs in the ceiling plane, kept
 * along walls where possible, crossing open ceiling to reach center
 * fixtures, passing THROUGH a wall when that beats the detour (each
 * crossing is counted as a penetration), and avoiding the outside of the
 * house. Bends cost a little, so runs come out straight and orthogonal.
 *
 * `routeAll` runs one Dijkstra from the panel over (cell, heading)
 * states and reads every device's route from the same shortest-path
 * tree, so devices share trunk runs the way real home runs share conduit.
 * `routeWire` is the single-target form of the same search.
 *
 * Endpoints are snapped to an open cell on their own room's side of a
 * wall, so a flush-mounted outlet is never fed from the next room.
 */
import { Point, RoutedPath } from "../types.js";
import { pointInPolygon } from "../geometry.js";
import { toCell, toPoint, WalkabilityGrid } from "./rasterizer.js";
import {
  COST_ALONG_WALL,
  COST_BEND,
  COST_INSIDE_WALL,
  COST_OPEN_CEILING,
  COST_OUTSIDE,
  COST_WALL_PENETRATION,
  ROOM_SNAP_RADIUS_M,
} from "./routing-costs.js";

export interface RouteOptions {
  /** Room polygon of the load, used to snap onto the correct side of a wall. */
  loadRoom?: Point[];
  /** Room polygon of the panel. */
  panelRoom?: Point[];
}

export interface RouteTarget {
  id: string;
  position: Point;
  room?: Point[];
}

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

interface Cell {
  col: number;
  row: number;
}

/* ---------- search ---------- */

class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, val: number): void {
    const k = this.keys;
    const v = this.vals;
    let i = k.length;

    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;

      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }

  pop(): [number, number] {
    const k = this.keys;
    const v = this.vals;
    const topK = k[0];
    const topV = v[0];
    const lastK = k.pop()!;
    const lastV = v.pop()!;

    if (k.length > 0) {
      let i = 0;
      const n = k.length;

      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        let mk = lastK;

        if (l < n && k[l] < mk) {
          m = l;
          mk = k[l];
        }
        if (r < n && k[r] < mk) {
          m = r;
          mk = k[r];
        }
        if (m === i) break;
        k[i] = k[m];
        v[i] = v[m];
        i = m;
      }
      k[i] = lastK;
      v[i] = lastV;
    }

    return [topK, topV];
  }
}

interface SearchTree {
  dist: Float64Array;
  prev: Int32Array;
}

function stepCost(grid: WalkabilityGrid, col: number, row: number): number {
  if (grid.blocked[row][col]) return COST_INSIDE_WALL;
  if (!grid.inside[row][col]) return COST_OUTSIDE;
  if (grid.nearWall[row][col]) return COST_ALONG_WALL;

  return COST_OPEN_CEILING;
}

/** Dijkstra over (cell, heading). Stops early once every `stopAt` cell is settled. */
function search(grid: WalkabilityGrid, start: Cell, stopAt?: Set<number>): SearchTree {
  const { cols, rows, cellSize } = grid;
  const n = cols * rows * 4;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const settled = new Uint8Array(n);
  const heap = new MinHeap();
  const remaining = stopAt ? new Set(stopAt) : null;

  for (let h = 0; h < 4; h++) {
    const s = (start.row * cols + start.col) * 4 + h;

    dist[s] = 0;
    heap.push(0, s);
  }

  while (heap.size > 0) {
    const [d, s] = heap.pop();

    if (settled[s]) continue;
    settled[s] = 1;
    const cellIdx = s >> 2;

    // The first heading to settle holds the cell's minimum cost.
    if (remaining && remaining.delete(cellIdx) && remaining.size === 0) break;
    const heading = s & 3;
    const col = cellIdx % cols;
    const row = (cellIdx - col) / cols;
    const fromWall = grid.blocked[row][col];
    const isStart = prev[s] === -1;

    for (let h = 0; h < 4; h++) {
      if (!isStart && h === (heading + 2) % 4) continue; // no U-turns
      const nc = col + DX[h];
      const nr = row + DY[h];

      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      let cost = stepCost(grid, nc, nr) * cellSize;

      if (!fromWall && grid.blocked[nr][nc]) cost += COST_WALL_PENETRATION;
      if (!isStart && h !== heading) cost += COST_BEND;
      const t = (nr * cols + nc) * 4 + h;
      const nd = d + cost;

      if (nd < dist[t]) {
        dist[t] = nd;
        prev[t] = s;
        heap.push(nd, t);
      }
    }
  }

  return { dist, prev };
}

function bestState(tree: SearchTree, cellIdx: number): number {
  let best = -1;

  for (let h = 0; h < 4; h++) {
    const s = cellIdx * 4 + h;

    if (tree.dist[s] < Infinity && (best === -1 || tree.dist[s] < tree.dist[best])) best = s;
  }

  return best;
}

function cellsTo(tree: SearchTree, endState: number): number[] {
  const cells: number[] = [];

  for (let s = endState; s !== -1; s = tree.prev[s]) {
    const c = s >> 2;

    if (cells[cells.length - 1] !== c) cells.push(c);
  }

  return cells.reverse();
}

/* ---------- snapping ---------- */

/**
 * Nearest open (non-wall) cell to `point`. When the device's room is
 * known, prefer open cells whose centers lie inside that room — so a
 * device drawn on or in a wall is fed from its own side.
 */
function snap(point: Point, grid: WalkabilityGrid, room?: Point[]): Cell | null {
  const origin = toCell(point, grid);
  const maxRing = Math.max(grid.cols, grid.rows);
  const roomRing = Math.ceil(ROOM_SNAP_RADIUS_M / grid.cellSize);

  const scan = (accept: (c: Cell) => boolean, limit: number): Cell | null => {
    for (let ring = 0; ring <= limit; ring++) {
      let best: Cell | null = null;
      let bestD = Infinity;

      for (let row = origin.row - ring; row <= origin.row + ring; row++) {
        for (let col = origin.col - ring; col <= origin.col + ring; col++) {
          if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) continue;
          if (Math.max(Math.abs(row - origin.row), Math.abs(col - origin.col)) !== ring) continue;
          if (grid.blocked[row][col] || !accept({ col, row })) continue;
          const c = toPoint(col, row, grid);
          const d = Math.hypot(c.x - point.x, c.y - point.y);

          if (d < bestD) {
            bestD = d;
            best = { col, row };
          }
        }
      }
      if (best) return best;
    }

    return null;
  };

  if (room && room.length >= 3) {
    const inRoom = scan((c) => pointInPolygon(toPoint(c.col, c.row, grid), room), roomRing);

    if (inRoom) return inRoom;
  }

  return scan(() => true, maxRing);
}

/* ---------- path → RoutedPath ---------- */

function toRoutedPath(
  cells: number[],
  grid: WalkabilityGrid,
  from: Point,
  to: Point,
  loadId: string
): RoutedPath {
  const { cols } = grid;
  const at = (i: number) => {
    const col = cells[i] % cols;

    return { col, row: (cells[i] - col) / cols };
  };
  let penetrations = 0;
  let outside = false;
  const corners: Point[] = [];

  for (let i = 0; i < cells.length; i++) {
    const c = at(i);

    if (!grid.inside[c.row][c.col]) outside = true;
    if (i > 0) {
      const p = at(i - 1);

      if (!grid.blocked[p.row][p.col] && grid.blocked[c.row][c.col]) penetrations++;
    }
    const isEnd = i === 0 || i === cells.length - 1;
    let turns = false;

    if (!isEnd) {
      const a = at(i - 1);
      const b = at(i + 1);

      turns = a.col - c.col !== c.col - b.col || a.row - c.row !== c.row - b.row;
    }
    if (isEnd || turns) corners.push(toPoint(c.col, c.row, grid));
  }

  // Anchor to the true device positions (the stubs are the drops to the boxes).
  const points = [from, ...corners, to].filter(
    (p, i, arr) => i === 0 || p.x !== arr[i - 1].x || p.y !== arr[i - 1].y
  );

  return {
    loadId,
    points,
    lengthM: polylineLength(points),
    fallback: outside,
    penetrations,
  };
}

/* ---------- public API ---------- */

export function routeWire(
  panelPosition: Point,
  loadPosition: Point,
  loadId: string,
  grid: WalkabilityGrid,
  options: RouteOptions = {}
): RoutedPath {
  const { routes, errors } = routeAll(
    panelPosition,
    [{ id: loadId, position: loadPosition, room: options.loadRoom }],
    grid,
    options.panelRoom
  );

  if (errors.length > 0) throw new Error(errors[0].message);

  return routes[0];
}

export function routeAll(
  panelPosition: Point,
  targets: RouteTarget[],
  grid: WalkabilityGrid,
  panelRoom?: Point[]
): { routes: RoutedPath[]; errors: { loadId: string; message: string }[] } {
  const routes: RoutedPath[] = [];
  const errors: { loadId: string; message: string }[] = [];
  const start = snap(panelPosition, grid, panelRoom);

  if (!start) {
    return {
      routes,
      errors: targets.map((t) => ({ loadId: t.id, message: "No routable cell near the panel position" })),
    };
  }

  const goals = targets.map((t) => ({ target: t, cell: snap(t.position, grid, t.room) }));
  const goalIdx = new Set(
    goals.filter((g) => g.cell).map((g) => g.cell!.row * grid.cols + g.cell!.col)
  );
  const tree = search(grid, start, goalIdx);

  for (const { target, cell } of goals) {
    if (!cell) {
      errors.push({ loadId: target.id, message: `No routable cell near load ${target.id}` });
      continue;
    }
    const end = bestState(tree, cell.row * grid.cols + cell.col);

    if (end === -1) {
      errors.push({ loadId: target.id, message: `No route from panel to load ${target.id}` });
      continue;
    }
    routes.push(toRoutedPath(cellsTo(tree, end), grid, panelPosition, target.position, target.id));
  }

  return { routes, errors };
}

/**
 * Routes from one device to each of `targets` with the same cost model —
 * the device-to-device links of a circuit (W3). One search, stopped as
 * soon as every target is settled. Unreachable targets are left out.
 */
export function routeFromDevice(
  source: RouteTarget,
  targets: RouteTarget[],
  grid: WalkabilityGrid
): Map<string, RoutedPath> {
  const paths = new Map<string, RoutedPath>();
  const start = snap(source.position, grid, source.room);

  if (!start) return paths;
  const goals = targets
    .map((t) => ({ target: t, cell: snap(t.position, grid, t.room) }))
    .filter((g): g is { target: RouteTarget; cell: Cell } => g.cell !== null);
  const tree = search(grid, start, new Set(goals.map((g) => g.cell.row * grid.cols + g.cell.col)));

  for (const { target, cell } of goals) {
    const end = bestState(tree, cell.row * grid.cols + cell.col);

    if (end !== -1) {
      paths.set(target.id, toRoutedPath(cellsTo(tree, end), grid, source.position, target.position, target.id));
    }
  }

  return paths;
}

function polylineLength(points: Point[]): number {
  let length = 0;

  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }

  return length;
}
