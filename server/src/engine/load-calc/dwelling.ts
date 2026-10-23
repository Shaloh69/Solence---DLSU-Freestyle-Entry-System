/**
 * PEC 2017 Article 2.20 standard dwelling load computation for the
 * feeder/main (W8, WIRING-AUDIT F-14).
 *
 *   1. general lighting = max(floor area × unit load, connected lighting +
 *      general-purpose receptacles) — the unit load covers both
 *   2. small-appliance circuits (kitchen/dining receptacles), min. 2, each
 *      at not less than 1500 VA
 *   3. laundry circuits, min. 1 when the plan has a laundry room, each at
 *      not less than 1500 VA
 *   4. lighting demand tiers on 1 + 2 + 3
 *   5. fixed appliances: 75 % when four or more
 *   6. air conditioning at 100 %
 *   7. motors / other equipment at 100 %
 *
 * Every code value is PEC-VERIFY and lives in pec-demand-factors.ts or
 * pec-dwelling-calc.ts.
 */
import { polygonArea } from "../geometry.js";
import {
  Circuit,
  DwellingCalcStep,
  DwellingLoadCalc,
  ElectricalLoad,
  Room,
  VoltageSystem,
} from "../types.js";
import {
  FIXED_APPLIANCE_DEMAND_FACTOR,
  FIXED_APPLIANCE_MIN_COUNT,
  GENERAL_LIGHTING_VA_PER_SQM,
  LIGHTING_DEMAND_TIERS,
  SMALL_APPLIANCE_CIRCUIT_VA,
} from "./pec-demand-factors.js";
import {
  AIR_CONDITIONING_DEMAND_FACTOR,
  DWELLING_AREA_EXCLUDED_ROOM_TYPES,
  DWELLING_CALC_REFS,
  LAUNDRY_ROOM_TYPES,
  MIN_LAUNDRY_CIRCUITS,
  MIN_SMALL_APPLIANCE_CIRCUITS,
  OTHER_LOAD_DEMAND_FACTOR,
  SMALL_APPLIANCE_ROOM_TYPES,
} from "./pec-dwelling-calc.js";

export interface DwellingCalcInput {
  rooms: Room[];
  circuits: Circuit[];
  loads: ElectricalLoad[];
  system: VoltageSystem;
}

