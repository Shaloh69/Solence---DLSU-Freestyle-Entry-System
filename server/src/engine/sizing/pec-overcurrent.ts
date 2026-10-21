/**
 * PEC 2017 Part 1 — overcurrent protection, terminations, grounding.
 *
 * ============================ PEC-VERIFY ============================
 * Values transcribed from the unofficial PEC 2017 Part 1 text on the
 * Filipino Engineer wiki (filipinoengineer.com/wiki), which mirrors the
 * NEC 2014 structure the PEC adopts. A licensed electrical engineer must
 * confirm every number and section reference against the official code
 * before any output is used for a permit.
 * ====================================================================
 */

/**
 * 2.40.1.4(D) Small conductors — maximum overcurrent protection for
 * copper conductors, keyed by cross-section in mm².
 * "15 A for 2.0 mm² (1.6 mm dia.), 20 A for 3.5 mm² (2.0 mm dia.),
 *  and 30 A for 5.5 mm² (2.6 mm dia.) copper"
 */
export const SMALL_CONDUCTOR_MAX_OCPD_A: Record<number, number> = {
  2.0: 15,
  3.5: 20,
  5.5: 30,
};
export const SMALL_CONDUCTOR_REF = "PEC 2017 2.40.1.4(D) small conductors (PEC-VERIFY)";

/**
 * 1.10.1.14(C) Temperature limitations (NEC 110.14(C) equivalent):
 * terminations of circuits rated 100 A or less, or marked for 2.0 mm²
 * (14 AWG) through 38 mm² (1 AWG) conductors, use the 60 °C ampacity
 * column unless the equipment is listed for 75 °C; above 100 A, 75 °C.
 */
export const TERMINATION_THRESHOLD_A = 100;
export const TERMINATION_TEMP_LOW_C = 60;
export const TERMINATION_TEMP_HIGH_C = 75;
export const TERMINATION_REF = "PEC 2017 1.10.1.14(C) termination temperature (PEC-VERIFY)";

/**
 * 2.10.2.1 Branch-circuit ratings: circuits other than individual branch
 * circuits are rated 15, 20, 30, 40 or 50 A.
 */
export const MULTI_OUTLET_RATINGS_A = [15, 20, 30, 40, 50];

/**
 * Table 2.50.6.13 — minimum copper equipment grounding conductor by
 * rating of the overcurrent device ahead of it.
 */
export const EGC_TABLE: { maxOcpdA: number; mm2: number; awg: string }[] = [
  { maxOcpdA: 15, mm2: 2.0, awg: "14" },
  { maxOcpdA: 20, mm2: 3.5, awg: "12" },
  { maxOcpdA: 60, mm2: 5.5, awg: "10" },
  { maxOcpdA: 100, mm2: 8.0, awg: "8" },
  { maxOcpdA: 200, mm2: 14, awg: "6" },
  { maxOcpdA: 300, mm2: 22, awg: "4" },
  { maxOcpdA: 400, mm2: 30, awg: "3" },
  { maxOcpdA: 500, mm2: 30, awg: "3" },
  { maxOcpdA: 600, mm2: 38, awg: "2" },
];
export const EGC_REF = "PEC 2017 Table 2.50.6.13 (PEC-VERIFY)";

/**
 * 2.10.1.11(C) Dwelling units — required 20 A branch circuits:
 * small-appliance (kitchen/dining receptacles), laundry, bathroom.
 */
export const REQUIRED_20A_ROOM_TYPES = ["kitchen", "dining", "laundry", "bathroom"] as const;
export const REQUIRED_CIRCUIT_MIN_A = 20;
export const REQUIRED_CIRCUIT_REF = "PEC 2017 2.10.1.11(C) required dwelling branch circuits (PEC-VERIFY)";

/**
 * 2.10.3.3(A)(1) Receptacle spacing: no point along the floor line of a
 * wall more than 1 800 mm from a receptacle outlet, in habitable rooms.
 * Simplification (flagged): measured along the room perimeter, doorways
 * not excluded — conservative.
 */
export const RECEPTACLE_MAX_DISTANCE_M = 1.8;
export const RECEPTACLE_SPACING_ROOM_TYPES = ["bedroom", "living", "dining", "office"] as const;
export const RECEPTACLE_SPACING_REF = "PEC 2017 2.10.3.3(A)(1) receptacle spacing (PEC-VERIFY)";
