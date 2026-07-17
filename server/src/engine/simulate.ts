/**
 * Simulation orchestrator: the whole core loop in one pure function.
 *
 *   floor plan + panel + loads
 *     -> rasterize -> route every load -> group into circuits -> size
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
} from "./types.js";
import { rasterizeFloorPlan, routeWire } from "./routing/index.js";
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
import { buildPanelSchedule, feederDemandVa, feederAmps, panelVoltage } from "./load-calc/index.js";
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
}

export function simulate(input: SimulationInput): SimulationResult {
  const { floorPlan, panel, loads, options } = input;

  const grid = rasterizeFloorPlan(floorPlan, {
    cellSize: options?.cellSize,
    clearance: options?.clearance,
  });

  const routes: RoutedPath[] = [];
  const routingErrors: { loadId: string; message: string }[] = [];

  for (const load of loads) {
    try {
      routes.push(routeWire(panel.position, load.position, load.id, grid));
    } catch (error) {
      routingErrors.push({
        loadId: load.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const circuits = buildCircuits(loads, panel, routes, options?.circuits);

  // Tag each route with its circuit for color-coded rendering.
  const circuitByLoad = new Map<string, string>();

  for (const circuit of circuits) {
    for (const loadId of circuit.loadIds) circuitByLoad.set(loadId, circuit.id);
  }
  for (const route of routes) {
    route.circuitId = circuitByLoad.get(route.loadId);
  }

  const threePhase = panel.system === "3P4W-230/400";

  // Exposed on every circuit (not just violating ones) for the Recorded
  // Electricals log — the same value checkVoltageDrop uses internally.
  for (const circuit of circuits) {
    circuit.voltageDropPercent = voltageDropPercent(circuit, threePhase);
  }

  const violations = [
    ...runComplianceChecks(circuits, loads, { threePhase }),
    ...runProjectChecks(floorPlan.rooms, loads),
  ];

  // Size the main breaker from feeder demand if not set manually.
  const demandVa = feederDemandVa(circuits, loads);
  const mainAmps =
    panel.mainBreakerAmps > 0
      ? panel.mainBreakerAmps
      : sizeBreaker(feederAmps(demandVa, panelVoltage(panel), threePhase));

  const schedule = buildPanelSchedule(panel, circuits, loads, mainAmps);
  const directory = generatePanelDirectory(circuits, loads, floorPlan.rooms);

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
  };
}
