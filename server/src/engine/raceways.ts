/**
 * Raceways (W6, WIRING-AUDIT F-13): ampacity correction for the project's
 * ambient temperature, adjustment for more than three current-carrying
 * conductors per raceway, conductor resizing, and conduit trade size by
 * fill — applied to the wiring topology after it is built.
 *
 * Raceway model: each wiring segment (home run or device-to-device link)
 * and each switch leg is its own conduit (assumption stated in
 * sizing/pec-derating.ts). A circuit's conductor size is uniform along
 * the circuit, so it is sized for its worst raceway: the most
 * current-carrying conductors in any of its runs.
 *
 * Resizing never touches the equipment grounding conductor: it stays
 * sized by the breaker (Table 2.50.6.13) — the proportional increase of
 * 2.50.6.13(B) applies to upsizing beyond the minimum size with
 * sufficient ampacity (e.g. for voltage drop), and the derated size IS
 * that minimum (PEC-VERIFY).
 */
import { Circuit, CircuitWiring, SwitchLeg, WireSegment } from "./types.js";
import {
  adjustmentFactor,
  ambientCorrectionFactor,
  currentCarryingCount,
  deratedAmpacity,
  sizeConductorForConditions,
  sizeConduit,
} from "./sizing/raceway.js";
import { PEC_TABLE_3_10_1 } from "./sizing/pec-table-3-10-1.js";
import { billOfMaterials } from "./topology.js";

export interface RacewayOptions {
  ambientTempC: number;
}

type Run = WireSegment | SwitchLeg;

export function applyRaceways(circuits: Circuit[], wiring: CircuitWiring, options: RacewayOptions): void {
  const { ambientTempC } = options;
  const runs: Run[] = [...wiring.segments, ...wiring.switchLegs];
  const runsOf = new Map<string, Run[]>();

  for (const run of runs) runsOf.set(run.circuitId, [...(runsOf.get(run.circuitId) ?? []), run]);

  for (const circuit of circuits) {
    const own = runsOf.get(circuit.id) ?? [];
    const insulation = circuit.conductor.insulation;
    const maxCurrentCarrying = Math.max(0, ...own.map((r) => currentCarryingCount(r.conductors)));
    const conditions = { ambientTempC, currentCarrying: maxCurrentCarrying };
    const before = circuit.conductor;

    try {
      circuit.conductor = sizeConductorForConditions(circuit.breakerAmps, insulation, conditions, before.mm2);
    } catch {
      // No listed size works (or the insulation is not permitted at this
      // ambient): keep the conductor; the ampacity rule reports it.
      const row = PEC_TABLE_3_10_1.find((r) => r.awg === before.awg);
      let usable = 0;

      try {
        usable = row ? deratedAmpacity(row, insulation, before.terminationTempC, conditions) : 0;
      } catch {
        usable = 0;
      }
      circuit.conductor = { ...before, ampacity: usable };
    }

    const resized = circuit.conductor.mm2 !== before.mm2;
    let ambientFactor = 0;

    try {
      ambientFactor = ambientCorrectionFactor(ambientTempC, insulation);
    } catch {
      ambientFactor = 0;
    }
    circuit.derating = {
      ambientTempC,
      ambientFactor,
      maxCurrentCarrying,
      adjustmentFactor: adjustmentFactor(maxCurrentCarrying),
      ampacity: circuit.conductor.ampacity,
      ...(resized ? { resizedFrom: { awg: before.awg, mm2: before.mm2 } } : {}),
    };

    for (const run of own) {
      for (const c of run.conductors) {
        if (c.role === "G") continue;
        c.awg = circuit.conductor.awg;
        c.mm2 = circuit.conductor.mm2;
      }
      const currentCarrying = currentCarryingCount(run.conductors);

      run.raceway = {
        currentCarrying,
        adjustmentFactor: adjustmentFactor(currentCarrying),
        ...sizeConduit(run.conductors, insulation),
      };
    }
  }

  const conduits = new Map<number, { tradeSize: string; metricMm: number; lengthM: number }>();

  for (const run of runs) {
    if (!run.raceway) continue;
    const line = conduits.get(run.raceway.metricMm) ?? {
      tradeSize: run.raceway.tradeSize,
      metricMm: run.raceway.metricMm,
      lengthM: 0,
    };

    line.lengthM += run.lengthM;
    conduits.set(line.metricMm, line);
  }

  wiring.bom = {
    ...billOfMaterials(runs, wiring.bom.junctionBoxes, wiring.switches),
    conduits: [...conduits.values()].sort((a, b) => a.metricMm - b.metricMm),
  };
}
