/**
 * W7 — service entrance code values (WIRING-AUDIT F-15).
 *
 * ============================ PEC-VERIFY ============================
 * PLACEHOLDER DATA. Values follow the NEC 2014 rules that PEC 2017
 * Part 1 adopts, with section numbers mapped the same way as
 * sizing/pec-overcurrent.ts (NEC 250.66 → PEC 2.50.3.17, NEC 250.52 →
 * PEC 2.50.3.3, NEC 230.71/230.74 → PEC 2.30.6.2/2.30.6.5). Metric sizes
 * are the PEC Table 3.10.1 equivalents the engine already uses. NOT
 * verified against the official PEC 2017 text: a licensed electrical
 * engineer must confirm every number and reference before permit use.
 * The kWh meter classes are a distribution-utility requirement, not a
 * PEC value (UTILITY-VERIFY — e.g. MERALCO service requirements).
 * ====================================================================
 */
import type { VoltageSystem, WireRole } from "../types.js";

/**
 * PEC 2017 2.50.3.17, Table 2.50.3.17 (NEC 2014 Table 250.66) — copper
 * grounding electrode conductor for an AC system, keyed by the largest
 * copper service-entrance conductor (mm²). Row bounds by AWG pattern:
 * ≤ 2 AWG (38 mm²) → 8 AWG; 1 or 1/0 → 6 AWG; 2/0 or 3/0 → 4 AWG;
 * 4/0 – 350 kcmil (177 mm²) → 2 AWG; > 350 – 600 kcmil (304 mm²) → 1/0;
 * > 600 – 1100 kcmil (557 mm²) → 2/0; above → 3/0.
 *
 * Sized from the table regardless of electrode type (conservative: NEC
 * 250.66(A) / PEC 2.50.3.17(A) lets the sole connection to a rod
 * electrode stop at 14 mm² (6 AWG) copper — not applied).
 */
export const GEC_TABLE: { maxServiceMm2: number; mm2: number; awg: string }[] = [
  { maxServiceMm2: 38, mm2: 8.0, awg: "8" },
  { maxServiceMm2: 60, mm2: 14, awg: "6" },
  { maxServiceMm2: 85, mm2: 22, awg: "4" },
  { maxServiceMm2: 177, mm2: 38, awg: "2" },
  { maxServiceMm2: 304, mm2: 60, awg: "1/0" },
  { maxServiceMm2: 557, mm2: 70, awg: "2/0" },
  { maxServiceMm2: Infinity, mm2: 85, awg: "3/0" },
];
export const GEC_REF = "PEC 2017 Table 2.50.3.17 grounding electrode conductor (PEC-VERIFY)";

/**
 * PEC 2017 2.50.3.3(A)(5) (NEC 250.52(A)(5)) — rod electrode: not less
 * than 2.4 m in contact with soil, 15.87 mm (5/8 in) diameter for
 * steel rods. One driven rod assumed (supplemental electrode / 25 Ω
 * test per 2.50.3.4 not modeled).
 */
export const GROUND_ROD = {
  kind: "driven ground rod",
  lengthM: 2.4,
  diameterMm: 15.87,
  pecReference: "PEC 2017 2.50.3.3(A)(5) rod electrode (PEC-VERIFY)",
};

/**
 * Service conductors per system: every ungrounded line + the grounded
 * (neutral) conductor. The neutral is sized like the lines (conservative;
 * the 2.20 neutral reduction is not applied).
 * PEC 2017 Art. 2.30 Part IV service-entrance conductors (PEC-VERIFY).
 */
export const SERVICE_CONDUCTOR_ROLES: Record<VoltageSystem, readonly WireRole[]> = {
  "1P2W-230": ["L", "N"],
  "1P2W-120": ["L", "N"],
  "1P3W-120/240": ["L", "L2", "N"],
  "3P4W-230/400": ["L", "L2", "L3", "N"],
};
export const SERVICE_CONDUCTOR_REF =
  "PEC 2017 Art. 2.30 Part IV service-entrance conductors; ampacity >= main per 2.30.4.11 / 2.40.1.4 (PEC-VERIFY)";

/**
 * Main (service disconnect) poles: one per service line conductor, all
 * opened together (PEC 2017 2.30.6.5, NEC 230.74). On the PH 230 V
 * single-phase two-wire service both conductors are opened (2P main,
 * local practice — assumption, PEC-VERIFY).
 */
export const MAIN_BREAKER_POLES: Record<VoltageSystem, number> = {
  "1P2W-230": 2,
  "1P2W-120": 2,
  "1P3W-120/240": 2,
  "3P4W-230/400": 3,
};
export const MAIN_BREAKER_REF = "PEC 2017 2.30.6.5 service disconnect / 2.30.7.1 overcurrent protection (PEC-VERIFY)";

/**
 * Self-contained kWh meter classes (A): the smallest class at or above
 * the main breaker; above the largest, CT-metered service.
 * UTILITY-VERIFY (distribution-utility requirement, not a PEC value).
 */
export const METER_CLASSES_A = [100, 200];
export const METER_REF = "Distribution utility metering requirement (UTILITY-VERIFY, not a PEC value)";
