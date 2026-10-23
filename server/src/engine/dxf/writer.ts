/**
 * Minimal ASCII DXF writer, AutoCAD R12 (AC1009) entity subset: LINE,
 * POLYLINE/VERTEX/SEQEND (walls carry their thickness as the polyline
 * width), CIRCLE, TEXT. R12 needs no handles or OBJECTS section and is
 * read by AutoCAD, BricsCAD, LibreCAD, QCAD and ezdxf.
 *
 * Coordinates: the plan is y-down (meters, origin top-left); DXF is
 * y-up, so y is negated. `$LIMMIN`/`$LIMMAX` hold the plan frame
 * (0, -height)…(width, 0) so the importer restores the same origin.
 */
import type { SimulationResult } from "../simulate.js";
import type { DxfUnits, ElectricalLoad, FloorPlan, Panel, Point } from "../types.js";
import { polygonCentroid } from "../geometry.js";
import { DXF_LAYERS, DXF_LAYER_COLORS, DXF_OPENINGS_LAYER, DXF_UNITS } from "./layers.js";

export interface DxfExportInput {
  floorPlan: FloorPlan;
  panel?: Panel | null;
  loads?: ElectricalLoad[];
  /** Last simulation result: wiring, switches and violations come from here. */
  result?: SimulationResult | null;
  /** Drawing units (default meters). */
  units?: DxfUnits;
}

const DEFAULT_WALL_THICKNESS = 0.15;
const CIRCUIT_COLORS = [1, 3, 5, 6, 30, 40, 90, 130, 150, 170, 200, 220, 240];

/** Fixed-point number without exponent or "-0". */
function num(v: number): string {
  const s = Number(v.toFixed(6)).toString();

  return s === "-0" ? "0" : s;
}

/** R12 text is single-line ASCII; others become \U+XXXX escapes (AutoCAD reads them). */
function text(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\x20-\x7e]/g, (ch) => `\\U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`);
}

class DxfBuilder {
  private lines: string[] = [];

  constructor(private scale: number) {}

  pair(code: number, value: string | number) {
    this.lines.push(String(code), typeof value === "number" ? num(value) : value);
  }

  /** Plan point → drawing XY (y flipped, scaled). */
  xy(p: Point, codeX = 10) {
    this.pair(codeX, p.x * this.scale);
    this.pair(codeX + 10, -p.y * this.scale);
    this.pair(codeX + 20, 0);
  }

  polyline(layer: string, points: Point[], opts: { closed?: boolean; widthM?: number; color?: number } = {}) {
    this.pair(0, "POLYLINE");
    this.pair(8, layer);
    if (opts.color !== undefined) this.pair(62, opts.color);
    this.pair(66, 1);
    this.pair(10, 0);
    this.pair(20, 0);
    this.pair(30, 0);
    this.pair(70, opts.closed ? 1 : 0);
    if (opts.widthM !== undefined) {
      this.pair(40, opts.widthM * this.scale);
      this.pair(41, opts.widthM * this.scale);
    }
    for (const p of points) {
      this.pair(0, "VERTEX");
      this.pair(8, layer);
      this.xy(p);
    }
    this.pair(0, "SEQEND");
    this.pair(8, layer);
  }

  line(layer: string, a: Point, b: Point) {
    this.pair(0, "LINE");
    this.pair(8, layer);
    this.xy(a);
    this.xy(b, 11);
  }

  circle(layer: string, center: Point, radiusM: number) {
    this.pair(0, "CIRCLE");
    this.pair(8, layer);
    this.xy(center);
    this.pair(40, radiusM * this.scale);
  }

  text(layer: string, at: Point, heightM: number, value: string) {
    this.pair(0, "TEXT");
    this.pair(8, layer);
    this.xy(at);
    this.pair(40, heightM * this.scale);
    this.pair(1, text(value));
  }

  toString() {
    return this.lines.join("\r\n") + "\r\n";
  }
}

function rotatedRect(center: Point, width: number, depth: number, rotation: number): Point[] {
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);

  return [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ].map(([dx, dy]) => ({ x: center.x + dx * c - dy * s, y: center.y + dx * s + dy * c }));
}

