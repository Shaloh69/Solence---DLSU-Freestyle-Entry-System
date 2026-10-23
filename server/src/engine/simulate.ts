/**
 * Simulation orchestrator: the whole core loop in one pure function.
 *
 *   floor plan + panel + loads
 *     -> rasterize -> route every load -> group into circuits -> size
 *     -> device-to-device wiring per circuit (topology.ts)
 *     -> raceways: derate, resize, conduit fill (raceways.ts)
 *     -> compliance checks -> panel schedule + directory
 */
import {
  ElectricalLoad,
  FloorPlan,
  Panel,
  PanelSchedule,
  RoutedPath,
  Violation,
  Circuit,
  CircuitWiring,
  OneLineDiagram,
  ServiceEntrance,
} from "./types.js";
import { buildOneLine, buildServiceEntrance } from "./service/index.js";
import { buildWiring } from "./topology.js";
import { applyRaceways } from "./raceways.js";
import { DEFAULT_AMBIENT_TEMP_C } from "./sizing/pec-derating.js";
import { placeSwitches } from "./switching/index.js";
import { DEFAULT_CEILING_HEIGHT_M } from "./lighting/lighting-data.js";
import { rasterizeFloorPlan, routeAll } from "./routing/index.js";
import { pointInPolygon } from "./geometry.js";
import { buildCircuits, CircuitBuilderOptions } from "./circuits.js";
import {
  runComplianceChecks,
  runProjectChecks,
  voltageDropPercent,
} from "./compliance/index.js";
import {
  analyzeRoomLighting,
  luxHeatmap,
  LuxSample,
  RoomLightingAnalysis,
} from "./lighting/index.js";
import {
  generatePanelDirectory,
  PanelDirectoryEntry,
} from "./compliance/panel-directory.js";
import { buildPanelSchedule, dwellingLoadCalc } from "./load-calc/index.js";
import { sizeBreaker } from "./sizing/index.js";

export interface SimulationInput {
  floorPlan: FloorPlan;
  panel: Panel;
  loads: ElectricalLoad[];
  options?: {
    cellSize?: number;
    clearance?: number;
    circuits?: CircuitBuilderOptions;
  };
}

export interface SimulationResult {
  routes: RoutedPath[];
  circuits: Circuit[];
  schedule: PanelSchedule;
  directory: PanelDirectoryEntry[];
  violations: Violation[];
  /** Loads that could not be routed, with the reason. */
  routingErrors: { loadId: string; message: string }[];
  /** Per-room photometric analysis of placed lighting. */
  roomLighting: RoomLightingAnalysis[];
  /** Workplane illuminance samples for the lux heatmap layer. */
  luxHeatmap: LuxSample[];
  /** Device-to-device circuit wiring: conduit segments, junction boxes, bill of materials (W3). */
  wiring: CircuitWiring;
  /** Service entrance: kWh meter, main breaker, service conductors, GEC (W7). */
  service: ServiceEntrance;
  /** One-line (riser) diagram as nodes/edges + SVG (W7). */
  oneLine: OneLineDiagram;
}

export function simulate(input: SimulationInput): SimulationResult {
  const { floorPlan, panel, loads, options } = input;

  const grid = rasterizeFloorPlan(floorPlan, {
    cellSize: options?.cellSize,
    clearance: options?.clearance,
  });

  const roomById = new Map(floorPlan.rooms.map((room) => [room.id, room]));
  const panelRoom = floorPlan.rooms.find((room) =>
    pointInPolygon(panel.position, room.boundary)
  );
  const targets = loads.map((load) => ({
    id: load.id,
    position: load.position,
    room: load.roomId ? roomById.get(load.roomId)?.boundary : undefined,
  }));
  const { routes, errors: routingErrors } = routeAll(
    panel.position,
    targets,
    grid,
    panelRoom?.boundary
  );

  const circuits = buildCircuits(loads, panel, routes, {
    ...options?.circuits,
    roomTypes:
      options?.circuits?.roomTypes ??
      new Map(floorPlan.rooms.map((room) => [room.id, room.type])),
  });

  // Tag each route with its circuit for color-coded rendering.
  const circuitByLoad = new Map<string, string>();

  for (const circuit of circuits) {
    for (const loadId of circuit.loadIds) circuitByLoad.set(loadId, circuit.id);
  }
  for (const route of routes) {
    route.circuitId = circuitByLoad.get(route.loadId);
  }

  // Home runs become real circuits: panel → first device → device to device.
  // Sets each circuit's lengthM (farthest device along the chain) and dropChain.
  // W5: switched lighting groups get wall switches at their room's door,
  // wired as switch legs in the same topology.
  const wiring = buildWiring(grid, panel, loads, circuits, routes, targets, {
    plan: placeSwitches(floorPlan, loads, circuits, panel.position),
    rooms: floorPlan.rooms,
    ceilingHeight: floorPlan.ceilingHeight ?? DEFAULT_CEILING_HEIGHT_M,
  });

  // W6: ambient correction + conductor-count adjustment per raceway,
  // resize conductors, conduit trade size by fill (before voltage drop,
  // which reads the final conductor size).
  applyRaceways(circuits, wiring, {
    ambientTempC: floorPlan.ambientTempC ?? DEFAULT_AMBIENT_TEMP_C,
  });

  const threePhase = panel.system === "3P4W-230/400";

  // Exposed on every circuit (not just violating ones) for the Recorded
  // Electricals log — the same value checkVoltageDrop uses internally.
  for (const circuit of circuits) {
    circuit.voltageDropPercent = voltageDropPercent(circuit, threePhase);
  }

  const violations = [
    ...runComplianceChecks(circuits, loads, { threePhase }),
    ...runProjectChecks(floorPlan.rooms, loads, circuits),
  ];

  // W8: feeder/main demand from the PEC 2.20 dwelling calculation (general
  // lighting at the unit load, small-appliance/laundry circuits, fixed
  // appliances, A/C). Size the main breaker from it if not set manually.
  const dwellingCalc = dwellingLoadCalc({
    rooms: floorPlan.rooms,
    circuits,
    loads,
    system: panel.system,
  });
  const mainAmps =
    panel.mainBreakerAmps > 0
      ? panel.mainBreakerAmps
      : sizeBreaker(dwellingCalc.demandAmps);

  const schedule = buildPanelSchedule(panel, circuits, loads, mainAmps, dwellingCalc);
  const directory = generatePanelDirectory(circuits, loads, floorPlan.rooms);

  // W7: service entrance sized from the main breaker (computed demand or
  // the manual rating), GEC from its table; one-line diagram from the panel.
  const service = buildServiceEntrance({
    system: panel.system,
    mainBreakerAmps: mainAmps,
    mainBreakerSource: panel.mainBreakerAmps > 0 ? "manual" : "computed",
    demandVa: dwellingCalc.demandVa,
    demandAmps: dwellingCalc.demandAmps,
    insulation: circuits[0]?.conductor.insulation ?? options?.circuits?.insulation ?? "THHN",
    ambientTempC: floorPlan.ambientTempC ?? DEFAULT_AMBIENT_TEMP_C,
  });
  const oneLine = buildOneLine({ panel, service, circuits, wiring });

  return {
    routes,
    circuits,
    schedule,
    directory,
    violations,
    routingErrors,
    roomLighting: analyzeRoomLighting(floorPlan.rooms, loads, {
      ceilingHeight: floorPlan.ceilingHeight,
      walls: floorPlan.walls,
      openings: floorPlan.openings,
    }),
    luxHeatmap: luxHeatmap(floorPlan, loads),
    wiring,
    service,
    oneLine,
  };
}
