/**
 * Real-plan corpus for engine tests (CLAUDE.md §3).
 *
 * Plans come from ResPlan (CC BY 4.0), converted by
 * scripts/resplan/convert_resplan.py into test-assets/plans/resplan/.
 * The helper never falls back to a toy plan: a missing corpus throws.
 *
 * `fitOut` places a typical Philippine residential load set so the
 * engine has real work to do. It is deliberately simple and
 * deterministic; it is test scaffolding, not the product's placement
 * logic (that belongs in the engine — see docs/WIRING-AUDIT.md F-12).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { autoPlaceLighting } from "../../src/engine/lighting/index.js";
import {
  polygonArea,
  polygonCentroid,
  pointInPolygon,
} from "../../src/engine/geometry.js";
import type {
  ElectricalLoad,
  FloorPlan,
  Panel,
  Point,
  Room,
  VoltageSystem,
} from "../../src/engine/types.js";

const CORPUS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../test-assets/plans/resplan"
);

export interface RealPlan {
  id: string;
  bedroomBucket: string;
  floorPlan: FloorPlan;
  meta: Record<string, unknown>;
}

export function loadRealPlans(): RealPlan[] {
  const indexPath = join(CORPUS, "INDEX.json");

  if (!existsSync(indexPath)) {
    throw new Error(
      `Real-plan corpus missing at ${indexPath}. Regenerate with scripts/resplan/convert_resplan.py.`
    );
  }
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as {
    plans: { file: string; bedroomBucket: string }[];
  };

  if (index.plans.length === 0) throw new Error("Real-plan corpus is empty");

  return index.plans.map((entry) => {
    const raw = JSON.parse(readFileSync(join(CORPUS, entry.file), "utf8"));

    return {
      id: entry.file.replace(/\.json$/, ""),
      bedroomBucket: entry.bedroomBucket,
      floorPlan: raw.floorPlan as FloorPlan,
      meta: raw.meta,
    };
  });
}

/** Point `inset` meters from boundary point `p`, toward the room centroid. */
function inset(p: Point, room: Room, distance: number): Point {
  const c = polygonCentroid(room.boundary);
  const len = Math.hypot(c.x - p.x, c.y - p.y) || 1;
  const q = {
    x: p.x + ((c.x - p.x) / len) * distance,
    y: p.y + ((c.y - p.y) / len) * distance,
  };

  return pointInPolygon(q, room.boundary) ? q : c;
}

/**
 * Evenly spaced points along a room's perimeter, each pushed `depth`
 * meters off the wall along the edge's inward normal (works for L-shaped
 * and other non-convex rooms, where "toward the centroid" can leave the room).
 */
function perimeterPoints(room: Room, count: number, depth = 0.05): Point[] {
  const pts = room.boundary;
  const segs = pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];

    return { a, b, len: Math.hypot(b.x - a.x, b.y - a.y) };
  });
  const total = segs.reduce((s, x) => s + x.len, 0);
  const out: Point[] = [];

  for (let k = 0; k < count; k++) {
    let target = ((k + 0.5) / count) * total;

    for (const s of segs) {
      if (target <= s.len && s.len > 0) {
        const t = target / s.len;
        const p = { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
        const nx = -(s.b.y - s.a.y) / s.len;
        const ny = (s.b.x - s.a.x) / s.len;
        const left = { x: p.x + nx * depth, y: p.y + ny * depth };
        const right = { x: p.x - nx * depth, y: p.y - ny * depth };

        out.push(
          pointInPolygon(left, room.boundary)
            ? left
            : pointInPolygon(right, room.boundary)
              ? right
              : inset(p, room, depth)
        );
        break;
      }
      target -= s.len;
    }
  }

  return out;
}

function perimeter(room: Room): number {
  return room.boundary.reduce((sum, a, i) => {
    const b = room.boundary[(i + 1) % room.boundary.length];

    return sum + Math.hypot(b.x - a.x, b.y - a.y);
  }, 0);
}

export interface FitOut {
  panel: Panel;
  loads: ElectricalLoad[];
}

/**
 * Typical PH house fit-out:
 *  - lighting per room via the engine's lumen-method auto-placement
 *  - general receptacles flush on the wall face, every 3.6 m of wall
 *    (PEC 2.10.3.3(a)(1): no
 *    point more than 1.8 m from an outlet), 180 VA each
 *  - GFCI receptacles in bathrooms, kitchen counters, balconies
 *  - refrigerator (kitchen), split-type A/C per bedroom, water heater
 *    per bathroom — each a dedicated circuit
 *  - panel in the living room, on the wall nearest the kitchen
 */
export function fitOut(
  plan: FloorPlan,
  options: { system: VoltageSystem; voltage: number }
): FitOut {
  const { voltage } = options;
  const rooms = plan.rooms;
  const living = rooms.find((r) => r.type === "living");
  const kitchen = rooms.find((r) => r.type === "kitchen");

  if (!living || !kitchen) throw new Error("plan has no living room or kitchen");

  const kc = polygonCentroid(kitchen.boundary);
  const nearest = living.boundary.reduce((best, p) =>
    Math.hypot(p.x - kc.x, p.y - kc.y) < Math.hypot(best.x - kc.x, best.y - kc.y)
      ? p
      : best
  );
  const panel: Panel = {
    id: "lp-1",
    name: "LP-1",
    position: inset(nearest, living, 0.3),
    system: options.system,
    mainBreakerAmps: 0,
  };

  const loads: ElectricalLoad[] = [];
  const add = (load: Omit<ElectricalLoad, "voltage">) =>
    loads.push({ ...load, voltage });

  for (const room of rooms) {
    if (polygonArea(room.boundary) < 1.5) continue;

    for (const fixture of autoPlaceLighting(room, {
      ceilingHeight: plan.ceilingHeight,
      fixture: { label: "LED Downlight 12W", lumens: 1200, va: 12, voltage },
    }).loads) {
      loads.push({ ...fixture, voltage, continuous: true });
    }

    const wet = ["bathroom", "outdoor"].includes(room.type);
    const outletCount = wet ? 1 : Math.max(1, Math.ceil(perimeter(room) / 3.6));

    perimeterPoints(room, outletCount).forEach((position, i) =>
      add({
        id: `o-${room.id}-${i + 1}`,
        name: `Outlet ${room.name} ${i + 1}`,
        type: "outlet",
        va: 180,
        continuous: false,
        position,
        roomId: room.id,
        gfci: wet || room.type === "kitchen",
      })
    );

    const c = polygonCentroid(room.boundary);
    const centre = pointInPolygon(c, room.boundary) ? c : inset(room.boundary[0], room, 0.6);

    if (room.type === "kitchen") {
      add({ id: `fridge-${room.id}`, name: "Refrigerator", type: "appliance", va: 1200, continuous: false, position: inset(room.boundary[0], room, 0.4), roomId: room.id });
    }
    if (room.type === "bedroom") {
      add({ id: `ac-${room.id}`, name: `A/C ${room.name}`, type: "hvac", va: 1800, continuous: true, position: inset(room.boundary[1 % room.boundary.length], room, 0.3), roomId: room.id });
    }
    if (room.type === "bathroom") {
      add({ id: `wh-${room.id}`, name: `Water heater ${room.name}`, type: "appliance", va: 3500, continuous: false, position: centre, roomId: room.id });
    }
  }

  return { panel, loads };
}
