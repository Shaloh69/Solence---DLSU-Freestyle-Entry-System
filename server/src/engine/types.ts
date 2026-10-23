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
  /**
   * Design ambient temperature of the conduit runs (ceiling space), °C —
   * a project setting for the ampacity correction (W6). Default 35 °C
   * (sizing/pec-derating.ts, PEC-VERIFY).
   */
  ambientTempC?: number;
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
  | "1P2W-230" // single-phase two-wire, 230 V (Philippine residential)
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
  /**
   * Usable ampacity from PEC Table 3.10.1: the insulation rating capped by
   * the termination rating; once wiring is sized (W6) also corrected for
   * ambient and adjusted for the conductor count — see `Circuit.derating`.
   */
  ampacity: number;
  insulation: InsulationType;
  /**
   * Terminal temperature rating the ampacity is limited to (PEC 2017
   * 1.10.1.14(C)): 60 °C for circuits ≤100 A, 75 °C above. `ampacity`
   * is the usable value at this rating, not the insulation rating.
   */
  terminationTempC: 60 | 75;
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
  /** Equipment grounding conductor per PEC Table 2.50.6.13 (PEC-VERIFY). */
  groundingConductor: { awg: string; mm2: number };
  /**
   * One-way wire length from the panel to the farthest device, meters —
   * along the circuit's device-to-device chain once wiring is built (W3).
   */
  lengthM: number;
  /**
   * Branch voltage drop as a fraction (0.02 = 2%), for every circuit —
   * not just ones that exceed the limit. Powers the Recorded Electricals
   * log (brief §2.5); `checkVoltageDrop` computes this same value
   * internally to decide whether to raise a violation.
   */
  voltageDropPercent: number;
  /**
   * Segments from the panel to the device with the worst voltage drop,
   * each with the current it carries. When present, voltage drop sums
   * along this chain instead of assuming all current at the far end.
   */
  dropChain?: { lengthM: number; amps: number }[];
  /** W6: ambient correction + conductor-count adjustment applied to `conductor`. */
  derating?: CircuitDerating;
}

/**
 * Ampacity correction and adjustment of a circuit's conductor (W6,
 * PEC-VERIFY factors in sizing/pec-derating.ts).
 */
export interface CircuitDerating {
  ambientTempC: number;
  /** Ambient correction factor for the insulation's temperature column. */
  ambientFactor: number;
  /** Most current-carrying conductors in any raceway the circuit runs through. */
  maxCurrentCarrying: number;
  /** Adjustment factor for that count (1 for three or fewer). */
  adjustmentFactor: number;
  /** Usable ampacity: insulation column × both factors, capped by the termination column. */
  ampacity: number;
  /** Size before derating forced a larger conductor (absent when unchanged). */
  resizedFrom?: { awg: string; mm2: number };
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
  /** PEC 2.20 dwelling calculation behind totalDemandVa/feederAmps (W8); absent when built without a floor plan. */
  dwellingCalc?: DwellingLoadCalc;
}

/** One line of the PEC 2.20 dwelling calculation (schedule of loads). */
export interface DwellingCalcStep {
  /** "general-lighting" | "small-appliance" | "laundry" | "general-subtotal" | "lighting-demand" | "fixed-appliance" | "air-conditioning" | "other" | "total-demand" */
  id: string;
  label: string;
  /** How the value was computed, e.g. "66.0 m² × 24 VA/m²". */
  basis: string;
  /** VA of this step (connected for inputs, demand for demand lines). */
  va: number;
  /** PEC section the step stands for (PEC-VERIFY). */
  pecReference: string;
}

/**
 * PEC 2.20 standard dwelling load computation for the feeder/main (W8).
 * Code values PEC-VERIFY: load-calc/pec-demand-factors.ts, pec-dwelling-calc.ts.
 */
