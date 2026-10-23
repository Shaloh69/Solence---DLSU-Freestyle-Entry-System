/**
 * W6 — ampacity correction / adjustment and raceway fill (WIRING-AUDIT F-13).
 *
 * ============================ PEC-VERIFY ============================
 * Values follow the NEC 2014 tables that PEC 2017 Part 1 adopts (section
 * numbers mapped the same way as pec-overcurrent.ts: NEC 310.15 →
 * PEC 3.10.1.15, NEC Chapter 9 → PEC Chapter 9). They are NOT verified
 * against the official PEC 2017 text. A licensed electrical engineer
 * must confirm every number and section reference before any output is
 * used for a permit.
 * ====================================================================
 *
 * Raceway model (assumption, stated in the W6 report and api.md): every
 * conduit segment of the wiring topology — each home run, each
 * device-to-device link and each switch leg — is its own raceway. Two
 * circuits whose routes follow the same path are drawn and billed as
 * separate, parallel conduits (one circuit per conduit), so their
 * conductors are not counted together. Bundling several circuits into
 * one shared conduit would need a shared-raceway model (and changes the
 * conduit bill of materials); it is not done here.
 */
import type { InsulationType } from "../types.js";

/**
 * Design ambient for conduit runs, °C (project setting
 * `floorPlan.ambientTempC`). Concealed runs in PH houses go through the
 * ceiling space under the roof, which runs 35–40 °C — 35 °C is the
 * default; the user raises it for hotter roof spaces. Assumption, not a
 * code value (PEC-VERIFY / DESIGN-VERIFY).
 */
export const DEFAULT_AMBIENT_TEMP_C = 35;
/** Range the project setting accepts (every column of the table below covers it). */
export const AMBIENT_TEMP_MIN_C = 0;
export const AMBIENT_TEMP_MAX_C = 55;

/** Temperature rating of each insulation type = the table column used for correction. */
export const INSULATION_TEMP_RATING_C: Record<InsulationType, 60 | 75 | 90> = {
  TW: 60,
  THW: 75,
  THHN: 90,
  XHHW: 90, // XHHW dry rating; the ampacity table already uses the 90 °C values for it
};

/**
 * PEC 2017 3.10.1.15(B)(2)(a), Table 3.10.1.15(B)(2)(a) (NEC 2014 Table
 * 310.15(B)(2)(a)) — ambient correction factors for ampacities based on
 * 30 °C. Rows by upper bound of the ambient band (°C), factors by
 * conductor temperature rating; null = not permitted at that ambient.
 */
export const AMBIENT_CORRECTION: { maxC: number; factor: Record<60 | 75 | 90, number | null> }[] = [
  { maxC: 10, factor: { 60: 1.29, 75: 1.2, 90: 1.15 } },
  { maxC: 15, factor: { 60: 1.22, 75: 1.15, 90: 1.12 } },
  { maxC: 20, factor: { 60: 1.15, 75: 1.11, 90: 1.08 } },
  { maxC: 25, factor: { 60: 1.08, 75: 1.05, 90: 1.04 } },
  { maxC: 30, factor: { 60: 1.0, 75: 1.0, 90: 1.0 } },
  { maxC: 35, factor: { 60: 0.91, 75: 0.94, 90: 0.96 } },
  { maxC: 40, factor: { 60: 0.82, 75: 0.88, 90: 0.91 } },
  { maxC: 45, factor: { 60: 0.71, 75: 0.82, 90: 0.87 } },
  { maxC: 50, factor: { 60: 0.58, 75: 0.75, 90: 0.82 } },
  { maxC: 55, factor: { 60: 0.41, 75: 0.67, 90: 0.76 } },
  { maxC: 60, factor: { 60: null, 75: 0.58, 90: 0.71 } },
  { maxC: 65, factor: { 60: null, 75: 0.47, 90: 0.65 } },
  { maxC: 70, factor: { 60: null, 75: 0.33, 90: 0.58 } },
  { maxC: 75, factor: { 60: null, 75: null, 90: 0.5 } },
  { maxC: 80, factor: { 60: null, 75: null, 90: 0.41 } },
  { maxC: 85, factor: { 60: null, 75: null, 90: 0.29 } },
];
export const AMBIENT_CORRECTION_REF =
  "PEC 2017 3.10.1.15(B)(2)(a), Table 3.10.1.15(B)(2)(a) ambient correction (PEC-VERIFY)";

/**
 * PEC 2017 3.10.1.15(B)(3)(a), Table 3.10.1.15(B)(3)(a) (NEC 2014 Table
 * 310.15(B)(3)(a)) — adjustment for more than three current-carrying
 * conductors in a raceway, by upper bound of the conductor count.
 */
export const ADJUSTMENT_FACTORS: { maxConductors: number; factor: number }[] = [
  { maxConductors: 3, factor: 1 },
  { maxConductors: 6, factor: 0.8 },
  { maxConductors: 9, factor: 0.7 },
  { maxConductors: 20, factor: 0.5 },
  { maxConductors: 30, factor: 0.45 },
  { maxConductors: 40, factor: 0.4 },
  { maxConductors: Infinity, factor: 0.35 },
];
export const ADJUSTMENT_REF =
  "PEC 2017 3.10.1.15(B)(3)(a), Table 3.10.1.15(B)(3)(a) more than three current-carrying conductors (PEC-VERIFY)";

