/**
 * Wire ampacity check against PEC Table 3.10.1.
 *
 * A conductor must be rated at or above its overcurrent device: a breaker
 * that outrates its wire lets the wire overheat before tripping.
 * PEC-VERIFY: table values are placeholders; see pec-table-3-10-1.ts.
 */
import { Circuit, Violation } from "../types.js";

export function checkAmpacity(circuit: Circuit): Violation[] {
  const violations: Violation[] = [];

  if (circuit.conductor.ampacity < circuit.breakerAmps) {
    violations.push({
      ruleId: "ampacity",
      severity: "error",
      message:
        `Circuit ${circuit.id}: conductor ${circuit.conductor.mm2} mm² ` +
        `(${circuit.conductor.awg} AWG ${circuit.conductor.insulation}) is rated ` +
        `${circuit.conductor.ampacity} A but is protected by a ` +
        `${circuit.breakerAmps} A breaker`,
      circuitId: circuit.id,
      pecReference: "PEC Table 3.10.1",
    });
  }

  return violations;
}
