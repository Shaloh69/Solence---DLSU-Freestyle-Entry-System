/**
 * PEC compliance engine. Each rule lives in its own file, pure functions
 * in -> violations out. Circuit-level rules run per sized circuit;
 * project-level rules (GFCI, illuminance, required circuits, spacing) run
 * over rooms + loads. The general-lighting unit load is no longer a
 * warning: it is used in the PEC 2.20 feeder calc (load-calc/dwelling.ts, W8).
 */
import { Circuit, ElectricalLoad, Room, Violation } from "../types.js";
import { checkAmpacity } from "./ampacity.js";
import { checkContinuousLoad } from "./continuous-load.js";
import { checkVoltageDrop } from "./voltage-drop.js";
import { checkGfci } from "./gfci.js";
import { checkRoomIlluminance } from "./lighting-illuminance.js";
import { checkEgressLighting } from "./egress-lighting.js";
import { checkSmallConductor } from "./small-conductor.js";
import { checkRequiredBranchCircuits } from "./required-branch-circuits.js";
import { checkReceptacleSpacing } from "./receptacle-spacing.js";

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
export { checkEgressLighting } from "./egress-lighting.js";
export { checkSmallConductor } from "./small-conductor.js";
export { checkRequiredBranchCircuits } from "./required-branch-circuits.js";
export { checkReceptacleSpacing } from "./receptacle-spacing.js";
export { generatePanelDirectory } from "./panel-directory.js";
export type { PanelDirectoryEntry } from "./panel-directory.js";

export interface ComplianceOptions {
  feederDropPercent?: number;
  threePhase?: boolean;
}

/** Circuit-level rules (ampacity, 80% continuous, voltage drop, egress separation). */
export function runComplianceChecks(
  circuits: Circuit[],
  loads: ElectricalLoad[],
  options: ComplianceOptions = {}
): Violation[] {
  return circuits.flatMap((circuit) => [
    ...checkAmpacity(circuit),
    ...checkSmallConductor(circuit),
    ...checkContinuousLoad(circuit),
    ...checkVoltageDrop(circuit, options),
    ...checkEgressLighting(circuit, loads),
  ]);
}

/** Project-level rules over rooms and loads. */
export function runProjectChecks(
  rooms: Room[],
  loads: ElectricalLoad[],
  circuits: Circuit[] = []
): Violation[] {
  return [
    ...checkGfci(rooms, loads),
    ...checkRequiredBranchCircuits(rooms, loads, circuits),
    ...checkReceptacleSpacing(rooms, loads),
    ...checkRoomIlluminance(rooms, loads),
  ];
}