/**
 * What counts as current-carrying (PEC 2017 3.10.1.15(B)(5)–(6), NEC
 * 310.15(B)(5)–(6)): every ungrounded conductor (L, L2, L3, switched S,
 * travelers T — both travelers counted, conservative, although only one
 * is energized at a time); the neutral N of a 2-wire circuit (it carries
 * the full load current — no multiwire circuits are built); never the
 * equipment grounding conductor G.
 */
export const CURRENT_CARRYING_ROLES = ["L", "L2", "L3", "N", "S", "T"] as const;
export const CURRENT_CARRYING_REF =
  "PEC 2017 3.10.1.15(B)(5)(a) neutral, 3.10.1.15(B)(6) grounding conductor (PEC-VERIFY)";

/**
 * PEC 2017 Chapter 9, Table 1 (NEC 2014 Chapter 9 Table 1) — maximum
 * fill, percent of the raceway's internal area, by number of conductors.
 * Note (3) to the Chapter 9 tables: equipment grounding conductors are
 * included in the count and the area.
 */
export const FILL_LIMIT_PERCENT = { one: 53, two: 31, overTwo: 40 } as const;
export const FILL_REF =
  "PEC 2017 Chapter 9 Table 1 (fill), Table 4 (PVC Schedule 40, Art. 3.52), Table 5 (conductor areas) (PEC-VERIFY)";

export function fillLimitPercent(conductors: number): number {
  if (conductors <= 1) return FILL_LIMIT_PERCENT.one;
  if (conductors === 2) return FILL_LIMIT_PERCENT.two;

  return FILL_LIMIT_PERCENT.overTwo;
}

/**
 * PEC 2017 Chapter 9, Table 4 (NEC 2014 Chapter 9 Table 4, Article 352)
 * — rigid PVC conduit Schedule 40, total internal area (100%), mm².
 * PVC Schedule 40 is assumed (concealed uPVC in slabs and walls is the
 * common PH residential practice — DESIGN-VERIFY). Smallest size 16 mm
 * (1/2") per PEC 2017 3.52.2.20(A) (NEC 352.20(A)).
 */
export const CONDUIT_TYPE = "PVC Schedule 40";
export const CONDUIT_TRADE_SIZES: { tradeSize: string; metricMm: number; areaMm2: number }[] = [
  { tradeSize: '1/2"', metricMm: 16, areaMm2: 184 },
  { tradeSize: '3/4"', metricMm: 21, areaMm2: 327 },
  { tradeSize: '1"', metricMm: 27, areaMm2: 535 },
  { tradeSize: '1-1/4"', metricMm: 35, areaMm2: 935 },
  { tradeSize: '1-1/2"', metricMm: 41, areaMm2: 1282 },
  { tradeSize: '2"', metricMm: 53, areaMm2: 2124 },
  { tradeSize: '2-1/2"', metricMm: 63, areaMm2: 3029 },
  { tradeSize: '3"', metricMm: 78, areaMm2: 4693 },
  { tradeSize: '3-1/2"', metricMm: 91, areaMm2: 6277 },
  { tradeSize: '4"', metricMm: 103, areaMm2: 8091 },
];

/**
 * PEC 2017 Chapter 9, Table 5 (NEC 2014 Chapter 9 Table 5) — approximate
 * area of insulated conductors, mm², keyed by the AWG labels of
 * pec-table-3-10-1.ts. TW/THW share one row; XHHW its own; THHN the
 * THHN/THWN row. The equipment ground is assumed insulated (green) of the
 * circuit's insulation type.
 */
const TW_THW_AREA: Record<string, number> = {
  "14": 8.968, "12": 11.68, "10": 15.68, "8": 28.19, "6": 46.84, "4": 62.77, "3": 73.16,
  "2": 86.0, "1": 122.6, "1/0": 143.4, "2/0": 169.3, "3/0": 201.1, "4/0": 239.9,
  "250MCM": 296.5, "300MCM": 340.7, "400MCM": 427.0,
};
export const CONDUCTOR_AREA_MM2: Record<InsulationType, Record<string, number>> = {
  TW: TW_THW_AREA,
  THW: TW_THW_AREA,
  THHN: {
    "14": 6.258, "12": 8.581, "10": 13.61, "8": 23.61, "6": 32.71, "4": 53.16, "3": 62.77,
    "2": 74.71, "1": 100.8, "1/0": 119.7, "2/0": 143.4, "3/0": 172.8, "4/0": 208.8,
    "250MCM": 256.1, "300MCM": 297.3, "400MCM": 378.3,
  },
  XHHW: {
    "14": 8.968, "12": 11.68, "10": 15.68, "8": 28.19, "6": 38.06, "4": 52.52, "3": 62.06,
    "2": 73.94, "1": 98.97, "1/0": 117.7, "2/0": 141.3, "3/0": 170.5, "4/0": 206.3,
    "250MCM": 251.9, "300MCM": 292.6, "400MCM": 373.0,
  },
};

export function conductorAreaMm2(awg: string, insulation: InsulationType): number {
  const area = CONDUCTOR_AREA_MM2[insulation][awg];

  if (area === undefined) throw new Error(`No conductor area for ${awg} AWG ${insulation}`);

  return area;
}