/** Writes the project as an R12 DXF string. */
export function exportDxf(input: DxfExportInput): string {
  const { floorPlan } = input;
  const units = input.units ?? "m";
  const scale = 1 / DXF_UNITS[units].meters;
  const loads = input.loads ?? [];
  const wiring = input.result?.wiring;
  const out = new DxfBuilder(scale);
  const layerNames = ["0", ...Object.values(DXF_LAYERS), DXF_OPENINGS_LAYER];

  // ---- HEADER ----
  out.pair(0, "SECTION");
  out.pair(2, "HEADER");
  out.pair(9, "$ACADVER");
  out.pair(1, "AC1009");
  out.pair(9, "$INSUNITS");
  out.pair(70, DXF_UNITS[units].insunits);
  out.pair(9, "$MEASUREMENT");
  out.pair(70, units === "in" || units === "ft" ? 0 : 1);
  out.pair(9, "$LIMMIN");
  out.pair(10, 0);
  out.pair(20, -floorPlan.height * scale);
  out.pair(9, "$LIMMAX");
  out.pair(10, floorPlan.width * scale);
  out.pair(20, 0);
  out.pair(9, "$EXTMIN");
  out.xy({ x: 0, y: floorPlan.height });
  out.pair(9, "$EXTMAX");
  out.xy({ x: floorPlan.width, y: 0 });
  out.pair(0, "ENDSEC");

  // ---- TABLES: LTYPE, LAYER, STYLE ----
  out.pair(0, "SECTION");
  out.pair(2, "TABLES");
  out.pair(0, "TABLE");
  out.pair(2, "LTYPE");
  out.pair(70, 1);
  out.pair(0, "LTYPE");
  out.pair(2, "CONTINUOUS");
  out.pair(70, 0);
  out.pair(3, "Solid line");
  out.pair(72, 65);
  out.pair(73, 0);
  out.pair(40, 0);
  out.pair(0, "ENDTAB");
  out.pair(0, "TABLE");
  out.pair(2, "LAYER");
  out.pair(70, layerNames.length);
  for (const name of layerNames) {
    out.pair(0, "LAYER");
    out.pair(2, name);
    out.pair(70, 0);
    out.pair(62, DXF_LAYER_COLORS[name] ?? 7);
    out.pair(6, "CONTINUOUS");
  }
  out.pair(0, "ENDTAB");
  out.pair(0, "TABLE");
  out.pair(2, "STYLE");
  out.pair(70, 1);
  out.pair(0, "STYLE");
  out.pair(2, "STANDARD");
  out.pair(70, 0);
  out.pair(40, 0);
  out.pair(41, 1);
  out.pair(50, 0);
  out.pair(71, 0);
  out.pair(42, 0.2 * scale);
  out.pair(3, "txt");
  out.pair(4, "");
  out.pair(0, "ENDTAB");
  out.pair(0, "ENDSEC");

  // ---- ENTITIES ----
  out.pair(0, "SECTION");
  out.pair(2, "ENTITIES");

  const wallById = new Map(floorPlan.walls.map((w) => [w.id, w]));

  for (const wall of floorPlan.walls) {
    out.polyline(DXF_LAYERS.walls, [wall.start, wall.end], {
      widthM: wall.thickness ?? DEFAULT_WALL_THICKNESS,
    });
  }
  for (const opening of floorPlan.openings ?? []) {
    const wall = wallById.get(opening.wallId);

    if (!wall) continue;
    const len = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y) || 1;
    const at = (d: number) => ({
      x: wall.start.x + ((wall.end.x - wall.start.x) * d) / len,
      y: wall.start.y + ((wall.end.y - wall.start.y) * d) / len,
    });

    out.line(DXF_OPENINGS_LAYER, at(opening.offset), at(opening.offset + opening.width));
  }

  for (const room of floorPlan.rooms) {
    out.polyline(DXF_LAYERS.rooms, room.boundary, { closed: true });
    out.text(DXF_LAYERS.rooms, polygonCentroid(room.boundary), 0.2, room.name);
  }

  for (const piece of floorPlan.furniture ?? []) {
    out.polyline(DXF_LAYERS.furniture, rotatedRect(piece.position, piece.width, piece.depth, piece.rotation), {
      closed: true,
    });
  }

  if (input.panel) {
    const p = input.panel.position;

    out.polyline(DXF_LAYERS.loads, rotatedRect(p, 0.4, 0.15, 0), { closed: true });
    out.text(DXF_LAYERS.loads, { x: p.x + 0.25, y: p.y }, 0.15, input.panel.name);
  }
  for (const load of loads) {
    const layer = load.type === "lighting" ? DXF_LAYERS.lighting : DXF_LAYERS.loads;

    out.circle(layer, load.position, 0.1);
    out.text(layer, { x: load.position.x + 0.12, y: load.position.y }, 0.08, load.name);
  }
  for (const sw of wiring?.switches ?? []) {
    out.circle(DXF_LAYERS.lighting, sw.position, 0.06);
    out.text(DXF_LAYERS.lighting, { x: sw.position.x + 0.08, y: sw.position.y }, 0.08, sw.kind === "2-way" ? "S2" : "S");
  }

  // One AutoCAD color per circuit (display only; 7 = white/black is the walls').
  const circuitColor = new Map<string, number>();
  const colorOf = (circuitId: string) => {
    if (!circuitColor.has(circuitId)) {
      circuitColor.set(circuitId, CIRCUIT_COLORS[circuitColor.size % CIRCUIT_COLORS.length]);
    }

    return circuitColor.get(circuitId)!;
  };

  for (const seg of wiring?.segments ?? []) {
    out.polyline(DXF_LAYERS.wiring, seg.points, { color: colorOf(seg.circuitId) });
  }
  for (const leg of wiring?.switchLegs ?? []) {
    out.polyline(DXF_LAYERS.wiring, leg.points, { color: colorOf(leg.circuitId) });
  }

  // Violations are per circuit: label at the circuit's home-run device, else the panel.
  const homeRunEnd = new Map<string, Point>();

  for (const seg of wiring?.segments ?? []) {
    if (seg.from === "panel" && !homeRunEnd.has(seg.circuitId)) {
      homeRunEnd.set(seg.circuitId, seg.points[seg.points.length - 1]);
    }
  }
  const fallback = input.panel?.position ?? { x: 0, y: 0 };

  (input.result?.violations ?? []).forEach((v, i) => {
    const at = (v.circuitId && homeRunEnd.get(v.circuitId)) || fallback;

    out.text(DXF_LAYERS.violations, { x: at.x, y: at.y + 0.15 * (i % 4) }, 0.1, `${v.ruleId}: ${v.message}`);
  });

  out.pair(0, "ENDSEC");
  out.pair(0, "EOF");

  return out.toString();
}
