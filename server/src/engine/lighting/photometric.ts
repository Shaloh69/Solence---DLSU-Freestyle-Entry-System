/**
 * Lumen-method photometric core, ported from the original BEPVY_Sims
 * illumination engine (context/LightingProvider.tsx) into pure,
 * unit-testable functions. This is the "near maximum power and material
 * efficiency" solver the product started life as: fewest lamps of a
 * given flux meeting a target illuminance.
 */
import {
  ContaminationLevel,
  MAINTENANCE_FACTOR_TABLE,
  MaintenanceIntervalYears,
} from "./lighting-data.js";

export interface PhotometricEnv {
  /** Room cavity height inputs, meters. */
  ceilingHeight: number;
  workplaneHeight: number;
  ceilingReflectance: number;
  wallReflectance: number;
  contamination: ContaminationLevel;
  maintenanceIntervalYears: MaintenanceIntervalYears;
}

/** Room Cavity Ratio for a rectangular cavity. */
export function roomCavityRatio(
  length: number,
  width: number,
  ceilingHeight: number,
  workplaneHeight: number
): number {
  if (length <= 0 || width <= 0) {
    throw new Error("Room dimensions must be positive");
  }
  const cavityHeight = ceilingHeight - workplaneHeight;

  return (5 * cavityHeight * (length + width)) / (length * width);
}

/**
 * Coefficient of Utilization — same simplified model as the original
 * engine (base CU derated by RCR and boosted by surface reflectances,
 * clamped to [0.3, 0.85]).
 */
export function coefficientOfUtilization(
  rcr: number,
  ceilingReflectance: number,
  wallReflectance: number
): number {
  const baseCU = 0.85;
  const rcrFactor = 1 - (rcr - 1) * 0.05;
  const reflectanceFactor =
    0.7 + (0.3 * (ceilingReflectance + wallReflectance)) / 2;
  const cu = baseCU * rcrFactor * reflectanceFactor;

  return Math.max(0.3, Math.min(0.85, cu));
}

export function maintenanceFactor(
  contamination: ContaminationLevel,
  intervalYears: MaintenanceIntervalYears
): number {
  return MAINTENANCE_FACTOR_TABLE[contamination][intervalYears];
}

/** Lumen method: N = (E × A) / (Φ × CU × MF), rounded up. */
export function requiredLampCount(
  targetLux: number,
  areaM2: number,
  fluxPerLampLm: number,
  cu: number,
  mf: number
): number {
  if (fluxPerLampLm <= 0) throw new Error("fluxPerLampLm must be positive");

  return Math.ceil((targetLux * areaM2) / (fluxPerLampLm * cu * mf));
}

/** Average illuminance produced by a total installed flux. */
export function averageIlluminance(
  totalFluxLm: number,
  cu: number,
  mf: number,
  areaM2: number
): number {
  if (areaM2 <= 0) return 0;

  return (totalFluxLm * cu * mf) / areaM2;
}

export interface LampLayout {
  rows: number;
  columns: number;
  lengthSpacing: number;
  widthSpacing: number;
}

/** Grid layout matching the room aspect ratio (ported). */
export function gridLayout(
  lampCount: number,
  roomLength: number,
  roomWidth: number
): LampLayout {
  const aspectRatio = roomLength / roomWidth;
  let columns = Math.max(1, Math.round(Math.sqrt(lampCount * aspectRatio)));
  let rows = Math.max(1, Math.round(lampCount / columns));

  while (rows * columns < lampCount) {
    if (columns / rows < aspectRatio) columns++;
    else rows++;
  }

  return {
    rows,
    columns,
    lengthSpacing: roomLength / columns,
    widthSpacing: roomWidth / rows,
  };
}

/**
 * Centered grid positions (room-local coordinates, meters), capped at
 * lampCount. z is the mounting height.
 */
export function lampPositions(
  layout: LampLayout,
  lampCount: number,
  mountingHeight: number
): { x: number; y: number; z: number }[] {
  const positions: { x: number; y: number; z: number }[] = [];
  const lengthOffset = layout.lengthSpacing / 2;
  const widthOffset = layout.widthSpacing / 2;

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.columns; col++) {
      if (positions.length >= lampCount) return positions;
      positions.push({
        x: lengthOffset + col * layout.lengthSpacing,
        y: widthOffset + row * layout.widthSpacing,
        z: mountingHeight,
      });
    }
  }

  return positions;
}

/**
 * Point illuminance from a set of lamps (inverse-square, ported from the
 * original engine's grid calculator).
 */
export function illuminanceAtPoint(
  x: number,
  y: number,
  lamps: { x: number; y: number; z: number; fluxLm: number }[],
  workplaneHeight: number,
  cu: number,
  mf: number
): number {
  return lamps.reduce((sum, lamp) => {
    const dx = lamp.x - x;
    const dy = lamp.y - y;
    const dz = lamp.z - workplaneHeight;
    const distanceSq = dx * dx + dy * dy + dz * dz;

    if (distanceSq === 0) return sum;

    return sum + (lamp.fluxLm * cu * mf) / (4 * Math.PI * distanceSq);
  }, 0);
}
