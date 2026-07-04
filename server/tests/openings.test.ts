import { describe, it, expect } from "vitest";
import { rasterizeFloorPlan, toCell, routeWire } from "../src/engine/routing/index.js";
import { FloorPlan } from "../src/engine/types.js";

/**
 * Two rooms fully separated by an interior wall spanning the plan,
 * with a door in the middle of that wall.
 */
function planWithDoor(kind: "door" | "window" | "none"): FloorPlan {
  return {
    width: 10,
    height: 8,
    walls: [
      { id: "n", start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
      { id: "e", start: { x: 10, y: 0 }, end: { x: 10, y: 8 } },
      { id: "s", start: { x: 10, y: 8 }, end: { x: 0, y: 8 } },
      { id: "w", start: { x: 0, y: 8 }, end: { x: 0, y: 0 } },
      { id: "divider", start: { x: 5, y: 0 }, end: { x: 5, y: 8 } },
    ],
    rooms: [],
    openings:
      kind === "none"
        ? []
        : [{ id: "op1", wallId: "divider", offset: 3.5, width: 0.9, kind }],
  };
}

describe("rasterizer openings", () => {
  it("keeps a solid divider blocked without an opening", () => {
    const grid = rasterizeFloorPlan(planWithDoor("none"), { cellSize: 0.1 });
    const onDoorSpot = toCell({ x: 5, y: 4 }, grid);

    expect(grid.blocked[onDoorSpot.row][onDoorSpot.col]).toBe(true);
  });

  it("opens a routable gap where a door is placed", () => {
    const grid = rasterizeFloorPlan(planWithDoor("door"), { cellSize: 0.1 });
    const inDoorway = toCell({ x: 5, y: 3.95 }, grid);
    const solidPart = toCell({ x: 5, y: 1 }, grid);

    expect(grid.blocked[inDoorway.row][inDoorway.col]).toBe(false);
    expect(grid.blocked[solidPart.row][solidPart.col]).toBe(true);
  });

  it("keeps windows blocked for routing", () => {
    const grid = rasterizeFloorPlan(planWithDoor("window"), { cellSize: 0.1 });
    const atWindow = toCell({ x: 5, y: 3.95 }, grid);

    expect(grid.blocked[atWindow.row][atWindow.col]).toBe(true);
  });

  it("routes through the door instead of failing on a sealed room", () => {
    const sealed = rasterizeFloorPlan(planWithDoor("none"), { cellSize: 0.1 });

    expect(() =>
      routeWire({ x: 1, y: 1 }, { x: 9, y: 7 }, "load-x", sealed)
    ).toThrow();

    const withDoor = rasterizeFloorPlan(planWithDoor("door"), {
      cellSize: 0.1,
    });
    const route = routeWire({ x: 1, y: 1 }, { x: 9, y: 7 }, "load-x", withDoor);

    expect(route.lengthM).toBeGreaterThan(0);
    // The route must pass near the doorway (x≈5, y between 3.5 and 4.4).
    const nearDoor = route.points.some(
      (point) =>
        Math.abs(point.x - 5) < 0.6 && point.y > 3.2 && point.y < 4.8
    );

    expect(nearDoor).toBe(true);
  });
});
