/**
 * Core domain types shared by every engine module (and, via Phase 3,
 * mirrored into the frontend API client).
 *
 * Geometry convention: meters, origin at the floor plan's top-left,
 * x to the right, y downward.
 */

// ---------- Geometry ----------

export interface Point {
  x: number;
  y: number;
}

/** A straight wall segment with physical thickness. */
export interface Wall {
  id: string;
  start: Point;
  end: Point;
  /** Wall thickness in meters (default 0.15 if omitted). */
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
  /** Closed polygon (last point implicitly connects to the first). */
  boundary: Point[];
}

export interface FloorPlan {
  /** Overall extents in meters. */
  width: number;
  height: number;
  walls: Wall[];
  rooms: Room[];
  /**
   * Optional uploaded floor plan image (data URL) shown as a trace layer
   * under the draw tools. Replaced by Supabase Storage post-MVP.
   */
  backgroundImage?: string;
}

// ---------- Electrical system ----------

export type VoltageSystem =
  | "1P2W-120" // single-phase two-wire, 120 V
  | "1P3W-120/240" // single-phase three-wire, 120/240 V
  | "3P4W-230/400"; // three-phase four-wire, 230/400 V

export type Phase = "A" | "B" | "C";

export type LoadType =
  | "lighting"
  | "outlet" // general-purpose receptacle
  | "appliance" // small appliance / dedicated appliance
  | "laundry"
  | "hvac"
  | "motor"
  | "equipment";

export interface ElectricalLoad {
  id: string;
  name: string;
  type: LoadType;
  /** Apparent power in volt-amperes. */
  va: number;
  /** Operating voltage (e.g. 120, 240, 230, 400). */
  voltage: number;
  /**
   * A continuous load runs 3+ hours at a time (PEC/NEC definition) and
   * triggers the 125%/80% rules.
   */
  continuous: boolean;
  position: Point;
  roomId?: string;
}

export type InsulationType = "TW" | "THW" | "THHN" | "XHHW";

export interface ConductorSpec {
  /** AWG size ("14", "12", ... "1/0", "250MCM") or metric label. */
  awg: string;
  /** Cross-section in mm². */
  mm2: number;
  /** Rated ampacity for the chosen insulation, from PEC Table 3.10.1. */
  ampacity: number;
  insulation: InsulationType;
}

export interface Circuit {
  id: string;
  /** Human-readable description for the panel directory. */
  description: string;
  loadIds: string[];
  /** Total connected load in VA. */
  connectedVa: number;
  /** Portion of connectedVa that is continuous, in VA. */
  continuousVa: number;
  voltage: number;
  /** Phase assignment (single-phase circuits get one leg). */
  phase: Phase;
  breakerAmps: number;
  conductor: ConductorSpec;
  /** One-way routed wire length from panel to farthest load, meters. */
  lengthM: number;
}

export interface Panel {
  id: string;
  name: string;
  position: Point;
  system: VoltageSystem;
  /** Main breaker rating in amps (0 = not yet sized). */
  mainBreakerAmps: number;
}

// ---------- Engine results ----------

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
  /** Per-phase connected VA, for balance review. */
  phaseVa: Record<Phase, number>;
  feederAmps: number;
  mainBreakerAmps: number;
}

export type ViolationSeverity = "error" | "warning";

export interface Violation {
  /** Stable rule identifier, e.g. "ampacity", "continuous-80", "voltage-drop-branch". */
  ruleId: string;
  severity: ViolationSeverity;
  message: string;
  circuitId?: string;
  /** PEC section/table the rule implements (values pending verification). */
  pecReference: string;
}

// ---------- Routing ----------

export interface RoutedPath {
  loadId: string;
  circuitId?: string;
  /** Polyline in floor-plan meters from panel to load. */
  points: Point[];
  lengthM: number;
  /** True if the router had to fall back to open-floor routing. */
  fallback: boolean;
}
