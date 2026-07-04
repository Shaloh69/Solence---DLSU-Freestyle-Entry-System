/**
 * PEC Table 3.10.1 — allowable conductor ampacities.
 *
 * ============================ PEC-VERIFY ============================
 * PLACEHOLDER DATA. The figures below follow the familiar NEC-style
 * 60/75/90°C copper ampacity pattern and are NOT verified against the
 * current Philippine Electrical Code edition. A licensed electrical
 * engineer must replace/confirm every number in this file (ampacities,
 * mm² equivalents, insulation-type column mapping) before any output
 * is used for a real permit submission.
 * ====================================================================
 *
 * Copper conductors, assumed ≤3 current-carrying conductors in raceway,
 * 30°C ambient. Derating factors are out of scope for this table.
 */
import { InsulationType } from "../types.js";

export interface AmpacityRow {
  awg: string;
  mm2: number;
  /** Ampacity by insulation type. */
  ampacity: Record<InsulationType, number>;
}

/** Ordered smallest to largest. */
export const PEC_TABLE_3_10_1: AmpacityRow[] = [
  // PEC-VERIFY: every row below is a placeholder.
  { awg: "14", mm2: 2.0, ampacity: { TW: 15, THW: 20, THHN: 25, XHHW: 25 } },
  { awg: "12", mm2: 3.5, ampacity: { TW: 20, THW: 25, THHN: 30, XHHW: 30 } },
  { awg: "10", mm2: 5.5, ampacity: { TW: 30, THW: 35, THHN: 40, XHHW: 40 } },
  { awg: "8", mm2: 8.0, ampacity: { TW: 40, THW: 50, THHN: 55, XHHW: 55 } },
  { awg: "6", mm2: 14, ampacity: { TW: 55, THW: 65, THHN: 75, XHHW: 75 } },
  { awg: "4", mm2: 22, ampacity: { TW: 70, THW: 85, THHN: 95, XHHW: 95 } },
  { awg: "3", mm2: 30, ampacity: { TW: 85, THW: 100, THHN: 115, XHHW: 115 } },
  { awg: "2", mm2: 38, ampacity: { TW: 95, THW: 115, THHN: 130, XHHW: 130 } },
  { awg: "1", mm2: 50, ampacity: { TW: 110, THW: 130, THHN: 145, XHHW: 145 } },
  { awg: "1/0", mm2: 60, ampacity: { TW: 125, THW: 150, THHN: 170, XHHW: 170 } },
  { awg: "2/0", mm2: 70, ampacity: { TW: 145, THW: 175, THHN: 195, XHHW: 195 } },
  { awg: "3/0", mm2: 85, ampacity: { TW: 165, THW: 200, THHN: 225, XHHW: 225 } },
  { awg: "4/0", mm2: 107, ampacity: { TW: 195, THW: 230, THHN: 260, XHHW: 260 } },
  { awg: "250MCM", mm2: 127, ampacity: { TW: 215, THW: 255, THHN: 290, XHHW: 290 } },
  { awg: "300MCM", mm2: 152, ampacity: { TW: 240, THW: 285, THHN: 320, XHHW: 320 } },
  { awg: "400MCM", mm2: 203, ampacity: { TW: 280, THW: 335, THHN: 380, XHHW: 380 } },
];

/**
 * DC resistance of copper conductors in ohms per kilometer.
 * PEC-VERIFY: placeholder values (uncoated copper, ~75°C, per the usual
 * NEC Chapter 9 Table 8 pattern) — must be confirmed for the conductor
 * types actually specified.
 */
export const CONDUCTOR_RESISTANCE_OHM_PER_KM: Record<string, number> = {
  "14": 10.17,
  "12": 6.39,
  "10": 3.94,
  "8": 2.56,
  "6": 1.61,
  "4": 1.02,
  "3": 0.82,
  "2": 0.62,
  "1": 0.49,
  "1/0": 0.39,
  "2/0": 0.32,
  "3/0": 0.25,
  "4/0": 0.19,
  "250MCM": 0.17,
  "300MCM": 0.14,
  "400MCM": 0.11,
};
