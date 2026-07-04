/**
 * 80% continuous-load rule: continuous load on a breaker must not exceed
 * 80% of its rating (equivalently, the breaker must be sized at 125% of
 * continuous load). PEC-VERIFY: rule threshold assumed 80%; confirm the
 * PEC section wording and any exceptions for 100%-rated devices.
 */
import { Circuit, Violation } from "../types.js";

export const CONTINUOUS_LOAD_LIMIT = 0.8;

export function checkContinuousLoad(circuit: Circuit): Violation[] {
  const violations: Violation[] = [];
  const continuousAmps = circuit.continuousVa / circuit.voltage;
  const limitAmps = CONTINUOUS_LOAD_LIMIT * circuit.breakerAmps;

  if (continuousAmps > limitAmps + 1e-9) {
    violations.push({
      ruleId: "continuous-80",
      severity: "error",
      message:
        `Circuit ${circuit.id}: continuous load ${continuousAmps.toFixed(1)} A ` +
        `exceeds 80% of the ${circuit.breakerAmps} A breaker ` +
        `(limit ${limitAmps.toFixed(1)} A)`,
      circuitId: circuit.id,
      pecReference: "PEC 80% continuous-load rule (section pending verification)",
    });
  }

  return violations;
}