export interface DwellingLoadCalc {
  /** Floor area the unit load applies to (garage/outdoor excluded), m². */
  floorAreaM2: number;
  unitLoadVaPerM2: number;
  /** floorAreaM2 × unitLoadVaPerM2. */
  generalLightingBasisVa: number;
  /** Connected lighting + general-purpose receptacles the unit load covers. */
  connectedGeneralVa: number;
  /** Larger of basis and connected — the value used. */
  generalLightingVa: number;
  generalLightingSource: "unit-load" | "connected";
  smallApplianceCircuits: number;
  smallApplianceVa: number;
  laundryCircuits: number;
  laundryVa: number;
  /** General lighting + small appliance + laundry, before demand factors. */
  generalSubtotalVa: number;
  /** After the lighting demand tiers. */
  generalDemandVa: number;
  fixedApplianceCount: number;
  fixedApplianceConnectedVa: number;
  fixedApplianceFactor: number;
  fixedApplianceDemandVa: number;
  airConditioningVa: number;
  airConditioningFactor: number;
  airConditioningDemandVa: number;
  /** Motors and other equipment at 100 %. */
  otherVa: number;
  /** Feeder/main demand, VA. */
  demandVa: number;
  /** Voltage the demand current is computed on (line-to-line for 3φ). */
  systemVoltage: number;
  /** demandVa / systemVoltage (÷ √3 for 3φ), A. */
  demandAmps: number;
  steps: DwellingCalcStep[];
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

/** A conductor's job in a run: hot (L, and L2/L3 for multi-wire), neutral, ground. */
export type ConductorRole = "L" | "L2" | "L3" | "N" | "G";

/**
 * Switch-leg conductors (W5): S = switched hot from a switch back to its
 * lighting group, T = a traveler between the two switches of a 2-way pair.
 */
export type SwitchLegRole = "S" | "T";

export type WireRole = ConductorRole | SwitchLegRole;

export interface SegmentConductor {
  role: WireRole;
  awg: string;
  mm2: number;
  /** Insulation color (PEC-VERIFY: sizing/conductor-colors.ts, sizing/switch-leg-conductors.ts). */
  color: string;
  /** Lighting group an S/T conductor belongs to. */
  groupId?: string;
}

/**
 * One conduit run of a circuit: the home run (from "panel" to the first
 * device) or a device-to-device link. Together a circuit's segments form
 * a tree rooted at the panel.
 */
export interface WireSegment {
  id: string;
  circuitId: string;
  /** "panel" or the load id at the upstream end. */
  from: string;
  /** Load id at the downstream end. */
  to: string;
  points: Point[];
  lengthM: number;
  penetrations: number;
  conductors: SegmentConductor[];
  /** Connected VA of every device at or below `to`. */
  downstreamVa: number;
  downstreamAmps: number;
  /** W6: conduit size and fill of this run (each segment is its own raceway). */
  raceway?: Raceway;
}

/**
 * One conduit run's raceway (W6): current-carrying count, its adjustment
 * factor, and the smallest PVC Schedule 40 trade size within the
 * Chapter 9 Table 1 fill limit (PEC-VERIFY, sizing/pec-derating.ts).
 */
export interface Raceway {
  currentCarrying: number;
  adjustmentFactor: number;
  /** e.g. `1/2"`. */
  tradeSize: string;
  /** Metric designator, mm (16 = 1/2"). */
  metricMm: number;
  /** Sum of the conductors' insulated areas (EGC included), mm². */
  conductorAreaMm2: number;
  fillPercent: number;
  /** 53 (1 conductor), 31 (2), 40 (more than 2). */
  fillLimitPercent: number;
}

/** A device box where three or more conduits meet (splices inside). */
export interface JunctionBox {
  id: string;
  circuitId: string;
  loadId: string;
  position: Point;
  conduits: number;
}

export interface WireBomLine {
  role: WireRole;
  awg: string;
  mm2: number;
  color: string;
  lengthM: number;
}

export interface WireBom {
  wire: WireBomLine[];
  /** Feed segments plus switch legs, meters. */
  conduitLengthM: number;
  /** W6: conduit by trade size (sums to conduitLengthM). */
  conduits?: { tradeSize: string; metricMm: number; lengthM: number }[];
  junctionBoxes: number;
  /** Wall switches by type (a 2-way pair counts two). */
  switches: { oneWay: number; twoWay: number };
}

/**
 * A wall switch (W5), placed by the engine at the latch side of a door of
 * the room it serves. "1-way" = single-pole; "2-way" = one of a pair
 * switching the same group from two doors (US "3-way").
 */
export interface SwitchDevice {
  id: string;
  groupId: string;
  circuitId: string;
  roomId?: string;
  kind: "1-way" | "2-way";
  position: Point;
  /** Center height above finished floor (DESIGN-VERIFY, switching/switch-data.ts). */
  mountingHeightM: number;
  /** Door the switch sits beside; absent when the room has no door. */
  doorId?: string;
  /** The other switch of a 2-way pair. */
  pairedSwitchId?: string;
}

/** Lighting fixtures of one room on one circuit, switched together. */
export interface LightingGroup {
  id: string;
  circuitId: string;
  roomId?: string;
  loadIds: string[];
  /** One 1-way switch, or a 2-way pair. */
  switchIds: string[];
  /** Fixture box the switch leg drops from (the group fixture nearest the panel). */
  boxLoadId: string;
}

/**
 * Conduit run from a group's fixture box down to its switch (L + S + G),
 * or between a 2-way pair (S + T + T + G).
 */
export interface SwitchLeg {
  id: string;
  circuitId: string;
  groupId: string;
  /** Fixture load id (box) or switch id at the upstream end. */
  from: string;
  /** Switch id. */
  to: string;
  points: Point[];
  /** Plan length of `points` plus `verticalM`. */
  lengthM: number;
  /** Drops between ceiling and switch height included in lengthM. */
  verticalM: number;
  penetrations: number;
  conductors: SegmentConductor[];
  /** Current of the switched group. */
  amps: number;
  /** W6: conduit size and fill of this leg. */
  raceway?: Raceway;
}

export interface CircuitWiring {
  segments: WireSegment[];
  junctions: JunctionBox[];
  bom: WireBom;
  /** W5: switched lighting groups, their wall switches and switch legs. */
  lightingGroups: LightingGroup[];
  switches: SwitchDevice[];
  switchLegs: SwitchLeg[];
}

export interface RoutedPath {
  loadId: string;
  circuitId?: string;
  /** Polyline in floor-plan meters from panel to load. */
  points: Point[];
  lengthM: number;
  /**
   * True if the route leaves the building footprint (runs outside the
   * house) — a design smell the UI surfaces with a dashed line.
   * (Before W1b this meant "had to leave the wall band".)
   */
  fallback: boolean;
  /** Number of walls the run passes through (each needs a sleeve/hole). */
  penetrations?: number;
}