/** Thousands-grouped integer VA, locale-independent ("11,192"). */
function va(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function pct(factor: number): string {
  return `${Math.round(factor * 100)}%`;
}

type Bucket = "general" | "small-appliance" | "laundry" | "fixed" | "ac" | "other";

function bucketOf(load: ElectricalLoad, roomById: Map<string, Room>): Bucket {
  const roomType = roomById.get(load.roomId ?? "")?.type;

  switch (load.type) {
    case "lighting":
      return "general";
    case "outlet":
      if (roomType && SMALL_APPLIANCE_ROOM_TYPES.includes(roomType)) return "small-appliance";
      if (roomType && LAUNDRY_ROOM_TYPES.includes(roomType)) return "laundry";
      return "general";
    case "laundry":
      return "laundry";
    case "appliance":
      return "fixed";
    case "hvac":
      return "ac";
    case "motor":
    case "equipment":
      return "other";
  }
}

/** Per-circuit VA "not less than" the unit per circuit, with a minimum circuit count. */
function circuitBlock(circuitVa: number[], minCircuits: number) {
  const onPlan = circuitVa.length;
  const counted = Math.max(onPlan, minCircuits);
  const total =
    circuitVa.reduce((sum, v) => sum + Math.max(SMALL_APPLIANCE_CIRCUIT_VA, v), 0) +
    (counted - onPlan) * SMALL_APPLIANCE_CIRCUIT_VA;
  const allAtUnit = circuitVa.every((v) => v <= SMALL_APPLIANCE_CIRCUIT_VA);
  let basis = allAtUnit
    ? `${counted} × ${va(SMALL_APPLIANCE_CIRCUIT_VA)} VA`
    : `${counted} circuits, each at least ${va(SMALL_APPLIANCE_CIRCUIT_VA)} VA`;

  if (counted > onPlan) basis += ` (min. ${minCircuits}; ${onPlan} on plan)`;

  return { counted, total, basis };
}

/** Lighting demand tiers, with the tier breakdown as text. */
function tieredDemand(subtotal: number): { demand: number; basis: string } {
  let demand = 0;
  const parts: string[] = [];

  for (const tier of LIGHTING_DEMAND_TIERS) {
    if (subtotal <= tier.fromVa) break;
    const inTier = Math.min(subtotal, tier.toVa) - tier.fromVa;

    demand += inTier * tier.factor;
    parts.push(`${va(inTier)} VA × ${pct(tier.factor)}`);
  }

  return { demand, basis: parts.length > 0 ? parts.join(" + ") : "0 VA" };
}

export function systemVoltageOf(system: VoltageSystem): number {
  switch (system) {
    case "1P2W-230":
      return 230;
    case "1P2W-120":
      return 120;
    case "1P3W-120/240":
      return 240;
    case "3P4W-230/400":
      return 400;
  }
}

export function dwellingLoadCalc(input: DwellingCalcInput): DwellingLoadCalc {
  const { rooms, circuits, loads, system } = input;
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const loadById = new Map(loads.map((load) => [load.id, load]));

  // 1. General lighting: unit load over the dwelling floor area.
  const floorAreaM2 = rooms
    .filter((room) => !DWELLING_AREA_EXCLUDED_ROOM_TYPES.includes(room.type))
    .reduce((sum, room) => sum + polygonArea(room.boundary), 0);
  const generalLightingBasisVa = floorAreaM2 * GENERAL_LIGHTING_VA_PER_SQM;

  let connectedGeneralVa = 0;
  let fixedApplianceCount = 0;
  let fixedApplianceConnectedVa = 0;
  let airConditioningVa = 0;
  let airConditioningUnits = 0;
  let otherVa = 0;
  const smallApplianceCircuitVa: number[] = [];
  const laundryCircuitVa: number[] = [];

  for (const circuit of circuits) {
    let saVa = 0;
    let laundryVa = 0;
    let hasSa = false;
    let hasLaundry = false;

    for (const id of circuit.loadIds) {
      const load = loadById.get(id);

      if (!load) continue;
      switch (bucketOf(load, roomById)) {
        case "general":
          connectedGeneralVa += load.va;
          break;
        case "small-appliance":
          hasSa = true;
          saVa += load.va;
          break;
        case "laundry":
          hasLaundry = true;
          laundryVa += load.va;
          break;
        case "fixed":
          fixedApplianceCount += 1;
          fixedApplianceConnectedVa += load.va;
          break;
        case "ac":
          airConditioningUnits += 1;
          airConditioningVa += load.va;
          break;
        case "other":
          otherVa += load.va;
          break;
      }
    }
    if (hasSa) smallApplianceCircuitVa.push(saVa);
    if (hasLaundry) laundryCircuitVa.push(laundryVa);
  }

  const generalLightingVa = Math.max(generalLightingBasisVa, connectedGeneralVa);
  const generalLightingSource =
    generalLightingBasisVa >= connectedGeneralVa ? "unit-load" : "connected";

  // 2–3. Small-appliance and laundry circuits.
  const needsSmallAppliance = rooms.some((room) =>
    SMALL_APPLIANCE_ROOM_TYPES.includes(room.type)
  );
  const needsLaundry = rooms.some((room) => LAUNDRY_ROOM_TYPES.includes(room.type));
  const sa = circuitBlock(
    smallApplianceCircuitVa,
    needsSmallAppliance ? MIN_SMALL_APPLIANCE_CIRCUITS : 0
  );
  const laundry = circuitBlock(laundryCircuitVa, needsLaundry ? MIN_LAUNDRY_CIRCUITS : 0);

  // 4. Lighting demand tiers.
  const generalSubtotalVa = generalLightingVa + sa.total + laundry.total;
  const tiers = tieredDemand(generalSubtotalVa);

  // 5–7. Fixed appliances, A/C, other.
  const fixedApplianceFactor =
    fixedApplianceCount >= FIXED_APPLIANCE_MIN_COUNT ? FIXED_APPLIANCE_DEMAND_FACTOR : 1.0;
  const fixedApplianceDemandVa = fixedApplianceConnectedVa * fixedApplianceFactor;
  const airConditioningDemandVa = airConditioningVa * AIR_CONDITIONING_DEMAND_FACTOR;
  const otherDemandVa = otherVa * OTHER_LOAD_DEMAND_FACTOR;

  const demandVa =
    tiers.demand + fixedApplianceDemandVa + airConditioningDemandVa + otherDemandVa;
  const threePhase = system === "3P4W-230/400";
  const systemVoltage = systemVoltageOf(system);
  const demandAmps = threePhase
    ? demandVa / (Math.sqrt(3) * systemVoltage)
    : demandVa / systemVoltage;

  const steps: DwellingCalcStep[] = [
    {
      id: "general-lighting",
      label: "General lighting and receptacles",
      basis:
        `${floorAreaM2.toFixed(1)} m² × ${GENERAL_LIGHTING_VA_PER_SQM} VA/m² ` +
        `(connected ${va(connectedGeneralVa)} VA)`,
      va: generalLightingVa,
      pecReference: DWELLING_CALC_REFS.generalLighting,
    },
    {
      id: "small-appliance",
      label: "Small-appliance circuits",
      basis: sa.basis,
      va: sa.total,
      pecReference: DWELLING_CALC_REFS.smallAppliance,
    },
    {
      id: "laundry",
      label: "Laundry circuits",
      basis: laundry.basis,
      va: laundry.total,
      pecReference: DWELLING_CALC_REFS.laundry,
    },
    {
      id: "general-subtotal",
      label: "Subtotal before demand factors",
      basis: `${va(generalLightingVa)} + ${va(sa.total)} + ${va(laundry.total)} VA`,
      va: generalSubtotalVa,
      pecReference: DWELLING_CALC_REFS.lightingDemand,
    },
    {
      id: "lighting-demand",
      label: "Lighting demand",
      basis: tiers.basis,
      va: tiers.demand,
      pecReference: DWELLING_CALC_REFS.lightingDemand,
    },
    {
      id: "fixed-appliance",
      label: "Fixed appliances",
      basis: `${fixedApplianceCount} appliances, ${va(fixedApplianceConnectedVa)} VA × ${pct(fixedApplianceFactor)}`,
      va: fixedApplianceDemandVa,
      pecReference: DWELLING_CALC_REFS.fixedAppliance,
    },
    {
      id: "air-conditioning",
      label: "Air conditioning",
      basis: `${airConditioningUnits} units, ${va(airConditioningVa)} VA × ${pct(AIR_CONDITIONING_DEMAND_FACTOR)}`,
      va: airConditioningDemandVa,
      pecReference: DWELLING_CALC_REFS.airConditioning,
    },
    {
      id: "other",
      label: "Motors and other loads",
      basis: `${va(otherVa)} VA × ${pct(OTHER_LOAD_DEMAND_FACTOR)}`,
      va: otherDemandVa,
      pecReference: DWELLING_CALC_REFS.other,
    },
    {
      id: "total-demand",
      label: "Total demand (feeder/main)",
      basis:
        `${va(demandVa)} VA ÷ ${threePhase ? `(1.732 × ${systemVoltage} V)` : `${systemVoltage} V`}` +
        ` = ${demandAmps.toFixed(1)} A`,
      va: demandVa,
      pecReference: DWELLING_CALC_REFS.feeder,
    },
  ];

  return {
    floorAreaM2,
    unitLoadVaPerM2: GENERAL_LIGHTING_VA_PER_SQM,
    generalLightingBasisVa,
    connectedGeneralVa,
    generalLightingVa,
    generalLightingSource,
    smallApplianceCircuits: sa.counted,
    smallApplianceVa: sa.total,
    laundryCircuits: laundry.counted,
    laundryVa: laundry.total,
    generalSubtotalVa,
    generalDemandVa: tiers.demand,
    fixedApplianceCount,
    fixedApplianceConnectedVa,
    fixedApplianceFactor,
    fixedApplianceDemandVa,
    airConditioningVa,
    airConditioningFactor: AIR_CONDITIONING_DEMAND_FACTOR,
    airConditioningDemandVa,
    otherVa: otherDemandVa,
    demandVa,
    systemVoltage,
    demandAmps,
    steps,
  };
}
