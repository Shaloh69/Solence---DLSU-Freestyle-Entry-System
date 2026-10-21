/**
 * Receptacle spacing (PEC 2017 2.10.3.3(A)(1)): in habitable rooms no
 * point along the wall line may be more than 1.8 m from a receptacle.
 *
 * Simplification (flagged in pec-overcurrent.ts): measured along the
 * room's perimeter with doorways not excluded, so it is conservative —
 * it can ask for an outlet the code would not.
 */
import { ElectricalLoad, Point, Room, Violation } from "../types.js";
import {
  RECEPTACLE_MAX_DISTANCE_M,
  RECEPTACLE_SPACING_REF,
  RECEPTACLE_SPACING_ROOM_TYPES,
} from "../sizing/pec-overcurrent.js";

/** Arc-length position of the perimeter point nearest to `p`. */
function perimeterParam(p: Point, boundary: Point[]): number {
  let best = Infinity;
  let bestS = 0;
  let walked = 0;

  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i];
    const b = boundary[(i + 1) % boundary.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len))) : 0;
    const d = Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);

    if (d < best) {
      best = d;
      bestS = walked + t * len;
    }
    walked += len;
  }

  return bestS;
}

function perimeterLength(boundary: Point[]): number {
  return boundary.reduce((sum, a, i) => {
    const b = boundary[(i + 1) % boundary.length];

    return sum + Math.hypot(b.x - a.x, b.y - a.y);
  }, 0);
}

export function checkReceptacleSpacing(rooms: Room[], loads: ElectricalLoad[]): Violation[] {
  const violations: Violation[] = [];

  for (const room of rooms) {
    if (!(RECEPTACLE_SPACING_ROOM_TYPES as readonly string[]).includes(room.type)) continue;
    const total = perimeterLength(room.boundary);
    const positions = loads
      .filter((load) => load.type === "outlet" && load.roomId === room.id)
      .map((load) => perimeterParam(load.position, room.boundary))
      .sort((a, b) => a - b);

    let largestGap: number;

    if (positions.length === 0) largestGap = total;
    else {
      largestGap = total - positions[positions.length - 1] + positions[0];
      for (let i = 1; i < positions.length; i++) {
        largestGap = Math.max(largestGap, positions[i] - positions[i - 1]);
      }
    }

    // A gap of 2 × 1.8 m leaves its midpoint exactly 1.8 m from both outlets.
    if (largestGap > 2 * RECEPTACLE_MAX_DISTANCE_M + 1e-6) {
      violations.push({
        ruleId: "receptacle-spacing",
        severity: "warning",
        message:
          `${room.name}: ${largestGap.toFixed(1)} m of wall between receptacles — ` +
          `some point is more than ${RECEPTACLE_MAX_DISTANCE_M} m from an outlet`,
        pecReference: RECEPTACLE_SPACING_REF,
      });
    }
  }

  return violations;
}
