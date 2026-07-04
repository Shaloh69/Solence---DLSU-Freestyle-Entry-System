/**
 * Per-room photometric analysis of placed lighting loads: average lux
 * vs the room-type target, plus an illuminance sample grid for the lux
 * heatmap layer. Consumed by both the compliance rule and the
 * simulation result.
 */
import { ElectricalLoad, FloorPlan, Room } from "../types.js";
import { polygonArea, polygonBounds, pointInPolygon } from "../geometry.js";
import {
  DEFAULT_CEILING_HEIGHT_M,
  DEFAULT_CEILING_REFLECTANCE,
  DEFAULT_LUMENS_PER_WATT,
  DEFAULT_WALL_REFLECTANCE,
  DEFAULT_WORKPLANE_HEIGHT_M,
  ROOM_ILLUMINANCE_TARGETS,
} from "./lighting-data.js";
import {
  averageIlluminance,
  coefficientOfUtilization,
  illuminanceAtPoint,
  maintenanceFactor,
  roomCavityRatio,
} from "./photometric.js";

export interface RoomLightingAnalysis {
  roomId: string;
  roomName: string;
  targetLux: number;
  averageLux: number;
  fixtureCount: number;
  totalLightingVa: number;
  /** True when any fixture's flux was estimated from VA. */
  fluxEstimated: boolean;
}

export interface LuxSample {
  x: number;
  y: number;
  lux: number;
}

export function fixtureFlux(load: ElectricalLoad): {
  lumens: number;
  estimated: boolean;
} {
  if (load.lumens && load.lumens > 0) {
    return { lumens: load.lumens, estimated: false };
  }

  return { lumens: load.va * DEFAULT_LUMENS_PER_WATT, estimated: true };
}

export function analyzeRoomLighting(
  rooms: Room[],
  loads: ElectricalLoad[]
): RoomLightingAnalysis[] {
  return rooms.map((room) => {
    const fixtures = loads.filter(
      (load) => load.type === "lighting" && load.roomId === room.id
    );
    const area = polygonArea(room.boundary);
    const bounds = polygonBounds(room.boundary);
    const length = Math.max(0.1, bounds.maxX - bounds.minX);
    const width = Math.max(0.1, bounds.maxY - bounds.minY);

    const cu = coefficientOfUtilization(
      roomCavityRatio(
        length,
        width,
        DEFAULT_CEILING_HEIGHT_M,
        DEFAULT_WORKPLANE_HEIGHT_M
      ),
      DEFAULT_CEILING_REFLECTANCE,
      DEFAULT_WALL_REFLECTANCE
    );
    const mf = maintenanceFactor("normal", 2);

    let totalFlux = 0;
    let fluxEstimated = false;

    for (const fixture of fixtures) {
      const { lumens, estimated } = fixtureFlux(fixture);

      totalFlux += lumens;
      fluxEstimated ||= estimated;
    }

    return {
      roomId: room.id,
      roomName: room.name,
      targetLux: ROOM_ILLUMINANCE_TARGETS[room.type] ?? 150,
      averageLux:
        area > 0 ? Math.round(averageIlluminance(totalFlux, cu, mf, area)) : 0,
      fixtureCount: fixtures.length,
      totalLightingVa: fixtures.reduce((sum, fixture) => sum + fixture.va, 0),
      fluxEstimated,
    };
  });
}

/**
 * Illuminance sample grid over the whole plan for the lux heatmap layer.
 * Samples outside every room are omitted.
 */
export function luxHeatmap(
  plan: FloorPlan,
  loads: ElectricalLoad[],
  gridStep = 0.5
): LuxSample[] {
  const fixtures = loads.filter((load) => load.type === "lighting");

  if (fixtures.length === 0 || plan.rooms.length === 0) return [];

  const cu = coefficientOfUtilization(
    1.5,
    DEFAULT_CEILING_REFLECTANCE,
    DEFAULT_WALL_REFLECTANCE
  );
  const mf = maintenanceFactor("normal", 2);
  const lamps = fixtures.map((fixture) => ({
    x: fixture.position.x,
    y: fixture.position.y,
    z: DEFAULT_CEILING_HEIGHT_M - 0.1,
    fluxLm: fixtureFlux(fixture).lumens,
  }));

  const samples: LuxSample[] = [];

  for (let y = gridStep / 2; y < plan.height; y += gridStep) {
    for (let x = gridStep / 2; x < plan.width; x += gridStep) {
      const inRoom = plan.rooms.some((room) =>
        pointInPolygon({ x, y }, room.boundary)
      );

      if (!inRoom) continue;
      samples.push({
        x,
        y,
        lux: Math.round(
          illuminanceAtPoint(x, y, lamps, DEFAULT_WORKPLANE_HEIGHT_M, cu, mf)
        ),
      });
    }
  }

  return samples;
}
