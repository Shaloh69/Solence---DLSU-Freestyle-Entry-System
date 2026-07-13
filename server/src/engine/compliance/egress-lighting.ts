/**
 * Emergency/egress lighting circuit separation (brief §9.1, commercial
 * scope): exit and egress fixtures must sit on a circuit dedicated to
 * egress use, not sharing a circuit with general loads — so a fault or
 * breaker trip on a general circuit can never take egress lighting with
 * it.
 *
 * PEC-VERIFY: the dedicated-circuit requirement follows the familiar
 * NEC 700/701-style emergency-circuit separation pattern; the exact PEC
 * section and its scope must be confirmed by a licensed EE.
 */
import { Circuit, ElectricalLoad, Violation } from "../types.js";

export function checkEgressLighting(
  circuit: Circuit,
  loads: ElectricalLoad[]
): Violation[] {
  const loadById = new Map(loads.map((load) => [load.id, load]));
  const circuitLoads = circuit.loadIds
    .map((id) => loadById.get(id))
    .filter((load): load is ElectricalLoad => Boolean(load));

  const egressLoads = circuitLoads.filter((load) => load.egress);

  if (egressLoads.length === 0) return [];
  if (egressLoads.length === circuitLoads.length) return [];

  const names = egressLoads.map((load) => load.name).join(", ");

  return [
    {
      ruleId: "egress-dedicated-circuit",
      severity: "error",
      message:
        `Egress/emergency fixture${egressLoads.length === 1 ? "" : "s"} ` +
        `(${names}) on circuit ${circuit.description} shares a circuit ` +
        `with general loads — egress lighting must be on a circuit ` +
        `dedicated to egress use`,
      circuitId: circuit.id,
      pecReference: "PEC emergency circuit separation (section pending verification)",
    },
  ];
}
