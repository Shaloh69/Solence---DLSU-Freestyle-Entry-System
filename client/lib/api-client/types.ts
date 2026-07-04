/**
 * API contract types — mirrors server/src/engine/types.ts and
 * server/src/db/repository.ts. Keep in sync with server/docs/api.md
 * when the contract changes.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness?: number;
}

export type RoomType =
  | "bathroom"
  | "kitchen"
  | "garage"
  | "laundry"
  | "bedroom"
  | "living"
  | "dining"
  | "office"
  | "hallway"
  | "outdoor"
  | "other";

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  boundary: Point[];
}

/** A door or window cut into a wall. */
export interface Opening {
  id: string;
  wallId: string;
  /** Meters from the wall's start to the opening's near edge. */
  offset: number;
  width: number;
  kind: "door" | "window";
}

export interface FloorPlan {
  width: number;
  height: number;
  walls: Wall[];
  rooms: Room[];
  openings?: Opening[];
  /** Optional trace-layer image as a data URL. */
  backgroundImage?: string;
}

export type VoltageSystem = "1P2W-120" | "1P3W-120/240" | "3P4W-230/400";
export type Phase = "A" | "B" | "C";

export type LoadType =
  | "lighting"
  | "outlet"
  | "appliance"
  | "laundry"
  | "hvac"
  | "motor"
  | "equipment";

export interface ElectricalLoad {
  id: string;
  name: string;
  type: LoadType;
  va: number;
  voltage: number;
  continuous: boolean;
  position: Point;
  roomId?: string;
  /** Photometric output for lighting fixtures, lumens. */
  lumens?: number;
  /** Whether an outlet is GFCI-protected. */
  gfci?: boolean;
}

export type InsulationType = "TW" | "THW" | "THHN" | "XHHW";

export interface ConductorSpec {
  awg: string;
  mm2: number;
  ampacity: number;
  insulation: InsulationType;
}

export interface Circuit {
  id: string;
  description: string;
  loadIds: string[];
  connectedVa: number;
  continuousVa: number;
  voltage: number;
  phase: Phase;
  breakerAmps: number;
  conductor: ConductorSpec;
  lengthM: number;
}

export interface Panel {
  id: string;
  name: string;
  position: Point;
  system: VoltageSystem;
  mainBreakerAmps: number;
}

export interface PanelScheduleRow {
  circuitId: string;
  circuitNumber: number;
  description: string;
  phase: Phase;
  connectedVa: number;
  demandVa: number;
  breakerAmps: number;
  conductor: string;
  wireLengthM: number;
}

export interface PanelSchedule {
  panelId: string;
  system: VoltageSystem;
  rows: PanelScheduleRow[];
  totalConnectedVa: number;
  totalDemandVa: number;
  phaseVa: Record<Phase, number>;
  feederAmps: number;
  mainBreakerAmps: number;
}

export type ViolationSeverity = "error" | "warning";

export interface Violation {
  ruleId: string;
  severity: ViolationSeverity;
  message: string;
  circuitId?: string;
  pecReference: string;
}

export interface RoutedPath {
  loadId: string;
  circuitId?: string;
  points: Point[];
  lengthM: number;
  fallback: boolean;
}

export interface PanelDirectoryEntry {
  circuitNumber: number;
  circuitId: string;
  description: string;
}

export interface RoomLightingAnalysis {
  roomId: string;
  roomName: string;
  targetLux: number;
  averageLux: number;
  fixtureCount: number;
  totalLightingVa: number;
  fluxEstimated: boolean;
}

export interface LuxSample {
  x: number;
  y: number;
  lux: number;
}

export interface SimulationResult {
  routes: RoutedPath[];
  circuits: Circuit[];
  schedule: PanelSchedule;
  directory: PanelDirectoryEntry[];
  violations: Violation[];
  routingErrors: { loadId: string; message: string }[];
  roomLighting: RoomLightingAnalysis[];
  luxHeatmap: LuxSample[];
}

export interface AutoLightingOptions {
  roomIds?: string[];
  targetLux?: number;
  fixture?: { label: string; lumens: number; va: number; voltage: number };
  replaceExisting?: boolean;
}

export interface AutoLightingPlacement {
  roomId: string;
  targetLux: number;
  requiredCount: number;
  placedCount: number;
  expectedAverageLux: number;
  cu: number;
  mf: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  floorPlan: FloorPlan | null;
  panel: Panel | null;
  loads: ElectricalLoad[];
  lastResult: SimulationResult | null;
}

export interface SimulateOptions {
  cellSize?: number;
  clearance?: number;
}
