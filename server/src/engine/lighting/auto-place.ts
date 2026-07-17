/**
 * Auto-generation of lighting fixtures per room: lumen-method fixture
 * count for the room's target lux, laid out on a centered grid clipped
 * to the room polygon. Output fixtures are ordinary ElectricalLoads
 * (type "lighting", with lumens) — they flow into the same circuits,
 * sizing, routing, and compliance as every other load.
 */
import { ElectricalLoad, Room } from "../types.js";
import {
  polygonArea,
  polygonBounds,
  polygonCentroid,
  pointInPolygon,
} from "../geometry.js";
import {
  DEFAULT_CEILING_HEIGHT_M,
  DEFAULT_CEILING_REFLECTANCE,
  DEFAULT_WALL_REFLECTANCE,
  DEFAULT_WORKPLANE_HEIGHT_M,
  ROOM_CCT_DEFAULTS,
  ROOM_ILLUMINANCE_TARGETS,
} from "./lighting-data.js";
import {
  averageIlluminance,
  coefficientOfUtilization,
  gridLayout,
  lampPositions,
  maintenanceFactor,
  requiredLampCount,
  roomCavityRatio,
} from "./photometric.js";

export interface FixtureSpec {
  /** Catalog label, e.g. "LED Downlight 12W". */
  label: string;
  /** Luminous flux per fixture, lumens. */
  lumens: number;
  /** Electrical rating, VA (watts at PF≈1 — flagged assumption). */
  va: number;
  voltage: number;
}

export const DEFAULT_FIXTURE: FixtureSpec = {
  label: "LED Downlight 12W",
  lumens: 1200,
  va: 12,
  voltage: 120,
};

export interface AutoPlaceOptions {
  targetLux?: number;
  fixture?: FixtureSpec;
  ceilingHeight?: number;
}

export interface AutoPlaceResult {
  loads: ElectricalLoad[];
  meta: {
    roomId: string;
    targetLux: number;
    requiredCount: number;
    placedCount: number;
    expectedAverageLux: number;
    cu: number;
    mf: number;
  };
}

export function autoPlaceLighting(
  room: Room,
  options: AutoPlaceOptions = {}
): AutoPlaceResult {
  const fixture = options.fixture ?? DEFAULT_FIXTURE;
  const targetLux =
    options.targetLux ?? ROOM_ILLUMINANCE_TARGETS[room.type] ?? 150;
  const ceilingHeight = options.ceilingHeight ?? DEFAULT_CEILING_HEIGHT_M;

  const area = polygonArea(room.boundary);

  if (area <= 0) {
    throw new Error(`Room ${room.id} has a degenerate boundary`);
  }

  const bounds = polygonBounds(room.boundary);
  const length = bounds.maxX - bounds.minX;
  const width = bounds.maxY - bounds.minY;

  const rcr = roomCavityRatio(
    length,
    width,
    ceilingHeight,
    DEFAULT_WORKPLANE_HEIGHT_M
  );
  const cu = coefficientOfUtilization(
    rcr,
    DEFAULT_CEILING_REFLECTANCE,
    DEFAULT_WALL_REFLECTANCE
  );
  const mf = maintenanceFactor("normal", 2);
  const requiredCount = requiredLampCount(
    targetLux,
    area,
    fixture.lumens,
    cu,
    mf
  );

  // Lay out over the bounding box, keep in-polygon points; densify once
  // if clipping to a non-rectangular room lost too many.
  let positions = layoutInPolygon(room, requiredCount, bounds, length, width);

  if (positions.length < requiredCount) {
    positions = layoutInPolygon(
      room,
      Math.ceil(requiredCount * 1.5),
      bounds,
      length,
      width
    ).slice(0, requiredCount);
  }
  if (positions.length === 0) {
    positions = [polygonCentroid(room.boundary)];
  }

  const loads: ElectricalLoad[] = positions.map((position, index) => ({
    id: `lf-${room.id}-${index + 1}`,
    name: `${fixture.label} (${room.name})`,
    type: "lighting",
    va: fixture.va,
    voltage: fixture.voltage,
    continuous: true,
    position,
    roomId: room.id,
    lumens: fixture.lumens,
    // §9.1a room mood: warm for comfort spaces, cool for task spaces —
    // a design default the engineer can override per fixture.
    cct: ROOM_CCT_DEFAULTS[room.type] ?? 3500,
  }));

  const expectedAverageLux = averageIlluminance(
    loads.length * fixture.lumens,
    cu,
    mf,
    area
  );

  return {
    loads,
    meta: {
      roomId: room.id,
      targetLux,
      requiredCount,
      placedCount: loads.length,
      expectedAverageLux: Math.round(expectedAverageLux),
      cu: Math.round(cu * 1000) / 1000,
      mf,
    },
  };
}

function layoutInPolygon(
  room: Room,
  count: number,
  bounds: { minX: number; minY: number },
  length: number,
  width: number
): { x: number; y: number }[] {
  const layout = gridLayout(count, length, width);

  return lampPositions(layout, count, 0)
    .map((p) => ({ x: bounds.minX + p.x, y: bounds.minY + p.y }))
    .filter((p) => pointInPolygon(p, room.boundary));
}
