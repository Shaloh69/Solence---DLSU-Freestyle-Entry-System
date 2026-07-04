import { describe, it, expect } from "vitest";
import {
  rasterizeFloorPlan,
  toCell,
} from "../src/engine/routing/index.js";
import { routeWire } from "../src/engine/routing/index.js";
import { FloorPlan, Point } from "../src/engine/types.js";

/**
 * 10 m × 8 m single room with a perimeter wall and one interior wall
 * partially dividing the space:
 *
 *   (0,0) ─────────────── (10,0)
 *     │                      │
 *     │        (5,2)         │
 *     │          │ interior  │
 *     │        (5,6)         │
 *     │                      │
 *   (0,8) ─────────────── (10,8)
 */
function makePlan(): FloorPlan {
  return {
    width: 10,
    height: 8,
    walls: [
      { id: "n", start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
      { id: "e", start: { x: 10, y: 0 }, end: { x: 10, y: 8 } },
      { id: "s", start: { x: 10, y: 8 }, end: { x: 0, y: 8 } },
      { id: "w", start: { x: 0, y: 8 }, end: { x: 0, y: 0 } },
      { id: "divider", start: { x: 5, y: 2 }, end: { x: 5, y: 6 } },
    ],
    rooms: [],
  };
}

describe("rasterizeFloorPlan", () => {
  it("produces a grid matching the plan extents", () => {
    const grid = rasterizeFloorPlan(makePlan(), { cellSize: 0.1 });

    expect(grid.cols).toBe(100);
    expect(grid.rows).toBe(80);
  });

  it("blocks wall cells and leaves open floor walkable", () => {
    const grid = rasterizeFloorPlan(makePlan(), { cellSize: 0.1 });

    const onWall = toCell({ x: 5, y: 4 }, grid); // interior divider
    const openFloor = toCell({ x: 2.5, y: 4 }, grid);

    expect(grid.blocked[onWall.row][onWall.col]).toBe(true);
    expect(grid.blocked[openFloor.row][openFloor.col]).toBe(false);
  });

  it("marks a clearance band next to walls, not in open floor", () => {
    const grid = rasterizeFloorPlan(makePlan(), {
      cellSize: 0.1,
      clearance: 0.3,
    });

    const nearNorthWall = toCell({ x: 5, y: 0.25 }, grid);
    const centerOfRoom = toCell({ x: 2.5, y: 4 }, grid);

    expect(grid.nearWall[nearNorthWall.row][nearNorthWall.col]).toBe(true);
    expect(grid.nearWall[centerOfRoom.row][centerOfRoom.col]).toBe(false);
  });

  it("rejects degenerate plans", () => {
    expect(() =>
      rasterizeFloorPlan({ width: 0, height: 5, walls: [], rooms: [] })
    ).toThrow();
  });
});

describe("routeWire", () => {
  const panel: Point = { x: 0.5, y: 0.5 };

  it("routes from panel to load without crossing walls", () => {
    const plan = makePlan();
    const grid = rasterizeFloorPlan(plan, { cellSize: 0.1 });
    // Load on the far side of the interior divider.
    const load: Point = { x: 8, y: 4 };

    const route = routeWire(panel, load, "load-1", grid);

    expect(route.points.length).toBeGreaterThan(1);
    expect(route.points[0]).toEqual(panel);
    expect(route.points[route.points.length - 1]).toEqual(load);
    // Any route around the divider is longer than the straight line.
    const straightLine = Math.hypot(load.x - panel.x, load.y - panel.y);

    expect(route.lengthM).toBeGreaterThanOrEqual(straightLine);

    // No intermediate waypoint may sit inside the divider wall
    // (within half its default 0.15 m thickness of x=5, between y=2..6).
    for (const point of route.points.slice(1, -1)) {
      const insideDivider =
        Math.abs(point.x - 5) <= 0.075 && point.y >= 2 && point.y <= 6;

      expect(insideDivider).toBe(false);
    }
  });

  it("hugs walls when wall-following succeeds", () => {
    const plan = makePlan();
    const grid = rasterizeFloorPlan(plan, { cellSize: 0.1, clearance: 0.3 });
    const load: Point = { x: 9.5, y: 7.5 };

    const route = routeWire(panel, load, "load-2", grid);

    expect(route.fallback).toBe(false);

    // Most of the wire's LENGTH should lie in the near-wall band
    // (sample along segments — compressed waypoints are just corners).
    const samples: Point[] = [];

    for (let i = 1; i < route.points.length; i++) {
      const from = route.points[i - 1];
      const to = route.points[i];
      const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(1, Math.ceil(segmentLength / 0.1));

      for (let step = 0; step < steps; step++) {
        const t = step / steps;

        samples.push({
          x: from.x + t * (to.x - from.x),
          y: from.y + t * (to.y - from.y),
        });
      }
    }

    const bandHits = samples.filter((point) => {
      const cell = toCell(point, grid);

      return grid.nearWall[cell.row][cell.col];
    });

    expect(bandHits.length / samples.length).toBeGreaterThan(0.5);
  });

  it("computes plausible wire length", () => {
    const plan = makePlan();
    const grid = rasterizeFloorPlan(plan, { cellSize: 0.1 });
    const load: Point = { x: 9, y: 7 };

    const route = routeWire(panel, load, "load-3", grid);
    const manhattan =
      Math.abs(load.x - panel.x) + Math.abs(load.y - panel.y);

    // Orthogonal wall-hugging route should be at least the straight line
    // and not wildly longer than a perimeter run.
    expect(route.lengthM).toBeGreaterThanOrEqual(
      Math.hypot(load.x - panel.x, load.y - panel.y)
    );
    expect(route.lengthM).toBeLessThanOrEqual(manhattan * 2.5);
  });

  it("snaps endpoints that fall inside a wall to the nearest open cell", () => {
    const plan = makePlan();
    const grid = rasterizeFloorPlan(plan, { cellSize: 0.1 });
    // Load exactly on the interior divider.
    const load: Point = { x: 5, y: 4 };

    const route = routeWire(panel, load, "load-4", grid);

    expect(route.points.length).toBeGreaterThan(1);
    expect(route.lengthM).toBeGreaterThan(0);
  });
});
