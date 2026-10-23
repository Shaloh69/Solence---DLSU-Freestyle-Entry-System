/**
 * W6 raceway math: ampacity correction (ambient) and adjustment (more
 * than three current-carrying conductors), conductor resizing under those
 * conditions, and conduit trade size by fill. Pure functions; every
 * number comes from pec-derating.ts / pec-table-3-10-1.ts (PEC-VERIFY).
 *
 * Usable ampacity under conditions (NEC 110.14(C) / 310.15 practice that
 * PEC 2017 1.10.1.14(C) / 3.10.1.15 mirrors): the insulation column ×
 * ambient factor × adjustment factor, but never above the termination
 * column (60 °C ≤100 A) — the terminal limit is not derated.
 */
import type { ConductorSpec, InsulationType, WireRole } from "../types.js";
import { AmpacityRow, PEC_TABLE_3_10_1 } from "./pec-table-3-10-1.js";
import { effectiveAmpacity, smallConductorLimit, terminationTempFor } from "./index.js";
import {
  ADJUSTMENT_FACTORS,
  AMBIENT_CORRECTION,
  CONDUIT_TRADE_SIZES,
  CURRENT_CARRYING_ROLES,
  INSULATION_TEMP_RATING_C,
  conductorAreaMm2,
  fillLimitPercent,
} from "./pec-derating.js";

export interface RacewayConditions {
  ambientTempC: number;
  /** Current-carrying conductors in the raceway. */
  currentCarrying: number;
}

/** Ambient correction factor for an insulation type (throws where the table permits none). */
export function ambientCorrectionFactor(ambientTempC: number, insulation: InsulationType): number {
  const rating = INSULATION_TEMP_RATING_C[insulation];
  const band = AMBIENT_CORRECTION.find((b) => ambientTempC <= b.maxC);
  const factor = band?.factor[rating];

  if (factor === undefined || factor === null) {
    throw new Error(`${insulation} (${rating} °C) conductors are not permitted at ${ambientTempC} °C ambient`);
  }

  return factor;
}

export function adjustmentFactor(currentCarrying: number): number {
  return ADJUSTMENT_FACTORS.find((a) => currentCarrying <= a.maxConductors)!.factor;
}

export function currentCarryingCount(conductors: { role: WireRole }[]): number {
  return conductors.filter((c) => (CURRENT_CARRYING_ROLES as readonly string[]).includes(c.role)).length;
}

/** Usable ampacity of a table row under ambient + conductor-count conditions. */
export function deratedAmpacity(
  row: AmpacityRow,
  insulation: InsulationType,
  terminationTempC: 60 | 75,
  conditions: RacewayConditions
): number {
  const corrected =
    row.ampacity[insulation] *
    ambientCorrectionFactor(conditions.ambientTempC, insulation) *
    adjustmentFactor(conditions.currentCarrying);

  return Math.min(corrected, effectiveAmpacity(row, insulation, terminationTempC));
}

/**
 * Smallest conductor a `breakerAmps` breaker may protect under the given
 * conditions: derated usable ampacity ≥ breaker and within the
 * small-conductor limit. `minMm2` keeps an existing size from shrinking.
 */
export function sizeConductorForConditions(
  breakerAmps: number,
  insulation: InsulationType,
  conditions: RacewayConditions,
  minMm2 = 0
): ConductorSpec {
  const terminationTempC = terminationTempFor(breakerAmps);
  const row = PEC_TABLE_3_10_1.find(
    (r) =>
      r.mm2 >= minMm2 &&
      smallConductorLimit(r.mm2) >= breakerAmps &&
      deratedAmpacity(r, insulation, terminationTempC, conditions) >= breakerAmps
  );

  if (!row) {
    throw new Error(
      `No conductor in PEC Table 3.10.1 carries ${breakerAmps} A with ${insulation} insulation ` +
        `at ${conditions.ambientTempC} °C with ${conditions.currentCarrying} current-carrying conductors`
    );
  }

  return {
    awg: row.awg,
    mm2: row.mm2,
    ampacity: deratedAmpacity(row, insulation, terminationTempC, conditions),
    insulation,
    terminationTempC,
  };
}

export interface ConduitSize {
  tradeSize: string;
  metricMm: number;
  conductorAreaMm2: number;
  fillPercent: number;
  fillLimitPercent: number;
}

/** Smallest trade size whose fill stays within the Chapter 9 Table 1 limit. */
export function sizeConduit(conductors: { awg: string }[], insulation: InsulationType): ConduitSize {
  const area = conductors.reduce((sum, c) => sum + conductorAreaMm2(c.awg, insulation), 0);
  const limit = fillLimitPercent(conductors.length);
  const size = CONDUIT_TRADE_SIZES.find((t) => (area * 100) / t.areaMm2 <= limit);

  if (!size) throw new Error(`${area.toFixed(0)} mm² of conductors exceeds the largest listed conduit`);

  return {
    tradeSize: size.tradeSize,
    metricMm: size.metricMm,
    conductorAreaMm2: area,
    fillPercent: (area * 100) / size.areaMm2,
    fillLimitPercent: limit,
  };
}
