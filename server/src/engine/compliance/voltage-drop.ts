/**
 * Voltage drop check: max 3% per branch circuit, max 5% total
 * (branch + feeder), computed per routed run length.
 *
 * Single-phase: VD = 2 × I × R × L (out-and-back).
 * Three-phase:  VD = √3 × I × R × L.
 *
 * PEC-VERIFY: the 3%/5% limits follow the usual PEC/NEC recommended
 * practice; conductor resistance values are placeholders (see
 * pec-table-3-10-1.ts).
 */
import { Circuit, Violation } from "../types.js";
import { CONDUCTOR_RESISTANCE_OHM_PER_KM } from "../sizing/pec-table-3-10-1.js";

export const BRANCH_DROP_LIMIT = 0.03;
export const TOTAL_DROP_LIMIT = 0.05;

export function voltageDropPercent(
  circuit: Circuit,
  threePhase = false
): number {
  const resistancePerKm = CONDUCTOR_RESISTANCE_OHM_PER_KM[circuit.conductor.awg];

  if (resistancePerKm === undefined) {
    throw new Error(
      `No resistance data for conductor ${circuit.conductor.awg} AWG`
    );
  }

  const amps = circuit.connectedVa / circuit.voltage;
  const resistance = (resistancePerKm / 1000) * circuit.lengthM;
  const multiplier = threePhase ? Math.sqrt(3) : 2;
  const dropVolts = multiplier * amps * resistance;

  return dropVolts / circuit.voltage;
}

export function checkVoltageDrop(
  circuit: Circuit,
  options: { feederDropPercent?: number; threePhase?: boolean } = {}
): Violation[] {
  const violations: Violation[] = [];
  const branchDrop = voltageDropPercent(circuit, options.threePhase ?? false);
  const totalDrop = branchDrop + (options.feederDropPercent ?? 0);

  if (branchDrop > BRANCH_DROP_LIMIT) {
    violations.push({
      ruleId: "voltage-drop-branch",
      severity: "error",
      message:
        `Circuit ${circuit.id}: branch voltage drop ` +
        `${(branchDrop * 100).toFixed(2)}% exceeds the 3% branch limit ` +
        `(${circuit.lengthM.toFixed(1)} m run at ` +
        `${(circuit.connectedVa / circuit.voltage).toFixed(1)} A)`,
      circuitId: circuit.id,
      pecReference: "PEC voltage drop recommendation (3% branch)",
    });
  }

  if (totalDrop > TOTAL_DROP_LIMIT) {
    violations.push({
      ruleId: "voltage-drop-total",
      severity: "error",
      message:
        `Circuit ${circuit.id}: total voltage drop ` +
        `${(totalDrop * 100).toFixed(2)}% (branch + feeder) exceeds the 5% limit`,
      circuitId: circuit.id,
      pecReference: "PEC voltage drop recommendation (5% total)",
    });
  }

  return violations;
}
