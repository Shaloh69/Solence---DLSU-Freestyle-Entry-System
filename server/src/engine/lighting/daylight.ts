/**
 * Simplified Daylight Factor per room (§9.1a).
 *
 * DF ≈ Σ(window glass area × glazing visible transmittance) / floor area
 *
 * This is deliberately the simple ratio form, NOT the split-flux
 * radiative method real daylighting tools compute — an approximation
 * for design guidance, documented as such wherever it surfaces.
 *
 * HARD CONSTRAINT (§9.1a): the DF result is advisory only. It feeds a
 * "this room gets good natural light" indicator and Showcase Mode's
 * day/night visualization — it must NEVER reduce the code-required
 * fixture count, which is always computed for the night/worst case.
 * Nothing in this module is imported by the fixture-count solve, and a
 * regression test locks that invariant.
 */
import { Opening, Point, Room, Wall } from "../types.js";
import { polygonArea } from "../geometry.js";
import {
  DAYLIGHT_FACTOR_GOOD,
  DEFAULT_GLAZING_VT,
  WINDOW_GLASS_HEIGHT_M,
} from "./lighting-data.js";

export interface RoomDaylight {
  roomId: string;
  /** Simplified Daylight Factor, 0..1 (0.02 = the "well daylit" mark). */
  daylightFactor: number;
  /** DF at or above the conventional 2% reference. */
  wellDaylit: boolean;
  windowCount: number;
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq
    )
  );

  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

/** Distance from a point to the nearest edge of a room polygon. */
function distanceToBoundary(point: Point, boundary: Point[]): number {
  let best = Infinity;

  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    best = Math.min(best, distanceToSegment(point, boundary[j], boundary[i]));
  }

  return best;
}

/**
 * Attribute each window to the room(s) whose boundary its midpoint sits
 * on (within the wall thickness plus a small tolerance) — a window in a
 * party wall between two rooms daylights the exterior-facing one in
 * reality, but without exterior/interior wall labeling both candidates
 * receive it; acceptable for an advisory figure.
 */
export function roomDaylightFactors(
  rooms: Room[],
  walls: Wall[],
  openings: Opening[],
  glazingVt: number = DEFAULT_GLAZING_VT
): RoomDaylight[] {
  const wallById = new Map(walls.map((wall) => [wall.id, wall]));
  const windows = openings.filter((opening) => opening.kind === "window");

  return rooms.map((room) => {
    const area = polygonArea(room.boundary);
    let glassArea = 0;
    let windowCount = 0;

    for (const window of windows) {
      const wall = wallById.get(window.wallId);

      if (!wall) continue;
      const length = Math.hypot(
        wall.end.x - wall.start.x,
        wall.end.y - wall.start.y
      );

      if (length === 0) continue;
      const mid = window.offset + window.width / 2;
      const midpoint = {
        x: wall.start.x + ((wall.end.x - wall.start.x) * mid) / length,
        y: wall.start.y + ((wall.end.y - wall.start.y) * mid) / length,
      };
      const tolerance = (wall.thickness ?? 0.15) / 2 + 0.25;

      if (distanceToBoundary(midpoint, room.boundary) <= tolerance) {
        glassArea += window.width * WINDOW_GLASS_HEIGHT_M * glazingVt;
        windowCount++;
      }
    }

    const daylightFactor = area > 0 ? glassArea / area : 0;

    return {
      roomId: room.id,
      daylightFactor: Math.round(daylightFactor * 10000) / 10000,
      wellDaylit: daylightFactor >= DAYLIGHT_FACTOR_GOOD,
      windowCount,
    };
  });
}
