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

/** A door or window cut into a wall. */
export interface Opening {
  id: string;
  /** Wall this opening belongs to. */
  wallId: string;
  /** Distance from the wall's start point to the opening's near edge, meters. */
  offset: number;
  /** Opening width along the wall, meters. */
  width: number;
  kind: "door" | "window";
}

/**
 * Interior spatial-planning object (brief §11.1) — a SEPARATE category
 * from ElectricalLoad: no current draw, no load-calc/sizing/compliance
 * involvement, no PEC rules. The engine never reads this array; it's
 * carried through storage purely for the frontend's 2D/3D scenes.
 */
export interface Furniture {
  id: string;
  key: string;
  label: string;
  meshKey: string;
  position: Point;
  rotation: number;
  width: number;
  depth: number;
  height: number;
}

export interface FloorPlan {
  /** Overall extents in meters. */
  width: number;
  height: number;
  /**
   * Ceiling height in meters (§9.1a): a required photometric input —
   * fixture counts change with mounting height — defaulted to 2.7 when
   * absent, never assumed silently inside the solver.
   */
  ceilingHeight?: number;
  walls: Wall[];
  rooms: Room[];
  openings?: Opening[];
  /** Spatial-only furniture (brief §11.1) — never consumed by the engine. */
  furniture?: Furniture[];
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
  /**
   * Photometric output for lighting fixtures (lumens). When absent the
   * lighting engine estimates from VA (flagged assumption).
   */
  lumens?: number;
  /**
   * Correlated color temperature for lighting fixtures, Kelvin (§9.1a
   * room mood). Defaults per room type on auto-placement; overridable.
   */
  cct?: number;
  /** Whether an outlet is GFCI-protected (wet-area rule input). */
  gfci?: boolean;
  /**
   * Exit/egress lighting fixture (commercial scope). Must sit on a
   * circuit dedicated to egress use — see compliance/egress-lighting.ts.
   */
  egress?: boolean;
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
  /**
   * Branch voltage drop as a fraction (0.02 = 2%), for every circuit —
   * not just ones that exceed the limit. Powers the Recorded Electricals
   * log (brief §2.5); `checkVoltageDrop` computes this same value
   * internally to decide whether to raise a violation.
   */
  voltageDropPercent: number;
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
