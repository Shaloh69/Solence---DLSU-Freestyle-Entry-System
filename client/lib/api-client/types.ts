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

/**
 * Interior spatial-planning object (brief §11.1) — a SEPARATE category
 * from ElectricalLoad: no current draw, no load-calc/sizing/compliance
 * involvement, no PEC rules. Purely for visual/spatial context in the
 * 3D shell and optional outlet-placement judgment calls.
 */
export interface Furniture {
  id: string;
  key: string;
  label: string;
  meshKey: string;
  position: Point;
  /** Radians, 0 = footprint's "width" axis along plan X. */
  rotation: number;
  width: number;
  depth: number;
  height: number;
}

export interface FloorPlan {
  width: number;
  height: number;
  /** Ceiling height (m, §9.1a) — photometric input, default 2.7. */
  ceilingHeight?: number;
  /** W6: conduit-run (ceiling) ambient, °C — project setting, default 35 (0–55). */
  ambientTempC?: number;
  walls: Wall[];
  rooms: Room[];
  openings?: Opening[];
  furniture?: Furniture[];
  /** Optional trace-layer image as a data URL. */
  backgroundImage?: string;
}

export type VoltageSystem =
  | "1P2W-230" // single-phase two-wire, 230 V (Philippine residential)
  | "1P2W-120"
  | "1P3W-120/240"
  | "3P4W-230/400";
export type Phase = "A" | "B" | "C";

export type LoadType =
  | "lighting"
  | "outlet"
  | "appliance"
  | "laundry"
  | "hvac"
  | "heating" // fixed electric space heating (W8b)
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
  /** Correlated color temperature for lighting fixtures, Kelvin (§9.1a). */
  cct?: number;
  /** Whether an outlet is GFCI-protected. */
  gfci?: boolean;
  /** Exit/egress lighting fixture (commercial scope) — needs a dedicated circuit. */
  egress?: boolean;
}

export type InsulationType = "TW" | "THW" | "THHN" | "XHHW";

export interface ConductorSpec {
  awg: string;
  mm2: number;
  /** Usable ampacity (termination-capped; after W6 also derated — see Circuit.derating). */
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
  description: string;
  loadIds: string[];
  connectedVa: number;
  continuousVa: number;
  voltage: number;
  phase: Phase;
  breakerAmps: number;
  conductor: ConductorSpec;
  /** Equipment grounding conductor per PEC Table 2.50.6.13 (PEC-VERIFY). */
  groundingConductor: { awg: string; mm2: number };
  /** One-way wire length from the panel to the farthest device, along the device chain. */
  lengthM: number;
  /** Branch voltage drop as a fraction (0.02 = 2%) — every circuit, not just violations. */
  voltageDropPercent: number;
  /** Panel → worst-drop device, each segment with the current it carries. */
  dropChain?: { lengthM: number; amps: number }[];
  /** W6: ambient correction + conductor-count adjustment applied to `conductor`. */
  derating?: CircuitDerating;
}

/** W6: ampacity correction/adjustment of a circuit's conductor (PEC-VERIFY). */
export interface CircuitDerating {
  ambientTempC: number;
  ambientFactor: number;
  /** Most current-carrying conductors in any raceway the circuit runs through. */
  maxCurrentCarrying: number;
  adjustmentFactor: number;
  /** Usable ampacity: insulation column × both factors, capped by the termination column. */
  ampacity: number;
  /** Size before derating forced a larger conductor. */
  resizedFrom?: { awg: string; mm2: number };
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
  /** PEC 2.20 dwelling calculation behind totalDemandVa/feederAmps (W8); absent when built without a floor plan. */
  dwellingCalc?: DwellingLoadCalc;
}

/** One line of the PEC 2.20 dwelling calculation (schedule of loads). */
export interface DwellingCalcStep {
  /** "general-lighting" | "small-appliance" | "laundry" | "general-subtotal" | "lighting-demand" | "fixed-appliance" | "air-conditioning" | "space-heating" | "heating-ac-noncoincident" | "other" | "largest-motor" | "total-demand" */
  id: string;
  label: string;
  /** How the value was computed, e.g. "66.0 m² × 24 VA/m²". */
  basis: string;
  /** VA of this step (connected for inputs, demand for demand lines; negative for a deduction, e.g. the omitted non-coincident load). */
  va: number;
  /** PEC section the step stands for (PEC-VERIFY). */
  pecReference: string;
}

