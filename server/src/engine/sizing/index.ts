/**
 * Breaker and conductor sizing.
 *
 * Pure functions: circuit load figures in → breaker rating and
 * conductor spec out. Table data lives in pec-table-3-10-1.ts,
 * breaker-sizes.ts and pec-overcurrent.ts (all PEC-VERIFY).
 *
 * A conductor is accepted only if (W2, PEC 2017):
 *  - its ampacity at the TERMINATION temperature (60 °C for circuits
 *    ≤100 A, 75 °C above — 1.10.1.14(C)) covers the breaker, not just
 *    its insulation rating, and
 *  - the breaker does not exceed the small-conductor limit for its size
 *    (2.0 mm² ≤15 A, 3.5 mm² ≤20 A, 5.5 mm² ≤30 A — 2.40.1.4(D)).
 */
import { ConductorSpec, InsulationType, Phase } from "../types.js";
import { AmpacityRow, PEC_TABLE_3_10_1 } from "./pec-table-3-10-1.js";
import { STANDARD_BREAKER_AMPS } from "./breaker-sizes.js";
import {
  EGC_TABLE,
  MULTI_OUTLET_RATINGS_A,
  SMALL_CONDUCTOR_MAX_OCPD_A,
  TERMINATION_TEMP_HIGH_C,
  TERMINATION_TEMP_LOW_C,
  TERMINATION_THRESHOLD_A,
} from "./pec-overcurrent.js";

/** Insulation column that carries each temperature rating in the table. */
const COLUMN_FOR_TEMP: Record<60 | 75 | 90, InsulationType> = {
  60: "TW",
  75: "THW",
  90: "THHN",
};

/** Termination temperature rating assumed for a circuit of this rating. */
export function terminationTempFor(breakerAmps: number): 60 | 75 {
  return breakerAmps <= TERMINATION_THRESHOLD_A
    ? (TERMINATION_TEMP_LOW_C as 60)
    : (TERMINATION_TEMP_HIGH_C as 75);
}

/** Usable ampacity: the lower of the insulation and termination ratings. */
export function effectiveAmpacity(
  row: AmpacityRow,
  insulation: InsulationType,
  terminationTempC: 60 | 75
): number {
  return Math.min(row.ampacity[insulation], row.ampacity[COLUMN_FOR_TEMP[terminationTempC]]);
}

/** Max breaker allowed on a conductor by the small-conductor rule (Infinity if none). */
export function smallConductorLimit(mm2: number): number {
  return SMALL_CONDUCTOR_MAX_OCPD_A[mm2] ?? Infinity;
}

/**
 * Required circuit ampacity: non-continuous + 125% of continuous load
 * (the flip side of the 80% continuous rule).
 */
export function requiredAmps(
  connectedVa: number,
  continuousVa: number,
  voltage: number
): number {
  if (voltage <= 0) throw new Error("voltage must be positive");
  if (continuousVa > connectedVa) {
    throw new Error("continuousVa cannot exceed connectedVa");
  }
  const nonContinuousVa = connectedVa - continuousVa;

  return (nonContinuousVa + 1.25 * continuousVa) / voltage;
}

/** Smallest standard breaker rated at or above the required amps. */
export function sizeBreaker(amps: number): number {
  const breaker = STANDARD_BREAKER_AMPS.find((rating) => rating >= amps);

  if (breaker === undefined) {
    throw new Error(
      `Load of ${amps.toFixed(1)} A exceeds the largest standard breaker ` +
        `(${STANDARD_BREAKER_AMPS[STANDARD_BREAKER_AMPS.length - 1]} A)`
    );
  }

  return breaker;
}

/**
 * Smallest conductor that may be protected by a `breakerAmps` breaker:
 * usable ampacity (termination-limited) ≥ breaker, and within the
 * small-conductor limit. `amps` defaults to the breaker rating.
 */
export function sizeConductor(
  amps: number,
  insulation: InsulationType = "THHN",
  options: { breakerAmps?: number } = {}
): ConductorSpec {
  const breakerAmps = options.breakerAmps ?? amps;
  const terminationTempC = terminationTempFor(breakerAmps);
  const row = PEC_TABLE_3_10_1.find(
    (candidate) =>
      effectiveAmpacity(candidate, insulation, terminationTempC) >= amps &&
      smallConductorLimit(candidate.mm2) >= breakerAmps
  );

  if (!row) {
    throw new Error(
      `No conductor in PEC Table 3.10.1 carries ${amps.toFixed(1)} A ` +
        `with ${insulation} insulation at ${terminationTempC} °C terminals ` +
        `(parallel runs not yet supported)`
    );
  }

  return {
    awg: row.awg,
    mm2: row.mm2,
    ampacity: effectiveAmpacity(row, insulation, terminationTempC),
    insulation,
    terminationTempC,
  };
}

/** Equipment grounding conductor for a breaker rating (Table 2.50.6.13). */
export function sizeEquipmentGroundingConductor(breakerAmps: number): { awg: string; mm2: number } {
  const row = EGC_TABLE.find((r) => r.maxOcpdA >= breakerAmps);

  if (!row) throw new Error(`No grounding conductor listed for a ${breakerAmps} A device`);

  return { awg: row.awg, mm2: row.mm2 };
}

/**
 * Size a branch circuit end to end: required amps -> breaker -> conductor
 * sized to the breaker rating (so the conductor is always protected).
 *
 * Multi-outlet circuits use only the 2.10.2.1 ratings (15/20/30/40/50 A);
 * individual circuits (one utilization equipment) may use any standard
 * rating. `minBreakerAmps` enforces required circuit ratings (e.g. the
 * 20 A small-appliance circuits of 2.10.1.11(C)).
 */
export function sizeBranchCircuit(
  connectedVa: number,
  continuousVa: number,
  voltage: number,
  insulation: InsulationType = "THHN",
  options: { individual?: boolean; minBreakerAmps?: number } = {}
): { breakerAmps: number; conductor: ConductorSpec } {
  const amps = Math.max(requiredAmps(connectedVa, continuousVa, voltage), options.minBreakerAmps ?? 0);
  const multiOutlet = MULTI_OUTLET_RATINGS_A.find((rating) => rating >= amps);
  const breakerAmps = options.individual || multiOutlet === undefined ? sizeBreaker(amps) : multiOutlet;
  const conductor = sizeConductor(breakerAmps, insulation, { breakerAmps });

  return { breakerAmps, conductor };
}

/**
 * Greedy phase balancing over an arbitrary set of legs: assign each
 * circuit (heaviest first) to the currently lightest phase. Returns the
 * phase per circuit id and the resulting per-phase VA totals.
 */
export function balancePhases(
  circuits: { id: string; va: number }[],
  phases: Phase[]
): { assignments: Record<string, Phase>; phaseVa: Record<Phase, number> } {
  if (phases.length === 0) throw new Error("at least one phase required");

  const phaseVa: Record<Phase, number> = { A: 0, B: 0, C: 0 };
  const assignments: Record<string, Phase> = {};
  const sorted = [...circuits].sort((a, b) => b.va - a.va);

  for (const circuit of sorted) {
    const lightest = phases.reduce((min, phase) =>
      phaseVa[phase] < phaseVa[min] ? phase : min
    );

    assignments[circuit.id] = lightest;
    phaseVa[lightest] += circuit.va;
  }

  return { assignments, phaseVa };
}

/** Greedy three-phase balancing across legs A/B/C. */
export function balanceThreePhase(
  circuits: { id: string; va: number }[]
): { assignments: Record<string, Phase>; phaseVa: Record<Phase, number> } {
  return balancePhases(circuits, ["A", "B", "C"]);
}
