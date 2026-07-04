/**
 * Auto-circuit builder: groups placed loads into branch circuits, sizes
 * each one, and balances circuits across the panel's phases.
 *
 * Grouping heuristic: loads combine onto a shared circuit when they are
 * in the same room, of the same type, and at the same voltage — splitting
 * whenever adding the next load would push the circuit past a target
 * connected VA (default: what a 20 A breaker serves at 80%). Dedicated
 * load types (hvac, motor, equipment, appliance) always get their own
 * circuit, matching common design practice.
 */
import {
  Circuit,
  ElectricalLoad,
  InsulationType,
  Panel,
  Phase,
  RoutedPath,
} from "./types.js";
import { balancePhases, sizeBranchCircuit } from "./sizing/index.js";

export interface CircuitBuilderOptions {
  /** Max connected VA per shared circuit. Default: 0.8 × 20 A × voltage. */
  maxVaPerCircuit?: number;
  insulation?: InsulationType;
}

const DEDICATED_TYPES: ElectricalLoad["type"][] = [
  "appliance",
  "hvac",
  "motor",
  "equipment",
];

export function buildCircuits(
  loads: ElectricalLoad[],
  panel: Panel,
  routes: RoutedPath[],
  options: CircuitBuilderOptions = {}
): Circuit[] {
  const insulation = options.insulation ?? "THHN";
  const routeByLoad = new Map(routes.map((route) => [route.loadId, route]));

  // 1. Group loads.
  const groups: ElectricalLoad[][] = [];
  const shared = new Map<string, ElectricalLoad[]>();

  for (const load of loads) {
    if (DEDICATED_TYPES.includes(load.type)) {
      groups.push([load]);
      continue;
    }

    const key = `${load.roomId ?? "no-room"}|${load.type}|${load.voltage}`;
    const bucket = shared.get(key) ?? [];

    bucket.push(load);
    shared.set(key, bucket);
  }

  for (const bucket of shared.values()) {
    const maxVa =
      options.maxVaPerCircuit ?? 0.8 * 20 * (bucket[0]?.voltage ?? 230);
    let current: ElectricalLoad[] = [];
    let currentVa = 0;

    for (const load of bucket) {
      if (current.length > 0 && currentVa + load.va > maxVa) {
        groups.push(current);
        current = [];
        currentVa = 0;
      }
      current.push(load);
      currentVa += load.va;
    }
    if (current.length > 0) groups.push(current);
  }

  // 2. Size each group into a circuit.
  const circuits: Circuit[] = groups.map((groupLoads, index) => {
    const connectedVa = groupLoads.reduce((sum, load) => sum + load.va, 0);
    const continuousVa = groupLoads
      .filter((load) => load.continuous)
      .reduce((sum, load) => sum + load.va, 0);
    const voltage = groupLoads[0].voltage;
    const { breakerAmps, conductor } = sizeBranchCircuit(
      connectedVa,
      continuousVa,
      voltage,
      insulation
    );
    const lengthM = Math.max(
      0,
      ...groupLoads.map((load) => routeByLoad.get(load.id)?.lengthM ?? 0)
    );

    return {
      id: `ckt-${index + 1}`,
      description: describeGroup(groupLoads),
      loadIds: groupLoads.map((load) => load.id),
      connectedVa,
      continuousVa,
      voltage,
      phase: "A" as Phase, // balanced below
      breakerAmps,
      conductor,
      lengthM,
    };
  });

  // 3. Balance across the panel's legs.
  const legs: Phase[] =
    panel.system === "3P4W-230/400"
      ? ["A", "B", "C"]
      : panel.system === "1P3W-120/240"
        ? ["A", "B"]
        : ["A"];
  const { assignments } = balancePhases(
    circuits.map((circuit) => ({ id: circuit.id, va: circuit.connectedVa })),
    legs
  );

  for (const circuit of circuits) {
    circuit.phase = assignments[circuit.id];
  }

  return circuits;
}

function describeGroup(loads: ElectricalLoad[]): string {
  const types = [...new Set(loads.map((load) => load.type))];

  if (loads.length === 1) return loads[0].name;

  return `${types.join("/")} circuit (${loads.length} loads)`;
}