/** PEC 2.20 standard dwelling load computation for the feeder/main (W8). Code values PEC-VERIFY. */
export interface DwellingLoadCalc {
  floorAreaM2: number;
  unitLoadVaPerM2: number;
  generalLightingBasisVa: number;
  connectedGeneralVa: number;
  generalLightingVa: number;
  generalLightingSource: "unit-load" | "connected";
  smallApplianceCircuits: number;
  smallApplianceVa: number;
  laundryCircuits: number;
  laundryVa: number;
  generalSubtotalVa: number;
  generalDemandVa: number;
  fixedApplianceCount: number;
  fixedApplianceConnectedVa: number;
  fixedApplianceFactor: number;
  fixedApplianceDemandVa: number;
  airConditioningVa: number;
  airConditioningFactor: number;
  airConditioningDemandVa: number;
  spaceHeatingVa: number;
  spaceHeatingFactor: number;
  spaceHeatingDemandVa: number;
  nonCoincidentOmitted: "heating" | "air-conditioning" | null;
  nonCoincidentOmittedVa: number;
  otherVa: number;
  largestMotorVa: number;
  largestMotorLoadId: string | null;
  largestMotorFactor: number;
  largestMotorAdderVa: number;
  demandVa: number;
  systemVoltage: number;
  demandAmps: number;
  steps: DwellingCalcStep[];
}

// ---------- Service entrance + one-line diagram (W7) ----------

/**
 * Service entrance (W7, WIRING-AUDIT F-15): utility → kWh meter → main
 * breaker → panel, with the grounding electrode conductor. Code values
 * PEC-VERIFY: service/pec-service.ts (meter classes UTILITY-VERIFY).
 */
export interface ServiceEntrance {
  system: VoltageSystem;
  /** Line-to-line voltage (line-to-neutral for 2-wire), V. */
  voltage: number;
  phases: 1 | 3;
  wires: 2 | 3 | 4;
  /** Feeder/main demand the service carries (PEC 2.20 dwelling calc), VA / A. */
  demandVa: number;
  demandAmps: number;
  meter: {
    /** "self-contained kWh meter" or "CT-metered kWh meter". */
    kind: string;
    phases: 1 | 3;
    wires: 2 | 3 | 4;
    /** Meter class (A) for self-contained meters; the main rating when CT-metered. */
    ratedAmps: number;
    reference: string;
  };
  mainBreaker: {
    amps: number;
    poles: number;
    /** "manual" = the panel's mainBreakerAmps; "computed" = sized from the demand (W8). */
    source: "manual" | "computed";
    pecReference: string;
  };
  serviceConductors: {
    /** Every line + the neutral, copper, same size. */
    conductors: { role: WireRole; awg: string; mm2: number }[];
    insulation: InsulationType;
    terminationTempC: 60 | 75;
    ambientTempC: number;
    ambientFactor: number;
    currentCarrying: number;
    adjustmentFactor: number;
    /** Usable (derated, termination-capped) ampacity, at least the main breaker. */
    ampacity: number;
    raceway: {
      tradeSize: string;
      metricMm: number;
      conductorAreaMm2: number;
      fillPercent: number;
      fillLimitPercent: number;
    };
    pecReference: string;
  };
  groundingElectrodeConductor: {
    awg: string;
    mm2: number;
    /** Service conductor size the table row was looked up by, mm². */
    serviceMm2: number;
    pecReference: string;
  };
  groundingElectrode: {
    kind: string;
    lengthM: number;
    diameterMm: number;
    pecReference: string;
  };
}

export type OneLineNodeKind = "utility" | "meter" | "main" | "panel" | "branch" | "ground";

export interface OneLineNode {
  id: string;
  kind: OneLineNodeKind;
  /** Text printed for the node (SVG and PDF). */
  label: string;
  /** Branch nodes only. */
  circuitId?: string;
  circuitNumber?: number;
  breakerAmps?: number;
  poles?: number;
  /** Branch conductors, e.g. `2-3.5 mm² THHN + 1-3.5 mm² G in 1/2" PVC`. */
  conductor?: string;
}

export interface OneLineEdge {
  id: string;
  from: string;
  to: string;
  kind: "service-drop" | "service-entrance" | "main-bus" | "branch" | "gec";
  /** Conductor text printed beside the line ("" for branch edges: the node label carries it). */
  label: string;
}

/** One-line (riser) diagram as data + the SVG drawn from it (W7). */
export interface OneLineDiagram {
  nodes: OneLineNode[];
  edges: OneLineEdge[];
  /** Drawing size, in points (1/72 in). */
  width: number;
  height: number;
  svg: string;
}

export type ViolationSeverity = "error" | "warning";

export interface Violation {
  ruleId: string;
  severity: ViolationSeverity;
  message: string;
  circuitId?: string;
  pecReference: string;
}

