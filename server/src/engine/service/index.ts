/**
 * W7 service entrance (WIRING-AUDIT F-15): kWh meter, main breaker,
 * service conductors and grounding electrode conductor, sized from the
 * computed demand / main breaker. Pure functions; every code value comes
 * from pec-service.ts and the sizing tables (all PEC-VERIFY).
 *
 * Service conductors: copper, the project's insulation, every line + the
 * neutral at the same size; usable ampacity (insulation column × ambient
 * × conductor-count adjustment, capped by the termination column — 60 °C
 * for mains ≤ 100 A, 75 °C above) must reach the main breaker rating, so
 * the main protects them. Raceway by Chapter 9 fill like the branch runs.
 */
import type { InsulationType, ServiceEntrance, VoltageSystem } from "../types.js";
import { systemVoltageOf } from "../load-calc/dwelling.js";
import {
  adjustmentFactor,
  ambientCorrectionFactor,
  currentCarryingCount,
  sizeConductorForConditions,
  sizeConduit,
} from "../sizing/raceway.js";
import {
  GEC_REF,
  GEC_TABLE,
  GROUND_ROD,
  MAIN_BREAKER_POLES,
  MAIN_BREAKER_REF,
  METER_CLASSES_A,
  METER_REF,
  SERVICE_CONDUCTOR_REF,
  SERVICE_CONDUCTOR_ROLES,
} from "./pec-service.js";

export { buildOneLine, oneLinePrimitives, oneLineSvg } from "./one-line.js";
export type { OneLinePrimitive } from "./one-line.js";

/** Grounding electrode conductor for the largest service conductor (Table 2.50.3.17). */
export function sizeGroundingElectrodeConductor(serviceMm2: number): ServiceEntrance["groundingElectrodeConductor"] {
  const row = GEC_TABLE.find((r) => serviceMm2 <= r.maxServiceMm2);

  if (!row) throw new Error(`No grounding electrode conductor listed for a ${serviceMm2} mm² service`);

  return { awg: row.awg, mm2: row.mm2, serviceMm2, pecReference: GEC_REF };
}

export interface ServiceEntranceInput {
  system: VoltageSystem;
  mainBreakerAmps: number;
  mainBreakerSource: "manual" | "computed";
  demandVa: number;
  demandAmps: number;
  insulation: InsulationType;
  ambientTempC: number;
}

export function buildServiceEntrance(input: ServiceEntranceInput): ServiceEntrance {
  const { system, mainBreakerAmps, insulation, ambientTempC } = input;
  const threePhase = system === "3P4W-230/400";
  const roles = SERVICE_CONDUCTOR_ROLES[system];
  const wires = roles.length as 2 | 3 | 4;
  const phases = threePhase ? 3 : 1;
  const currentCarrying = currentCarryingCount(roles.map((role) => ({ role })));
  const conductor = sizeConductorForConditions(mainBreakerAmps, insulation, { ambientTempC, currentCarrying });
  const conductors = roles.map((role) => ({ role, awg: conductor.awg, mm2: conductor.mm2 }));
  const conduit = sizeConduit(conductors, insulation);
  const meterClass = METER_CLASSES_A.find((a) => a >= mainBreakerAmps);

  return {
    system,
    voltage: systemVoltageOf(system),
    phases,
    wires,
    demandVa: input.demandVa,
    demandAmps: input.demandAmps,
    meter: {
      kind: meterClass === undefined ? "CT-metered kWh meter" : "self-contained kWh meter",
      phases,
      wires,
      ratedAmps: meterClass ?? mainBreakerAmps,
      reference: METER_REF,
    },
    mainBreaker: {
      amps: mainBreakerAmps,
      poles: MAIN_BREAKER_POLES[system],
      source: input.mainBreakerSource,
      pecReference: MAIN_BREAKER_REF,
    },
    serviceConductors: {
      conductors,
      insulation,
      terminationTempC: conductor.terminationTempC,
      ambientTempC,
      ambientFactor: ambientCorrectionFactor(ambientTempC, insulation),
      currentCarrying,
      adjustmentFactor: adjustmentFactor(currentCarrying),
      ampacity: conductor.ampacity,
      raceway: conduit,
      pecReference: SERVICE_CONDUCTOR_REF,
    },
    groundingElectrodeConductor: sizeGroundingElectrodeConductor(conductor.mm2),
    groundingElectrode: { ...GROUND_ROD },
  };
}
