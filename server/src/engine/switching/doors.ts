/**
 * Which doors belong to which room, which side of the wall the room is
 * on, and which of a room's doors are its entrances (W5).
 */
import type { FloorPlan, Opening, Point, Room, Wall } from "../types.js";
import { distanceToSegment, pointInPolygon, polygonCentroid, wallLength } from "../geometry.js";
import { CIRCULATION_RANK, EXTERIOR_RANK, ROOM_PUBLIC_RANK } from "./switch-data.js";

export interface RoomDoor {
  doorId: string;
  door: Opening;
  wall: Wall;
  /** +1 when the room is on the side of the wall's left normal (-uy, ux), else -1. */
  side: 1 | -1;
  /** Room on the other side of the door; null = outside the house. */
  otherRoomId: string | null;
  /** True when the door is a way into the room (see ROOM_PUBLIC_RANK). */
  entrance: boolean;
  /** Public rank of the space on the other side (lower = more public). */
  otherRank: number;
}

const DEFAULT_THICKNESS = 0.15;
/** How far past the wall face to probe for the room on each side, meters. */
const PROBES = [0.1, 0.25, 0.45];

export interface WallFrame {
  start: Point;
  /** Unit vector along the wall. */
  u: Point;
  /** Unit left normal (-uy, ux). */
  n: Point;
  thickness: number;
}

export function wallFrame(wall: Wall): WallFrame {
  const len = wallLength(wall) || 1;
  const u = { x: (wall.end.x - wall.start.x) / len, y: (wall.end.y - wall.start.y) / len };

  return { start: wall.start, u, n: { x: -u.y, y: u.x }, thickness: wall.thickness ?? DEFAULT_THICKNESS };
}

/** Point `along` meters down the wall and `off` meters along its left normal. */
export function onWall(f: WallFrame, along: number, off: number): Point {
  return { x: f.start.x + f.u.x * along + f.n.x * off, y: f.start.y + f.u.y * along + f.n.y * off };
}

function boundaryDistance(p: Point, room: Room): number {
  let best = Infinity;

  for (let i = 0; i < room.boundary.length; i++) {
    best = Math.min(best, distanceToSegment(p, room.boundary[i], room.boundary[(i + 1) % room.boundary.length]));
  }

  return best;
}

/** Doors of every room, keyed by room id. */
export function roomDoors(plan: FloorPlan): Map<string, RoomDoor[]> {
  const walls = new Map(plan.walls.map((w) => [w.id, w]));
  const out = new Map<string, RoomDoor[]>(plan.rooms.map((r) => [r.id, []]));
  const roomById = new Map(plan.rooms.map((r) => [r.id, r]));

  for (const door of plan.openings ?? []) {
    if (door.kind !== "door") continue;
    const wall = walls.get(door.wallId);

    if (!wall) continue;
    const f = wallFrame(wall);
    const mid = door.offset + door.width / 2;
    const roomOn = (side: 1 | -1): Room | undefined => {
      for (const d of PROBES) {
        const p = onWall(f, mid, side * (f.thickness / 2 + d));
        const room = plan.rooms.find((r) => pointInPolygon(p, r.boundary));

        if (room) return room;
      }

      return undefined;
    };
    const sides = new Map<string, 1 | -1>();
    const left = roomOn(1);
    const right = roomOn(-1);

    if (left) sides.set(left.id, 1);
    if (right && !sides.has(right.id)) sides.set(right.id, -1);

    // Rooms whose outline touches the door but whose interior the probes
    // missed (notches, slivers): side from where the room's center lies.
    const m = onWall(f, mid, 0);

    for (const room of plan.rooms) {
      if (sides.has(room.id) || boundaryDistance(m, room) > f.thickness / 2 + 0.1) continue;
      const c = polygonCentroid(room.boundary);

      sides.set(room.id, (c.x - m.x) * f.n.x + (c.y - m.y) * f.n.y >= 0 ? 1 : -1);
    }

    for (const [roomId, side] of sides) {
      const other = [...sides].find(([id, s]) => id !== roomId && s !== side)?.[0] ?? null;
      const rank = ROOM_PUBLIC_RANK[roomById.get(roomId)!.type];
      const otherRank = other ? ROOM_PUBLIC_RANK[roomById.get(other)!.type] : EXTERIOR_RANK;
      const entrance = otherRank < rank || (rank === CIRCULATION_RANK && otherRank === CIRCULATION_RANK);

      out.get(roomId)!.push({ doorId: door.id, door, wall, side, otherRoomId: other, entrance, otherRank });
    }
  }

  return out;
}