export type ConductorRole = "L" | "L2" | "L3" | "N" | "G";

/** W5: S = switched hot back from a switch, T = traveler between a 2-way pair. */
export type SwitchLegRole = "S" | "T";

export type WireRole = ConductorRole | SwitchLegRole;

export interface SegmentConductor {
  role: WireRole;
  awg: string;
  mm2: number;
  /** Insulation color (PEC-VERIFY). */
  color: string;
  /** Lighting group an S/T conductor belongs to. */
  groupId?: string;
}

/** One conduit run: home run (from "panel") or device-to-device; a circuit's segments form a tree. */
export interface WireSegment {
  id: string;
  circuitId: string;
  from: string;
  to: string;
  points: Point[];
  lengthM: number;
  penetrations: number;
  conductors: SegmentConductor[];
  downstreamVa: number;
  downstreamAmps: number;
  /** W6: conduit size and fill of this run (each segment is its own raceway). */
  raceway?: Raceway;
}

/** W6: one conduit run's raceway — PVC Schedule 40 trade size by Chapter 9 fill (PEC-VERIFY). */
export interface Raceway {
  currentCarrying: number;
  adjustmentFactor: number;
  tradeSize: string;
  /** Metric designator, mm (16 = 1/2"). */
  metricMm: number;
  conductorAreaMm2: number;
  fillPercent: number;
  /** 53 (1 conductor), 31 (2), 40 (more than 2). */
  fillLimitPercent: number;
}

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

/** W5: wall switch placed by the engine at the latch side of a door of its room. */
export interface SwitchDevice {
  id: string;
  groupId: string;
  circuitId: string;
  roomId?: string;
  kind: "1-way" | "2-way";
  position: Point;
  /** Center height above finished floor (DESIGN-VERIFY). */
  mountingHeightM: number;
  doorId?: string;
  pairedSwitchId?: string;
}

/** Lighting fixtures of one room on one circuit, switched together. */
export interface LightingGroup {
  id: string;
  circuitId: string;
  roomId?: string;
  loadIds: string[];
  switchIds: string[];
  /** Fixture box the switch leg drops from. */
  boxLoadId: string;
}

/** Conduit run box → switch (L + S + G) or between a 2-way pair (S + T + T + G). */
export interface SwitchLeg {
  id: string;
  circuitId: string;
  groupId: string;
  from: string;
  to: string;
  points: Point[];
  /** Plan length of `points` plus `verticalM`. */
  lengthM: number;
  verticalM: number;
  penetrations: number;
  conductors: SegmentConductor[];
  amps: number;
  /** W6: conduit size and fill of this leg. */
  raceway?: Raceway;
}

export interface CircuitWiring {
  segments: WireSegment[];
  junctions: JunctionBox[];
  bom: WireBom;
  lightingGroups: LightingGroup[];
  switches: SwitchDevice[];
  switchLegs: SwitchLeg[];
}

export interface RoutedPath {
  loadId: string;
  circuitId?: string;
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
  /** Simplified Daylight Factor advisory (§9.1a) — never affects code counts. */
  daylightFactor?: number;
  wellDaylit?: boolean;
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
  /** Device-to-device circuit wiring: conduit segments, junction boxes, bill of materials (W3). */
  wiring: CircuitWiring;
  /** Service entrance: kWh meter, main breaker, service conductors, GEC (W7). */
  service: ServiceEntrance;
  /** One-line (riser) diagram as nodes/edges + SVG (W7). */
  oneLine: OneLineDiagram;
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

// ---------- DXF exchange (W12) ----------

/** DXF drawing units (`$INSUNITS` 1 in, 2 ft, 4 mm, 5 cm, 6 m). */
export type DxfUnits = "m" | "cm" | "mm" | "in" | "ft";

/** What a DXF wall import read, returned by `POST /projects/:id/import/dxf`. */
export interface DxfImportReport {
  /** Units the drawing was read in (from `$INSUNITS` or the request). */
  units: DxfUnits;
  /** Meters per drawing unit. */
  scaleToMeters: number;
  /** Layers walls were read from. */
  wallLayers: string[];
  wallCount: number;
  /** Every layer in the file. */
  layers: string[];
  /** Entities on wall layers that were not read, by type (arcs, blocks, …). */
  skipped: Record<string, number>;
  /** "limits": plan frame from `$LIMMIN`/`$LIMMAX` (Solence exports); "extents": walls' extent + margin. */
  frame: "limits" | "extents";
  /** Margin added around the walls' extent, meters (0 with "limits"). */
  marginM: number;
}
