/**
 * Required dwelling branch circuits (PEC 2017 2.10.1.11(C)): receptacles
 * in kitchens/dining (small-appliance), laundry and bathrooms must be on
 * 20 A branch circuits.
 */
import { Circuit, ElectricalLoad, Room, Violation } from "../types.js";
import {
  REQUIRED_20A_ROOM_TYPES,
  REQUIRED_CIRCUIT_MIN_A,
  REQUIRED_CIRCUIT_REF,
} from "../sizing/pec-overcurrent.js";

export function checkRequiredBranchCircuits(
  rooms: Room[],
  loads: ElectricalLoad[],
  circuits: Circuit[]
): Violation[] {
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const loadById = new Map(loads.map((load) => [load.id, load]));
  const violations: Violation[] = [];

  for (const circuit of circuits) {
    if (circuit.breakerAmps >= REQUIRED_CIRCUIT_MIN_A) continue;
    const served = circuit.loadIds
      .map((id) => loadById.get(id))
      .filter((load): load is ElectricalLoad => load?.type === "outlet")
      .map((load) => roomById.get(load.roomId ?? ""))
      .filter((room): room is Room =>
        Boolean(room && (REQUIRED_20A_ROOM_TYPES as readonly string[]).includes(room.type))
      );

    if (served.length === 0) continue;
    const names = [...new Set(served.map((room) => room.name))].join(", ");

    violations.push({
      ruleId: "required-branch-circuit",
      severity: "error",
      message:
        `Circuit ${circuit.id} feeds receptacles in ${names} at ${circuit.breakerAmps} A — ` +
        `these require a ${REQUIRED_CIRCUIT_MIN_A} A branch circuit`,
      circuitId: circuit.id,
      pecReference: REQUIRED_CIRCUIT_REF,
    });
  }

  return violations;
}
