/**
 * Minimal ASCII DXF reader (any version R12…R2018 for the entities used
 * here) and wall import (W12).
 *
 * Walls: LINE, LWPOLYLINE and POLYLINE (with VERTEX/SEQEND) on wall
 * layers become straight FloorPlan walls; a polyline's width becomes the
 * wall thickness. Arcs/bulges, blocks (INSERT) and binary DXF are not
 * read — the report counts what was skipped on wall layers.
 *
 * Units: `$INSUNITS` (in, ft, mm, cm, m) or an explicit override; a
 * unitless file is read as meters unless `units` is given.
 * Frame: when `$LIMMIN`/`$LIMMAX` contain every wall (Solence exports
 * write the plan frame there) they define the plan origin and size;
 * otherwise the walls' extent plus a margin does. y is flipped to the
 * plan's y-down convention.
 */
import type { DxfImportReport, DxfUnits, FloorPlan, Point, Wall } from "../types.js";
import { DXF_LAYERS, DXF_UNITS, unitsForInsunits } from "./layers.js";

export class DxfImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DxfImportError";
  }
}

export interface DxfEntity {
  type: string;
  layer: string;
  pairs: [number, string][];
  /** POLYLINE only: its VERTEX entities. */
  vertices?: [number, string][][];
}

export interface ParsedDxf {
  header: Record<string, string | number | Point>;
  /** Layer names declared in the LAYER table. */
  layers: string[];
  entities: DxfEntity[];
}

const MAX_WALLS = 20_000;
const MAX_PLAN_M = 1000;
const MARGIN_M = 0.5;

/** Splits DXF text into (group code, value) pairs. */
function pairsOf(text: string): [number, string][] {
  const lines = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);

  if (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length < 2 || lines.length % 2 !== 0) {
    throw new DxfImportError("Not an ASCII DXF file (group code/value lines don't pair up)");
  }
  const out: [number, string][] = [];

  for (let i = 0; i < lines.length; i += 2) {
    const raw = lines[i].trim();

    if (!/^-?\d+$/.test(raw)) {
      throw new DxfImportError(`Not an ASCII DXF file (bad group code "${raw.slice(0, 20)}" on line ${i + 1})`);
    }
    out.push([Number(raw), lines[i + 1].trim()]);
  }

  return out;
}

function headerValue(pairs: [number, string][]): string | number | Point {
  const x = pairs.find(([c]) => c === 10);
  const y = pairs.find(([c]) => c === 20);

  if (x && y) return { x: Number(x[1]), y: Number(y[1]) };
  const first = pairs[0];

  if (!first) return "";

  return first[0] >= 60 && first[0] <= 99 ? Number(first[1]) : first[1];
}

export function parseDxf(text: string): ParsedDxf {
  const pairs = pairsOf(text);
  const header: ParsedDxf["header"] = {};
  const layers: string[] = [];
  const entities: DxfEntity[] = [];
  let section = "";
  let i = 0;

  while (i < pairs.length) {
    const [code, value] = pairs[i];

    if (code === 0 && value === "SECTION") {
      section = pairs[i + 1]?.[0] === 2 ? pairs[i + 1][1] : "";
      i += 2;
      continue;
    }
    if (code === 0 && (value === "ENDSEC" || value === "EOF")) {
      section = "";
      i += 1;
      continue;
    }

    if (section === "HEADER" && code === 9) {
      let j = i + 1;

      while (j < pairs.length && pairs[j][0] !== 9 && pairs[j][0] !== 0) j++;
      header[value] = headerValue(pairs.slice(i + 1, j));
      i = j;
      continue;
    }

    if ((section === "TABLES" || section === "ENTITIES") && code === 0) {
      let j = i + 1;

      while (j < pairs.length && pairs[j][0] !== 0) j++;
      const body = pairs.slice(i + 1, j);

      if (section === "TABLES") {
        if (value === "LAYER") {
          const name = body.find(([c]) => c === 2);

          if (name) layers.push(name[1]);
        }
      } else if (value === "VERTEX" || value === "SEQEND") {
        const last = entities[entities.length - 1];

        if (value === "VERTEX" && last?.type === "POLYLINE") (last.vertices ??= []).push(body);
      } else {
        entities.push({
          type: value,
          layer: body.find(([c]) => c === 8)?.[1] ?? "0",
          pairs: body,
          vertices: value === "POLYLINE" ? [] : undefined,
        });
      }
      i = j;
      continue;
    }
    i += 1;
  }

  return { header, layers, entities };
}

