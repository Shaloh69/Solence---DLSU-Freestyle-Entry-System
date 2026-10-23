/**
 * Switch auto-placement (W5, WIRING-AUDIT F-12).
 *
 *   lighting group = switched fixtures of one room on one circuit
 *   one entrance door    → 1-way switch at its latch side
 *   two+ entrance doors  → 2-way pair at the first entrance (outside
 *                          first, then circulation) and the entrance
 *                          farthest from it
 *   no entrance          → 1-way at the room's first door, or inside the
 *                          room on the wall nearest the panel if it has none
 *
 * Latch side: plans carry no hinge, so the hinge is assumed on the jamb
 * nearer a room corner (the leaf then folds back against the corner
 * wall) and the switch goes on the other jamb. Egress fixtures stay
 * unswitched. Three or more entrances still get one 2-way pair
 * (intermediate switching is not modelled).
 */
import type {
  Circuit,
  ElectricalLoad,
  FloorPlan,
  LightingGroup,
  Point,
  Room,
  SwitchDevice,
} from "../types.js";
import { pointInPolygon, polygonCentroid } from "../geometry.js";
import { onWall, RoomDoor, roomDoors, wallFrame } from "./doors.js";
import { SWITCH_FROM_JAMB_M, SWITCH_MOUNTING_HEIGHT_M, SWITCH_WALL_INSET_M } from "./switch-data.js";

export interface SwitchPlan {
  /** boxLoadId is provisional here; topology picks the box once the tree exists. */
  groups: LightingGroup[];
  switches: SwitchDevice[];
}

interface Spot {
  position: Point;
  doorId?: string;
}

export function isSwitchedFixture(load: ElectricalLoad): boolean {
  return load.type === "lighting" && !load.egress;
}

export function placeSwitches(
  plan: FloorPlan,
  loads: ElectricalLoad[],
  circuits: Circuit[],
  panelPosition: Point
): SwitchPlan {
  const loadById = new Map(loads.map((l) => [l.id, l]));
  const roomById = new Map(plan.rooms.map((r) => [r.id, r]));
  const doors = roomDoors(plan);
  const spotsByRoom = new Map<string, Spot[]>();
  const groups: LightingGroup[] = [];
  const switches: SwitchDevice[] = [];

  for (const circuit of circuits) {
    const byRoom = new Map<string, string[]>();

    for (const id of circuit.loadIds) {
      const load = loadById.get(id);

      if (!load || !isSwitchedFixture(load)) continue;
      const roomId = load.roomId ?? plan.rooms.find((r) => pointInPolygon(load.position, r.boundary))?.id ?? "";

      byRoom.set(roomId, [...(byRoom.get(roomId) ?? []), id]);
    }

    for (const [roomId, loadIds] of byRoom) {
      const room = roomById.get(roomId);
      const key = `${circuit.id}-${roomId || "none"}`;
      const groupId = `lg-${key}`;
      let spots = room ? spotsByRoom.get(room.id) : undefined;

      if (!spots) {
        spots = room
          ? switchSpots(room, doors.get(room.id) ?? [], panelPosition)
          : [{ position: loadById.get(loadIds[0])!.position }];
        if (room) spotsByRoom.set(room.id, spots);
      }
      const twoWay = spots.length === 2;
      const ids = twoWay ? [`sw-${key}-a`, `sw-${key}-b`] : [`sw-${key}`];

      spots.forEach((spot, i) =>
        switches.push({
          id: ids[i],
          groupId,
          circuitId: circuit.id,
          roomId: room?.id,
          kind: twoWay ? "2-way" : "1-way",
          position: spot.position,
          mountingHeightM: SWITCH_MOUNTING_HEIGHT_M,
          ...(spot.doorId ? { doorId: spot.doorId } : {}),
          ...(twoWay ? { pairedSwitchId: ids[1 - i] } : {}),
        })
      );
      groups.push({
        id: groupId,
        circuitId: circuit.id,
        roomId: room?.id,
        loadIds,
        switchIds: ids,
        boxLoadId: loadIds[0],
      });
    }
  }

  return { groups, switches };
}

const byPriority = (a: RoomDoor, b: RoomDoor) =>
  a.otherRank - b.otherRank || b.door.width - a.door.width || a.doorId.localeCompare(b.doorId);

function doorMid(d: RoomDoor): Point {
  return onWall(wallFrame(d.wall), d.door.offset + d.door.width / 2, 0);
}

function switchSpots(room: Room, doors: RoomDoor[], panelPosition: Point): Spot[] {
  const entrances = doors.filter((d) => d.entrance).sort(byPriority);

  if (entrances.length >= 2) {
    const first = entrances[0];
    const m = doorMid(first);
    const second = entrances
      .slice(1)
      .reduce((best, d) => (dist(doorMid(d), m) > dist(doorMid(best), m) ? d : best));

    return [besideDoor(room, first, panelPosition), besideDoor(room, second, panelPosition)];
  }
  if (entrances.length === 1) return [besideDoor(room, entrances[0], panelPosition)];
  if (doors.length > 0) return [besideDoor(room, [...doors].sort(byPriority)[0], panelPosition)];

  return [{ position: insideNear(room, panelPosition) }];
}

/** Switch point beside a door on its latch side, on the room's wall face. */
function besideDoor(room: Room, rd: RoomDoor, panelPosition: Point): Spot {
  const f = wallFrame(rd.wall);
  const face = f.thickness / 2 + SWITCH_WALL_INSET_M;
  const jambs = [rd.door.offset, rd.door.offset + rd.door.width];
  // Free wall beside a jamb: distance from it to the nearest room corner.
  const clearance = (along: number) => {
    const p = onWall(f, along, rd.side * face);

    return Math.min(...room.boundary.map((v) => dist(v, p)));
  };
  const latch = clearance(jambs[1]) >= clearance(jambs[0]) ? 1 : 0;

  for (const jamb of [latch, 1 - latch]) {
    const dir = jamb === 1 ? 1 : -1;

    // Full clearance first; a door that fills its alcove leaves only the
    // return wall right at the jamb.
    for (const along of [SWITCH_FROM_JAMB_M, SWITCH_FROM_JAMB_M / 2, 0.02]) {
      for (const depth of [face, face + 0.1, face + 0.25, face + 0.4]) {
        const p = onWall(f, jambs[jamb] + dir * along, rd.side * depth);

        if (pointInPolygon(p, room.boundary)) return { position: p, doorId: rd.doorId };
      }
    }
  }

  return { position: insideNear(room, panelPosition) };
}

/** A point just inside the room, on the wall nearest `target`. */
function insideNear(room: Room, target: Point): Point {
  const b = room.boundary;
  let best = { p: b[0], a: b[0], c: b[1 % b.length], d: Infinity };

  for (let i = 0; i < b.length; i++) {
    const a = b[i];
    const c = b[(i + 1) % b.length];
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((target.x - a.x) * dx + (target.y - a.y) * dy) / len2));
    const p = { x: a.x + dx * t, y: a.y + dy * t };
    const d = dist(p, target);

    if (d < best.d) best = { p, a, c, d };
  }
  const len = dist(best.a, best.c) || 1;
  const n = { x: -(best.c.y - best.a.y) / len, y: (best.c.x - best.a.x) / len };

  for (const depth of [0.1, 0.2, 0.4]) {
    for (const s of [1, -1]) {
      const p = { x: best.p.x + n.x * depth * s, y: best.p.y + n.y * depth * s };

      if (pointInPolygon(p, b)) return p;
    }
  }

  return polygonCentroid(b);
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
