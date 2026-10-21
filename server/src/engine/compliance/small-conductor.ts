/**
 * Small-conductor rule (PEC 2017 2.40.1.4(D)): 2.0 mm² copper may not be
 * protected above 15 A, 3.5 mm² above 20 A, 5.5 mm² above 30 A —
 * regardless of the insulation's higher table ampacity.
 */
import { Circuit, Violation } from "../types.js";
import { smallConductorLimit } from "../sizing/index.js";
import { SMALL_CONDUCTOR_REF } from "../sizing/pec-overcurrent.js";

export function checkSmallConductor(circuit: Circuit): Violation[] {
  const limit = smallConductorLimit(circuit.conductor.mm2);

  if (circuit.breakerAmps <= limit) return [];

  return [
    {
      ruleId: "small-conductor",
      severity: "error",
      message:
        `Circuit ${circuit.id}: ${circuit.conductor.mm2} mm² copper may be ` +
        `protected at no more than ${limit} A, but has a ${circuit.breakerAmps} A breaker`,
      circuitId: circuit.id,
      pecReference: SMALL_CONDUCTOR_REF,
    },
  ];
}