const num = (pairs: [number, string][], code: number): number | undefined => {
  const hit = pairs.find(([c]) => c === code);
  const v = hit ? Number(hit[1]) : undefined;

  return v !== undefined && Number.isFinite(v) ? v : undefined;
};

/** Default wall-layer test for drawings not made by Solence: "WALL"/"WALLS" as a name token (A-WALL, WALLS, A-WALL-INTR). */
const WALL_LAYER = /(^|[-_ .|])WALLS?([-_ .|]|$)/i;

export interface DxfImportOptions {
  /** Overrides `$INSUNITS`. */
  units?: DxfUnits;
  /** Layers to read walls from (exact names); default: SOLENCE-WALLS, else any WALL-named layer. */
  wallLayers?: string[];
}

interface Segment {
  a: Point;
  b: Point;
  width?: number;
}

function segmentsOf(entity: DxfEntity, skipped: Record<string, number>): Segment[] {
  const p = entity.pairs;

  if (entity.type === "LINE") {
    const [x1, y1, x2, y2] = [num(p, 10), num(p, 20), num(p, 11), num(p, 21)];

    if ([x1, y1, x2, y2].some((v) => v === undefined)) return [];
    // A LINE has no width (its 39 "thickness" is extrusion height): default wall thickness.
    return [{ a: { x: x1!, y: y1! }, b: { x: x2!, y: y2! } }];
  }

  let points: { pt: Point; width?: number }[] = [];
  let closed = false;
  let constant: number | undefined;

  if (entity.type === "LWPOLYLINE") {
    closed = ((num(p, 70) ?? 0) & 1) === 1;
    constant = num(p, 43);
    for (let k = 0; k < p.length; k++) {
      if (p[k][0] === 10) {
        const y = p[k + 1]?.[0] === 20 ? Number(p[k + 1][1]) : NaN;

        points.push({ pt: { x: Number(p[k][1]), y } });
      } else if (p[k][0] === 40 && points.length > 0) {
        points[points.length - 1].width = Number(p[k][1]);
      }
      if (p[k][0] === 42 && Number(p[k][1]) !== 0) skipped["LWPOLYLINE bulge (arc read as straight)"] = (skipped["LWPOLYLINE bulge (arc read as straight)"] ?? 0) + 1;
    }
  } else if (entity.type === "POLYLINE") {
    const flags = num(p, 70) ?? 0;

    if (flags & (16 | 64)) {
      skipped["POLYLINE mesh"] = (skipped["POLYLINE mesh"] ?? 0) + 1;

      return [];
    }
    closed = (flags & 1) === 1;
    constant = num(p, 40); // default starting width
    for (const v of entity.vertices ?? []) {
      if (((num(v, 70) ?? 0) & 16) !== 0) continue; // spline frame control point
      const x = num(v, 10);
      const y = num(v, 20);

      if (x === undefined || y === undefined) continue;
      points.push({ pt: { x, y }, width: num(v, 40) });
    }
  } else {
    skipped[entity.type] = (skipped[entity.type] ?? 0) + 1;

    return [];
  }

  points = points.filter((q) => Number.isFinite(q.pt.x) && Number.isFinite(q.pt.y));
  const out: Segment[] = [];
  const count = closed ? points.length : points.length - 1;

  for (let k = 0; k < count; k++) {
    const from = points[k];
    const to = points[(k + 1) % points.length];

    out.push({ a: from.pt, b: to.pt, width: from.width ?? constant });
  }

  return out;
}

