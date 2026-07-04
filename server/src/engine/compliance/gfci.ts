/**
 * GFCI protection check: receptacle outlets in wet/hazard areas
 * (bathroom, kitchen, garage, laundry, outdoor) must be GFCI-protected.
 *
 * PEC-VERIFY: the room-type list and rule text follow the familiar
 * NEC 210.8 pattern; the exact PEC section and its scope must be
 * confirmed by a licensed EE.
 */
import { ElectricalLoad, Room, RoomType, Violation } from "../types.js";

export const GFCI_ROOM_TYPES: RoomType[] = [
  "bathroom",
  "kitchen",
  "garage",
  "laundry",
  "outdoor",
];

export function checkGfci(rooms: Room[], loads: ElectricalLoad[]): Violation[] {
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const violations: Violation[] = [];

  for (const load of loads) {
    if (load.type !== "outlet" || load.gfci) continue;
    const room = load.roomId ? roomById.get(load.roomId) : undefined;

    if (room && GFCI_ROOM_TYPES.includes(room.type)) {
      violations.push({
        ruleId: "gfci-required",
        severity: "error",
        message:
          `Outlet "${load.name}" in ${room.name} (${room.type}) must be ` +
          `GFCI-protected`,
        pecReference: "PEC GFCI requirement (section pending verification)",
      });
    }
  }

  return violations;
}
