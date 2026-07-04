/**
 * PEC compliance engine: run every rule over a set of sized circuits.
 * Each rule lives in its own file, pure functions in -> violations out.
 */
import { Circuit, Violation } from "../types.js";
import { checkAmpacity } from "./ampacity.js";
import { checkContinuousLoad } from "./continuous-load.js";
import { checkVoltageDrop } from "./voltage-drop.js";

export { checkAmpacity } from "./ampacity.js";
export { checkContinuousLoad, CONTINUOUS_LOAD_LIMIT } from "./continuous-load.js";
export {
  checkVoltageDrop,
  voltageDropPercent,
  BRANCH_DROP_LIMIT,
  TOTAL_DROP_LIMIT,
} from "./voltage-drop.js";
export { generatePanelDirectory } from "./panel-directory.js";
export type { PanelDirectoryEntry } from "./panel-directory.js";

export interface ComplianceOptions {
  feederDropPercent?: number;
  threePhase?: boolean;
}

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