/** Reads the walls of a DXF drawing into a FloorPlan (meters, y-down). */
export function importDxfWalls(
  text: string,
  options: DxfImportOptions = {}
): { floorPlan: FloorPlan; report: DxfImportReport } {
  const parsed = parseDxf(text);
  const insunits = typeof parsed.header.$INSUNITS === "number" ? parsed.header.$INSUNITS : 0;
  let units: DxfUnits;

  if (options.units) {
    units = options.units;
  } else if (insunits === 0) {
    units = "m";
  } else {
    const known = unitsForInsunits(insunits);

    if (!known) {
      throw new DxfImportError(
        `Drawing units $INSUNITS=${insunits} are not supported — pass units (m, cm, mm, in, ft)`
      );
    }
    units = known;
  }
  const scale = DXF_UNITS[units].meters;

  const allLayers = new Set([...parsed.layers, ...parsed.entities.map((e) => e.layer)]);
  let wallLayerSet: Set<string>;

  if (options.wallLayers?.length) {
    wallLayerSet = new Set(options.wallLayers);
  } else if (parsed.entities.some((e) => e.layer === DXF_LAYERS.walls)) {
    wallLayerSet = new Set([DXF_LAYERS.walls]);
  } else {
    wallLayerSet = new Set([...allLayers].filter((name) => WALL_LAYER.test(name)));
  }

  const skipped: Record<string, number> = {};
  const segments: Segment[] = [];
  const used = new Set<string>();

  for (const entity of parsed.entities) {
    if (!wallLayerSet.has(entity.layer)) continue;
    const segs = segmentsOf(entity, skipped);

    if (segs.length > 0) used.add(entity.layer);
    segments.push(...segs);
  }

  const drawn = segments
    .map((s) => ({
      a: { x: s.a.x * scale, y: s.a.y * scale },
      b: { x: s.b.x * scale, y: s.b.y * scale },
      width: s.width !== undefined && s.width > 0 ? s.width * scale : undefined,
    }))
    .filter((s) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) > 1e-6);

  if (drawn.length === 0) {
    throw new DxfImportError(
      `No walls found (LINE/LWPOLYLINE/POLYLINE) on ${
        wallLayerSet.size ? [...wallLayerSet].join(", ") : "any WALL layer"
      } — layers in the file: ${[...allLayers].join(", ") || "none"}`
    );
  }
  if (drawn.length > MAX_WALLS) {
    throw new DxfImportError(`Too many wall segments (${drawn.length} > ${MAX_WALLS})`);
  }

  const xs = drawn.flatMap((s) => [s.a.x, s.b.x]);
  const ys = drawn.flatMap((s) => [s.a.y, s.b.y]);
  const bbox = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  const limMin = parsed.header.$LIMMIN;
  const limMax = parsed.header.$LIMMAX;
  const eps = 1e-6;
  let frame: { left: number; top: number; width: number; height: number };
  let usedLimits = false;

  if (
    typeof limMin === "object" &&
    typeof limMax === "object" &&
    limMin.x * scale <= bbox.minX + eps &&
    limMin.y * scale <= bbox.minY + eps &&
    limMax.x * scale >= bbox.maxX - eps &&
    limMax.y * scale >= bbox.maxY - eps
  ) {
    frame = {
      left: limMin.x * scale,
      top: limMax.y * scale,
      width: (limMax.x - limMin.x) * scale,
      height: (limMax.y - limMin.y) * scale,
    };
    usedLimits = true;
  } else {
    frame = {
      left: bbox.minX - MARGIN_M,
      top: bbox.maxY + MARGIN_M,
      width: bbox.maxX - bbox.minX + 2 * MARGIN_M,
      height: bbox.maxY - bbox.minY + 2 * MARGIN_M,
    };
  }

  if (frame.width > MAX_PLAN_M || frame.height > MAX_PLAN_M) {
    throw new DxfImportError(
      `Drawing is ${frame.width.toFixed(0)} × ${frame.height.toFixed(0)} m in ${units} — larger than ${MAX_PLAN_M} m; check the units`
    );
  }

  const toPlan = (p: Point): Point => ({ x: p.x - frame.left, y: frame.top - p.y });
  const walls: Wall[] = drawn.map((s, k) => ({
    id: `dxf-w-${k + 1}`,
    start: toPlan(s.a),
    end: toPlan(s.b),
    ...(s.width !== undefined ? { thickness: Math.min(s.width, 2) } : {}),
  }));

  return {
    floorPlan: { width: frame.width, height: frame.height, walls, rooms: [] },
    report: {
      units,
      scaleToMeters: scale,
      wallLayers: [...used].sort(),
      wallCount: walls.length,
      layers: [...allLayers].sort(),
      skipped,
      frame: usedLimits ? "limits" : "extents",
      marginM: usedLimits ? 0 : MARGIN_M,
    },
  };
}
