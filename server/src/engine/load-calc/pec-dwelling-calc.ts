/**
 * PEC 2017 Article 2.20 dwelling load computation (W8) — the code values
 * the standard method needs on top of pec-demand-factors.ts.
 *
 * ============================ PEC-VERIFY ============================
 * PLACEHOLDER DATA. Values and section references follow the NEC 2017
 * Article 220 pattern that PEC 2017 Article 2.20 is modeled on; the PEC
 * section numbers in the references are the article/part, not verified
 * clause numbers. A licensed electrical engineer must confirm every
 * value and reference here before permit use.
 *
 * Reused unchanged from pec-demand-factors.ts (also PEC-VERIFY):
 * GENERAL_LIGHTING_VA_PER_SQM (24 VA/m²), SMALL_APPLIANCE_CIRCUIT_VA
 * (1500 VA per small-appliance / laundry circuit), LIGHTING_DEMAND_TIERS
 * (3000 VA at 100 %, next 117 000 VA at 35 %, rest at 25 %),
 * FIXED_APPLIANCE_DEMAND_FACTOR (75 %) at FIXED_APPLIANCE_MIN_COUNT (4).
 * ====================================================================
 */
import { LoadType, RoomType } from "../types.js";

/**
 * Room types left out of the floor area the general-lighting unit load is
 * computed on (open porches, garages, unused spaces).
 * PEC 2017 Art. 2.20 Part II, general lighting floor area (NEC 220.12 pattern). PEC-VERIFY.
 */
export const DWELLING_AREA_EXCLUDED_ROOM_TYPES: readonly RoomType[] = [
  "garage",
  "outdoor",
];

/**
 * Rooms whose receptacles are small-appliance branch circuits (kitchen,
 * pantry, breakfast room, dining room).
 * PEC 2017 2.10.1.11(C)(1) / Art. 2.20 Part III (NEC 210.11(C)(1), 220.52(A) pattern). PEC-VERIFY.
 */
export const SMALL_APPLIANCE_ROOM_TYPES: readonly RoomType[] = [
  "kitchen",
  "dining",
];

/** Rooms whose receptacles are laundry branch circuits. PEC 2017 2.10.1.11(C)(2) (NEC 220.52(B) pattern). PEC-VERIFY. */
export const LAUNDRY_ROOM_TYPES: readonly RoomType[] = ["laundry"];

/**
 * Minimum small-appliance branch circuits counted for a dwelling with a
 * kitchen or dining room (two or more 20 A circuits required).
 * PEC 2017 2.10.1.11(C)(1) (NEC 210.11(C)(1) pattern). PEC-VERIFY.
 */
export const MIN_SMALL_APPLIANCE_CIRCUITS = 2;

/**
 * Minimum laundry branch circuits counted when the plan has a laundry
 * room. PEC 2017 2.10.1.11(C)(2) (NEC 210.11(C)(2) pattern). PEC-VERIFY.
 */
export const MIN_LAUNDRY_CIRCUITS = 1;

/**
 * Air-conditioning load counted at 100 % of nameplate in the feeder
 * calculation (no demand factor). PEC 2017 Art. 2.20 Part III / Art. 4.40
 * (NEC 220.50, 220.60, 440 pattern). PEC-VERIFY.
 */
export const AIR_CONDITIONING_DEMAND_FACTOR = 1.0;

/** Motors and other equipment counted at 100 % (no demand factor). PEC 2017 2.20 Part III (NEC 220.50 pattern). PEC-VERIFY. */
export const OTHER_LOAD_DEMAND_FACTOR = 1.0;

/**
 * W8b. Load types that are motors for the "largest motor +25 %" step:
 * "hvac" (A/C motor-compressor) and "motor" (pumps, fans, other motors).
 * Fixed appliances ("appliance"), "equipment" (ranges, water heaters) and
 * "heating" are resistive, not motors.
 * PEC 2017 2.20.3.11 / 4.30.2.4 (NEC 220.50, 430.24 pattern; PEC clause
 * numbers derived from the NEC-to-PEC numbering pattern). PEC-VERIFY.
 */
export const MOTOR_LOAD_TYPES: readonly LoadType[] = ["hvac", "motor"];

/**
 * W8b. Share of the largest single motor load (VA) added to the dwelling
 * demand. PEC 2017 2.20.3.11 / 4.30.2.4 (NEC 220.50, 430.24 pattern). PEC-VERIFY.
 */
export const LARGEST_MOTOR_ADDER_FACTOR = 0.25;

/**
 * W8b. Load types that are fixed electric space heating, for the
 * heating/A-C non-coincidence step: when a dwelling has both, only the
 * larger total is counted (a tie keeps the A/C).
 * PEC 2017 2.20.3.21 (NEC 220.60 pattern). PEC-VERIFY.
 */
export const SPACE_HEATING_LOAD_TYPES: readonly LoadType[] = ["heating"];

/** W8b. Space heating counted at 100 % of nameplate. PEC 2017 2.20.3.21 (NEC 220.51, 220.60 pattern). PEC-VERIFY. */
export const SPACE_HEATING_DEMAND_FACTOR = 1.0;

/** PEC references printed next to each step of the schedule of loads. All PEC-VERIFY. */
export const DWELLING_CALC_REFS = {
  generalLighting:
    "PEC 2017 Art. 2.20 Part II general lighting unit load (NEC 220.12, 220.14(J) pattern) · PEC-VERIFY",
  smallAppliance:
    "PEC 2017 Art. 2.20 Part III small-appliance circuits (NEC 220.52(A) pattern) · PEC-VERIFY",
  laundry:
    "PEC 2017 Art. 2.20 Part III laundry circuit (NEC 220.52(B) pattern) · PEC-VERIFY",
  lightingDemand:
    "PEC 2017 Art. 2.20 Part III lighting demand factors (NEC Table 220.42 pattern) · PEC-VERIFY",
  fixedAppliance:
    "PEC 2017 Art. 2.20 Part III fixed appliances (NEC 220.53 pattern) · PEC-VERIFY",
  airConditioning:
    "PEC 2017 Art. 2.20 Part III / Art. 4.40 air conditioning (NEC 220.50, 220.60 pattern) · PEC-VERIFY",
  spaceHeating:
    "PEC 2017 2.20.3.12 fixed electric space heating (NEC 220.51 pattern) · PEC-VERIFY",
  heatingAcNoncoincident:
    "PEC 2017 2.20.3.21 noncoincident loads (NEC 220.60 pattern) · PEC-VERIFY",
  largestMotor:
    "PEC 2017 2.20.3.11 / 4.30.2.4 largest motor at 25% (NEC 220.50, 430.24 pattern) · PEC-VERIFY",
  other:
    "PEC 2017 Art. 2.20 Part III motors and other loads (NEC 220.50 pattern) · PEC-VERIFY",
  feeder:
    "PEC 2017 Art. 2.20 Part III feeder/service load (NEC 220.40 pattern) · PEC-VERIFY",
} as const;
