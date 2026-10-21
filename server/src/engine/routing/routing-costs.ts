/**
 * Router cost model — DESIGN-PRACTICE ASSUMPTIONS, not PEC values.
 * ======================== DESIGN-VERIFY ========================
 * These weights describe how a Philippine residential job is usually
 * run: concealed PVC conduit in the ceiling space / slab, kept along
 * walls where it can be supported, dropped down a wall to each device,
 * passing through a wall where that saves a long detour. A licensed EE
 * should tune them against real installations. Units: meters of
 * equivalent conduit (cost per meter travelled, plus fixed penalties).
 * ===============================================================
 */

/** Per meter in the band along a wall (preferred, supported run). */
export const COST_ALONG_WALL = 1.0;

/** Per meter across open ceiling (e.g. to a center downlight). */
export const COST_OPEN_CEILING = 1.2;

/** Per meter inside a wall body — crossing it is fine, running along inside it is not. */
export const COST_INSIDE_WALL = 2.0;

/** Per meter outside the building footprint (wire leaving the house). */
export const COST_OUTSIDE = 4.0;

/** Fixed cost of each wall penetration (sleeve, hole, labor), meters-equivalent. */
export const COST_WALL_PENETRATION = 1.5;

/** Fixed cost of each change of direction (a conduit bend/pull point). */
export const COST_BEND = 0.25;

/** How far (m) to look for an open cell inside the device's own room when snapping. */
export const ROOM_SNAP_RADIUS_M = 1.0;

/**
 * Room polygons usually stop at the wall face, leaving thin slivers
 * between rooms and wall bodies. The footprint is grown by this much so
 * those slivers don't count as "outside the house".
 */
export const FOOTPRINT_TOLERANCE_M = 0.2;
