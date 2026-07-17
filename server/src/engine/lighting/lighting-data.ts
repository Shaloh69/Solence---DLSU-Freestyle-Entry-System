/**
 * Photometric design data for the lighting layer.
 *
 * =========================== LIGHTING-VERIFY ===========================
 * Target illuminance values follow the general shape of IES recommended
 * practice for residential/commercial spaces but are NOT verified against
 * the current IES handbook or PEC lighting requirements. A licensed EE /
 * lighting designer must confirm every target before compliance results
 * are relied on — same treatment as the PEC-VERIFY electrical tables.
 * =======================================================================
 *
 * The maintenance-factor table is carried over from the original
 * BEPVY_Sims lumen-method engine (contamination level × cleaning
 * interval in years).
 */
import { RoomType } from "../types.js";

/** Target average illuminance (lux) by room type. LIGHTING-VERIFY. */
export const ROOM_ILLUMINANCE_TARGETS: Record<RoomType, number> = {
  bathroom: 150,
  kitchen: 300,
  garage: 200,
  laundry: 200,
  bedroom: 150,
  living: 150,
  dining: 150,
  office: 400,
  hallway: 100,
  outdoor: 50,
  other: 150,
};

/**
 * Acceptable band around the target before the compliance rule flags a
 * room: under 80% = under-lit, over 250% = over-lit (wasteful).
 * LIGHTING-VERIFY.
 */
export const ILLUMINANCE_MIN_RATIO = 0.8;
export const ILLUMINANCE_MAX_RATIO = 2.5;

export type ContaminationLevel = "very clean" | "clean" | "normal" | "dirty";
export type MaintenanceIntervalYears = 1 | 2 | 3 | 4 | 5 | 6;

/** Ported from the original BEPVY_Sims engine. */
export const MAINTENANCE_FACTOR_TABLE: Record<
  ContaminationLevel,
  Record<MaintenanceIntervalYears, number>
> = {
  "very clean": { 1: 0.96, 2: 0.94, 3: 0.92, 4: 0.9, 5: 0.88, 6: 0.87 },
  clean: { 1: 0.93, 2: 0.89, 3: 0.85, 4: 0.82, 5: 0.79, 6: 0.77 },
  normal: { 1: 0.89, 2: 0.84, 3: 0.79, 4: 0.75, 5: 0.7, 6: 0.67 },
  dirty: { 1: 0.83, 2: 0.78, 3: 0.73, 4: 0.69, 5: 0.65, 6: 0.62 },
};

/**
 * Luminous efficacy assumed when a lighting load has no `lumens` figure
 * (modern LED ballpark). LIGHTING-VERIFY: an assumption, not a spec.
 */
export const DEFAULT_LUMENS_PER_WATT = 100;

/** Default photometric environment for rooms without explicit values. */
export const DEFAULT_CEILING_HEIGHT_M = 2.7;
export const DEFAULT_WORKPLANE_HEIGHT_M = 0.85;
export const DEFAULT_CEILING_REFLECTANCE = 0.7;
export const DEFAULT_WALL_REFLECTANCE = 0.5;

/**
 * Default correlated color temperature (Kelvin) by room type — §9.1a's
 * "room mood": warm ambient for comfort spaces, cool/neutral for task
 * spaces. Design defaults the engineer can override per fixture, not
 * code requirements. LIGHTING-VERIFY: sensible lighting-design practice,
 * not a verified standard.
 */
export const ROOM_CCT_DEFAULTS: Record<RoomType, number> = {
  bedroom: 2700,
  living: 2700,
  dining: 3000,
  hallway: 3000,
  outdoor: 3000,
  other: 3500,
  office: 4000,
  kitchen: 4000,
  bathroom: 4000,
  laundry: 4000,
  garage: 5000,
};

/**
 * Daylight Factor inputs (§9.1a) — the simplified DF ratio, deliberately
 * NOT the split-flux radiative method (out of scope for a PEC tool; this
 * is an approximation and is labeled as such wherever surfaced).
 * DF >= 2% is the conventional "reasonably daylit" reference point.
 * LIGHTING-VERIFY.
 */
export const DEFAULT_GLAZING_VT = 0.6;
export const DAYLIGHT_FACTOR_GOOD = 0.02;
/** Glass band height implied by the standard window cut (head - sill). */
export const WINDOW_GLASS_HEIGHT_M = 1.2;
