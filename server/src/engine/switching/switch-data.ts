/**
 * Switch placement — DESIGN-PRACTICE ASSUMPTIONS, not PEC values.
 * ======================== DESIGN-VERIFY ========================
 * How a Philippine residential lighting layout usually places wall
 * switches: beside the door on the latch side, so it is reachable as
 * the door opens. A licensed EE / architect should confirm these for
 * the project (accessibility rules may lower the height).
 * ===============================================================
 */
import type { RoomType } from "../types.js";

/** Switch center above finished floor, meters (common range 1.2–1.4 m). */
export const SWITCH_MOUNTING_HEIGHT_M = 1.3;

/** Switch center measured along the wall from the latch-side jamb, meters. */
export const SWITCH_FROM_JAMB_M = 0.15;

/** How far past the wall face the switch point sits (inside the room), meters. */
export const SWITCH_WALL_INSET_M = 0.05;

/**
 * How public a room is, for deciding which doors are a room's entrances
 * (0 = outside the house). A door is an entrance of room R when the space
 * on its other side is more public than R — or, for circulation spaces,
 * equally public (living ↔ hall). So a bedroom's door to its own bathroom
 * is not a bedroom entrance, but it is the bathroom's.
 */
export const EXTERIOR_RANK = 0;
export const ROOM_PUBLIC_RANK: Record<RoomType, number> = {
  living: 1,
  dining: 1,
  kitchen: 1,
  hallway: 1,
  garage: 1,
  other: 1,
  bedroom: 2,
  office: 2,
  laundry: 2,
  outdoor: 2,
  bathroom: 3,
};
export const CIRCULATION_RANK = 1;
