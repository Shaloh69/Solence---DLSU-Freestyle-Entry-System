/**
 * Load calculation: branch circuit loads, PEC Section 2 demand factors,
 * feeder ampacity, and panel schedule computation.
 *
 * Pure functions over domain types. Demand-factor data lives in
 * pec-demand-factors.ts (PEC-VERIFY placeholders).
 */
import {
  Circuit,
  ElectricalLoad,
  Panel,
  PanelSchedule,
  PanelScheduleRow,
  Phase,
} from "../types.js";
import {
  DemandTier,
  FIXED_APPLIANCE_DEMAND_FACTOR,
  FIXED_APPLIANCE_MIN_COUNT,
  LIGHTING_DEMAND_TIERS,
} from "./pec-demand-factors.js";

/** Connected and continuous VA totals for a set of loads. */
export function branchCircuitLoad(loads: ElectricalLoad[]): {
  connectedVa: number;
  continuousVa: number;
} {
  let connectedVa = 0;
  let continuousVa = 0;

  for (const load of loads) {
    if (load.va < 0) throw new Error(`Load ${load.id} has negative VA`);
    connectedVa += load.va;
    if (load.continuous) continuousVa += load.va;
  }

  return { connectedVa, continuousVa };
}

/** Apply tiered demand factors to a connected VA total. */
export function applyDemandTiers(
  connectedVa: number,
  tiers: DemandTier[] = LIGHTING_DEMAND_TIERS
): number {
  let demand = 0;

  for (const tier of tiers) {
    if (connectedVa <= tier.fromVa) break;
    const inTier = Math.min(connectedVa, tier.toVa) - tier.fromVa;

    demand += inTier * tier.factor;
  }

  return demand;
}

/**
 * Demand VA for one circuit. Lighting and general-purpose outlets get the
 * tiered lighting demand; appliance-class loads may get the fixed-appliance
 * factor at the feeder level (see feederDemandVa), so per-circuit they
 * count at 100%.
 */
export function circuitDemandVa(circuit: Circuit, loads: ElectricalLoad[]): number {
  const circuitLoads = loads.filter((load) =>
    circuit.loadIds.includes(load.id)
  );
  const isGeneralLighting = circuitLoads.every(
    (load) => load.type === "lighting" || load.type === "outlet"
  );

  return isGeneralLighting
    ? applyDemandTiers(circuit.connectedVa)
    : circuit.connectedVa;
}

/**
 * Total feeder demand: tiered demand on the general lighting/receptacle
 * portion, fixed-appliance factor when four or more appliance-class
 * circuits exist, everything else at 100%.
 */
export function feederDemandVa(
  circuits: Circuit[],
  loads: ElectricalLoad[]
): number {
  const loadById = new Map(loads.map((load) => [load.id, load]));

  let lightingVa = 0;
  let applianceVa = 0;
  let applianceCircuitCount = 0;
  let otherVa = 0;

  for (const circuit of circuits) {
    const circuitLoads = circuit.loadIds
      .map((id) => loadById.get(id))
      .filter((load): load is ElectricalLoad => Boolean(load));
    const isGeneralLighting = circuitLoads.every(
      (load) => load.type === "lighting" || load.type === "outlet"
    );
    const isAppliance = circuitLoads.every(
      (load) => load.type === "appliance" || load.type === "laundry"
    );

    if (isGeneralLighting) {
      lightingVa += circuit.connectedVa;
    } else if (isAppliance) {
      applianceVa += circuit.connectedVa;
      applianceCircuitCount += 1;
    } else {
      otherVa += circuit.connectedVa;
    }
  }

  const applianceFactor =
    applianceCircuitCount >= FIXED_APPLIANCE_MIN_COUNT
      ? FIXED_APPLIANCE_DEMAND_FACTOR
      : 1.0;

  return (
    applyDemandTiers(lightingVa) + applianceVa * applianceFactor + otherVa
  );
}

/** Feeder current for a demand VA total on the given system voltage. */
export function feederAmps(
  demandVa: number,
  systemVoltage: number,
  threePhase: boolean
): number {
  if (systemVoltage <= 0) throw new Error("systemVoltage must be positive");

  return threePhase
    ? demandVa / (Math.sqrt(3) * systemVoltage)
    : demandVa / systemVoltage;
}

/** Build the full panel schedule from sized, phase-assigned circuits. */
export function buildPanelSchedule(
  panel: Panel,
  circuits: Circuit[],
  loads: ElectricalLoad[],
  mainBreakerAmps: number
): PanelSchedule {
  const rows: PanelScheduleRow[] = circuits.map((circuit, index) => ({
    circuitId: circuit.id,
    circuitNumber: index + 1,
    description: circuit.description,
    phase: circuit.phase,
    connectedVa: circuit.connectedVa,
    demandVa: Math.round(circuitDemandVa(circuit, loads)),
    breakerAmps: circuit.breakerAmps,
    conductor: `${circuit.conductor.mm2} mm² (${circuit.conductor.awg} AWG) ${circuit.conductor.insulation}`,
    wireLengthM: Math.round(circuit.lengthM * 10) / 10,
  }));

  const phaseVa: Record<Phase, number> = { A: 0, B: 0, C: 0 };

  for (const circuit of circuits) {
    phaseVa[circuit.phase] += circuit.connectedVa;
  }

  const totalConnectedVa = circuits.reduce(
    (sum, circuit) => sum + circuit.connectedVa,
    0
  );
  const totalDemandVa = Math.round(feederDemandVa(circuits, loads));
  const threePhase = panel.system === "3P4W-230/400";
  const systemVoltage = threePhase ? 400 : panelVoltage(panel);

  return {
    panelId: panel.id,
    system: panel.system,
    rows,
    totalConnectedVa,
    totalDemandVa,
    phaseVa,
    feederAmps:
      Math.round(feederAmps(totalDemandVa, systemVoltage, threePhase) * 10) /
      10,
    mainBreakerAmps,
  };
}

/** Line-to-line (or line-to-neutral for 2-wire) voltage of a panel system. */
export function panelVoltage(panel: Panel): number {
  switch (panel.system) {
    case "1P2W-120":
      return 120;
    case "1P3W-120/240":
      return 240;
    case "3P4W-230/400":
      return 400;
  }
}
