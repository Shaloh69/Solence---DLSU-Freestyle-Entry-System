/**
 * Breaker and conductor sizing.
 *
 * Pure functions: circuit load figures in → breaker rating and
 * conductor spec out. Table data lives in pec-table-3-10-1.ts and
 * breaker-sizes.ts (both PEC-VERIFY placeholders).
 */
import { ConductorSpec, InsulationType, Phase } from "../types.js";
import { PEC_TABLE_3_10_1 } from "./pec-table-3-10-1.js";
import { STANDARD_BREAKER_AMPS } from "./breaker-sizes.js";

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
 * Smallest conductor whose PEC Table 3.10.1 ampacity is at or above the
 * given amps for the chosen insulation type.
 */
export function sizeConductor(
  amps: number,
  insulation: InsulationType = "THHN"
): ConductorSpec {
  const row = PEC_TABLE_3_10_1.find(
    (candidate) => candidate.ampacity[insulation] >= amps
  );

  if (!row) {
    throw new Error(
      `No conductor in PEC Table 3.10.1 carries ${amps.toFixed(1)} A ` +
        `with ${insulation} insulation (parallel runs not yet supported)`
    );
  }

  return {
    awg: row.awg,
    mm2: row.mm2,
    ampacity: row.ampacity[insulation],
    insulation,
  };
}

/**
 * Size a branch circuit end to end: required amps -> breaker -> conductor
 * sized to the breaker rating (so the conductor is always protected).
 */
export function sizeBranchCircuit(
  connectedVa: number,
  continuousVa: number,
  voltage: number,
  insulation: InsulationType = "THHN"
): { breakerAmps: number; conductor: ConductorSpec } {
  const amps = requiredAmps(connectedVa, continuousVa, voltage);
  const breakerAmps = sizeBreaker(amps);
  const conductor = sizeConductor(breakerAmps, insulation);

  return { breakerAmps, conductor };
}

/**
 * Greedy three-phase balancing: assign each circuit (heaviest first) to
 * the currently lightest phase. Returns the phase per circuit id and the
 * resulting per-phase VA totals.
 */
export function balanceThreePhase(
  circuits: { id: string; va: number }[]
): { assignments: Record<string, Phase>; phaseVa: Record<Phase, number> } {
  const phaseVa: Record<Phase, number> = { A: 0, B: 0, C: 0 };
  const assignments: Record<string, Phase> = {};
  const sorted = [...circuits].sort((a, b) => b.va - a.va);

  for (const circuit of sorted) {
    const lightest = (Object.keys(phaseVa) as Phase[]).reduce((min, phase) =>
      phaseVa[phase] < phaseVa[min] ? phase : min
    );

    assignments[circuit.id] = lightest;
    phaseVa[lightest] += circuit.va;
  }

  return { assignments, phaseVa };
}
