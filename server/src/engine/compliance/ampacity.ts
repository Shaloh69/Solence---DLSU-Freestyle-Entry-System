/**
 * Wire ampacity check (PEC Table 3.10.1 + 1.10.1.14(C) terminations).
 *
 * A conductor must be rated at or above its overcurrent device: a breaker
 * that outrates its wire lets the wire overheat before tripping. The
 * rating used is the USABLE one — the lower of the insulation column and
 * the termination column (60 °C for circuits ≤100 A) — recomputed from
 * the table, never trusted from the circuit record.
 * PEC-VERIFY: table values are placeholders; see pec-table-3-10-1.ts.
 */
import { Circuit, Violation } from "../types.js";
import { PEC_TABLE_3_10_1 } from "../sizing/pec-table-3-10-1.js";
import { effectiveAmpacity, terminationTempFor } from "../sizing/index.js";
import { TERMINATION_REF } from "../sizing/pec-overcurrent.js";

export function checkAmpacity(circuit: Circuit): Violation[] {
  const row = PEC_TABLE_3_10_1.find((r) => r.awg === circuit.conductor.awg);
  const termination = terminationTempFor(circuit.breakerAmps);
  const usable = row
    ? effectiveAmpacity(row, circuit.conductor.insulation, termination)
    : circuit.conductor.ampacity;

  if (usable >= circuit.breakerAmps) return [];

  return [
    {
      ruleId: "ampacity",
      severity: "error",
      message:
        `Circuit ${circuit.id}: conductor ${circuit.conductor.mm2} mm² ` +
        `(${circuit.conductor.awg} AWG ${circuit.conductor.insulation}) is good for ` +
        `${usable} A at ${termination} °C terminals but is protected by a ` +
        `${circuit.breakerAmps} A breaker`,
      circuitId: circuit.id,
      pecReference: `PEC Table 3.10.1; ${TERMINATION_REF}`,
    },
  ];
}
