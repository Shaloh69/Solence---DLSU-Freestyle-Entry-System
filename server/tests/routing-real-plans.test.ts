/**
 * W1b — routing model on real plans (ResPlan corpus).
 *
 * Before W1b the router could only cross walls at doors: on ResPlan 8
 * the kitchen and part of the hall (11 loads) were "unreachable", and
 * devices sitting in a wall were fed through it from whichever side was
 * nearest. These tests pin the concealed-conduit model instead.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { simulate } from "../src/engine/simulate.js";
import { rasterizeFloorPlan, toCell } from "../src/engine/routing/index.js";
import { pointInPolygon, polygonCentroid } from "../src/engine/geometry.js";
import type { ElectricalLoad, Point, RoutedPath } from "../src/engine/types.js";
import { fitOut, loadRealPlans } from "./helpers/real-plans.js";

const limits = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "thresholds.json"), "utf8")
) as { simulateMsPerPlanMax: number; maxPenetrationsPerRoute: number };

const plans = loadRealPlans();

/** Contiguous runs (meters) of the route's middle that lie inside a wall body. */
function wallRuns(route: RoutedPath, blocked: (p: Point) => boolean): number[] {
  const runs: number[] = [];
  let current = 0;
  // Skip the first and last segment: those are the drops into the device boxes.
  const middle = route.points.slice(1, -1);

  for (let i = 1; i < middle.length; i++) {
    const a = middle[i - 1];
    const b = middle[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.round(len / 0.05));

    for (let s = 0; s < steps; s++) {
      const p = { x: a.x + ((b.x - a.x) * (s + 0.5)) / steps, y: a.y + ((b.y - a.y) * (s + 0.5)) / steps };

      if (blocked(p)) current += len / steps;
      else if (current > 0) {
        runs.push(current);
        current = 0;
      }
    }
  }
  if (current > 0) runs.push(current);

  return runs;
}

describe.each(plans.map((p) => [p.id, p] as const))("routing on %s", (_id, plan) => {
  const { panel, loads } = fitOut(plan.floorPlan, { system: "1P3W-120/240", voltage: 230 });
  const t0 = performance.now();
  const result = simulate({ floorPlan: plan.floorPlan, panel, loads });
  const elapsed = performance.now() - t0;
  const grid = rasterizeFloorPlan(plan.floorPlan);
  const blocked = (p: Point) => {
    const c = toCell(p, grid);

    return grid.blocked[c.row][c.col];
  };
  const maxWall = Math.max(...plan.floorPlan.walls.map((w) => w.thickness ?? 0.15));
  const roomOf = new Map(plan.floorPlan.rooms.map((r) => [r.id, r]));
  const loadById = new Map(loads.map((l) => [l.id, l]));

  it("reaches every load", () => {
    expect(result.routingErrors).toEqual([]);
    expect(result.routes).toHaveLength(loads.length);
  });

  it("crosses walls only as counted penetrations, never along a wall", () => {
    for (const route of result.routes) {
      const runs = wallRuns(route, blocked);

      expect(runs.length, route.loadId).toBe(route.penetrations);
      for (const run of runs) {
        expect(run, `${route.loadId} runs ${run.toFixed(2)} m inside a wall`).toBeLessThanOrEqual(
          2 * maxWall + 2 * grid.cellSize
        );
      }
      expect(route.penetrations ?? 0).toBeLessThanOrEqual(limits.maxPenetrationsPerRoute);
    }
  });

  it("leaves the house only to reach an outdoor room", () => {
    for (const route of result.routes.filter((r) => r.fallback)) {
      const load = loadById.get(route.loadId)!;

      expect(roomOf.get(load.roomId ?? "")?.type, route.loadId).toBe("outdoor");
    }
  });

  it("feeds a device flush-mounted in a wall from its own room's side", () => {
    const bedroom = plan.floorPlan.rooms.find((r) => r.type === "bedroom")!;
    const c = polygonCentroid(bedroom.boundary);
    const [a, b] = [bedroom.boundary[0], bedroom.boundary[1]];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const len = Math.hypot(mid.x - c.x, mid.y - c.y) || 1;
    // 8 cm outward from the room face: inside the wall body.
    const inWall = { x: mid.x - ((c.x - mid.x) / len) * 0.08, y: mid.y - ((c.y - mid.y) / len) * 0.08 };
    const flush: ElectricalLoad = {
      id: "flush-outlet",
      name: "Flush outlet",
      type: "outlet",
      va: 180,
      voltage: 230,
      continuous: false,
      position: inWall,
      roomId: bedroom.id,
    };
    const r = simulate({ floorPlan: plan.floorPlan, panel, loads: [flush] });
    const route = r.routes[0];
    const boxSide = route.points[route.points.length - 2];

    expect(pointInPolygon(boxSide, bedroom.boundary)).toBe(true);
  });

  it("simulates within the time budget", () => {
    expect(elapsed).toBeLessThanOrEqual(limits.simulateMsPerPlanMax);
  });
});
