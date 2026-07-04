/**
 * PEC compliance engine. Each rule lives in its own file, pure functions
 * in -> violations out. Circuit-level rules run per sized circuit;
 * project-level rules (GFCI, illuminance, general-lighting basis) run
 * over rooms + loads.
 */
import { Circuit, ElectricalLoad, Room, Violation } from "../types.js";
import { checkAmpacity } from "./ampacity.js";
import { checkContinuousLoad } from "./continuous-load.js";
import { checkVoltageDrop } from "./voltage-drop.js";
import { checkGfci } from "./gfci.js";
import { checkRoomIlluminance } from "./lighting-illuminance.js";
import { checkGeneralLightingLoad } from "./general-lighting-load.js";

export { checkAmpacity } from "./ampacity.js";
export { checkContinuousLoad, CONTINUOUS_LOAD_LIMIT } from "./continuous-load.js";
export {
  checkVoltageDrop,
  voltageDropPercent,
  BRANCH_DROP_LIMIT,
  TOTAL_DROP_LIMIT,
} from "./voltage-drop.js";
export { checkGfci, GFCI_ROOM_TYPES } from "./gfci.js";
export { checkRoomIlluminance } from "./lighting-illuminance.js";
export { checkGeneralLightingLoad } from "./general-lighting-load.js";
export { generatePanelDirectory } from "./panel-directory.js";
export type { PanelDirectoryEntry } from "./panel-directory.js";

export interface ComplianceOptions {
  feederDropPercent?: number;
  threePhase?: boolean;
}

/** Circuit-level rules (ampacity, 80% continuous, voltage drop). */
export function runComplianceChecks(
  circuits: Circuit[],
  options: ComplianceOptions = {}
): Violation[] {
  return circuits.flatMap((circuit) => [
    ...checkAmpacity(circuit),
    ...checkContinuousLoad(circuit),
    ...checkVoltageDrop(circuit, options),
  ]);
}

/** Project-level rules over rooms and loads. */
export function runProjectChecks(
  rooms: Room[],
  loads: ElectricalLoad[]
): Violation[] {
  return [
    ...checkGfci(rooms, loads),
    ...checkRoomIlluminance(rooms, loads),
    ...checkGeneralLightingLoad(rooms, loads),
  ];
}
