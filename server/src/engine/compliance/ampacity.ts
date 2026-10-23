/**
 * Wire ampacity check (PEC Table 3.10.1 + 1.10.1.14(C) terminations,
 * W6: + 3.10.1.15(B)(2)(a) ambient correction and 3.10.1.15(B)(3)(a)
 * adjustment for more than three current-carrying conductors).
 *
 * A conductor must be rated at or above its overcurrent device: a breaker
 * that outrates its wire lets the wire overheat before tripping. The
 * rating used is the USABLE one — the lower of the insulation column and
 * the termination column (60 °C for circuits ≤100 A), and, once the
 * wiring is sized, the insulation column corrected for the ambient and
 * adjusted for the conductor count — recomputed from the tables, never
 * trusted from the circuit record.
 * PEC-VERIFY: table values are placeholders; see pec-table-3-10-1.ts and
 * pec-derating.ts.
 */
import { Circuit, Violation } from "../types.js";
import { PEC_TABLE_3_10_1 } from "../sizing/pec-table-3-10-1.js";
import { effectiveAmpacity, terminationTempFor } from "../sizing/index.js";
import { deratedAmpacity } from "../sizing/raceway.js";
import { TERMINATION_REF } from "../sizing/pec-overcurrent.js";
import { ADJUSTMENT_REF, AMBIENT_CORRECTION_REF } from "../sizing/pec-derating.js";

export function checkAmpacity(circuit: Circuit): Violation[] {
  const row = PEC_TABLE_3_10_1.find((r) => r.awg === circuit.conductor.awg);
  const termination = terminationTempFor(circuit.breakerAmps);
  const derating = circuit.derating;
  let usable = row
    ? effectiveAmpacity(row, circuit.conductor.insulation, termination)
    : circuit.conductor.ampacity;

  if (row && derating) {
    try {
      usable = deratedAmpacity(row, circuit.conductor.insulation, termination, {
        ambientTempC: derating.ambientTempC,
        currentCarrying: derating.maxCurrentCarrying,
      });
    } catch {
      usable = 0; // insulation not permitted at this ambient
    }
  }

  if (usable >= circuit.breakerAmps) return [];

  const conditions = derating
    ? ` after correction for ${derating.ambientTempC} °C ambient and ` +
      `${derating.maxCurrentCarrying} current-carrying conductors in a raceway`
    : "";

  return [
    {
      ruleId: "ampacity",
      severity: "error",
      message:
        `Circuit ${circuit.id}: conductor ${circuit.conductor.mm2} mm² ` +
        `(${circuit.conductor.awg} AWG ${circuit.conductor.insulation}) is good for ` +
        `${Math.round(usable * 100) / 100} A at ${termination} °C terminals${conditions} ` +
        `but is protected by a ${circuit.breakerAmps} A breaker`,
      circuitId: circuit.id,
      pecReference: derating
        ? `PEC Table 3.10.1; ${TERMINATION_REF}; ${AMBIENT_CORRECTION_REF}; ${ADJUSTMENT_REF}`
        : `PEC Table 3.10.1; ${TERMINATION_REF}`,
    },
  ];
}
