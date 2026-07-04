/**
 * Room illuminance check: does the placed lighting actually achieve a
 * compliant lux level for each room? This is where the ported
 * photometric engine earns its keep — the rule simulates illuminance,
 * it doesn't just count wattage.
 *
 * LIGHTING-VERIFY: target values and the acceptable band live in
 * lighting/lighting-data.ts and are placeholders pending verification.
 */
import { ElectricalLoad, Room, Violation } from "../types.js";
import {
  analyzeRoomLighting,
  ILLUMINANCE_MAX_RATIO,
  ILLUMINANCE_MIN_RATIO,
} from "../lighting/index.js";

export function checkRoomIlluminance(
  rooms: Room[],
  loads: ElectricalLoad[]
): Violation[] {
  const violations: Violation[] = [];

  for (const analysis of analyzeRoomLighting(rooms, loads)) {
    if (analysis.fixtureCount === 0) {
      violations.push({
        ruleId: "illuminance-none",
        severity: "warning",
        message: `${analysis.roomName} has no lighting fixtures (target ${analysis.targetLux} lux)`,
        pecReference: "IES recommended practice (LIGHTING-VERIFY)",
      });
      continue;
    }

    const min = analysis.targetLux * ILLUMINANCE_MIN_RATIO;
    const max = analysis.targetLux * ILLUMINANCE_MAX_RATIO;
    const estimatedNote = analysis.fluxEstimated
      ? " (fixture flux estimated from VA)"
      : "";

    if (analysis.averageLux < min) {
      violations.push({
        ruleId: "illuminance-low",
        severity: "warning",
        message:
          `${analysis.roomName} is under-lit: ~${analysis.averageLux} lux average ` +
          `vs ${analysis.targetLux} lux target${estimatedNote}`,
        pecReference: "IES recommended practice (LIGHTING-VERIFY)",
      });
    } else if (analysis.averageLux > max) {
      violations.push({
        ruleId: "illuminance-high",
        severity: "warning",
        message:
          `${analysis.roomName} is over-lit: ~${analysis.averageLux} lux average ` +
          `vs ${analysis.targetLux} lux target — consider fewer/lower-flux fixtures${estimatedNote}`,
        pecReference: "IES recommended practice (LIGHTING-VERIFY)",
      });
    }
  }

  return violations;
}
