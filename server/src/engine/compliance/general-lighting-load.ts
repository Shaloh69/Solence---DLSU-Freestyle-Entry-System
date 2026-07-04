/**
 * General lighting load basis check: the design's connected lighting VA
 * should not fall below the code's general-lighting unit load
 * (VA/m² of floor area) used as the minimum basis for load calculations.
 *
 * PEC-VERIFY: the VA/m² figure lives in load-calc/pec-demand-factors.ts
 * and is a placeholder pending verification.
 */
import { ElectricalLoad, Room, Violation } from "../types.js";
import { polygonArea } from "../geometry.js";
import { GENERAL_LIGHTING_VA_PER_SQM } from "../load-calc/pec-demand-factors.js";

export function checkGeneralLightingLoad(
  rooms: Room[],
  loads: ElectricalLoad[]
): Violation[] {
  if (rooms.length === 0) return [];

  const totalArea = rooms.reduce(
    (sum, room) => sum + polygonArea(room.boundary),
    0
  );

  if (totalArea <= 0) return [];

  const requiredVa = totalArea * GENERAL_LIGHTING_VA_PER_SQM;
  const lightingVa = loads
    .filter((load) => load.type === "lighting")
    .reduce((sum, load) => sum + load.va, 0);

  if (lightingVa < requiredVa) {
    return [
      {
        ruleId: "general-lighting-basis",
        severity: "warning",
        message:
          `Connected lighting load ${Math.round(lightingVa)} VA is below the ` +
          `general-lighting basis of ${Math.round(requiredVa)} VA ` +
          `(${GENERAL_LIGHTING_VA_PER_SQM} VA/m² × ${Math.round(totalArea)} m²) — ` +
          `size feeders using the code minimum, not the connected load`,
        pecReference: "PEC Section 2 general lighting unit load (PEC-VERIFY)",
      },
    ];
  }

  return [];
}
