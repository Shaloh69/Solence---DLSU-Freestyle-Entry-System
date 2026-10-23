/**
 * W12 — DXF export (walls, rooms, devices, wiring on named layers that
 * match the editor's layer presets) and DXF import of walls.
 *
 * Real data: the 12 ResPlan houses (tests/helpers/real-plans.ts), fitted
 * out and simulated, exported to DXF and imported back. Every wall must
 * come back within 1 cm (endpoints and thickness), in meters and in mm.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { InMemoryProjectRepository } from "../src/db/repository.js";
import { exportDxf, importDxfWalls, parseDxf, DXF_LAYERS, DxfImportError } from "../src/engine/dxf/index.js";
import { simulate, SimulationResult } from "../src/engine/simulate.js";
import type { FloorPlan, Wall } from "../src/engine/types.js";
import { fitOut, loadRealPlans, RealPlan } from "./helpers/real-plans.js";

const TOLERANCE_M = 0.01;
const DEFAULT_THICKNESS = 0.15;

interface Built {
  plan: RealPlan;
  fit: ReturnType<typeof fitOut>;
  result: SimulationResult;
}

const plans = loadRealPlans();
const built = new Map<string, Built>();

beforeAll(() => {
  for (const plan of plans) {
    const fit = fitOut(plan.floorPlan, { system: "1P2W-230", voltage: 230 });
    const result = simulate({ floorPlan: plan.floorPlan, panel: fit.panel, loads: fit.loads });

    built.set(plan.id, { plan, fit, result });
  }
}, 120_000);

function exportOf(b: Built, units?: "m" | "mm" | "cm"): string {
  return exportDxf({
    floorPlan: b.plan.floorPlan,
    panel: b.fit.panel,
    loads: b.fit.loads,
    result: b.result,
    units,
  });
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Worst endpoint/thickness error of `wall` against its best match in `candidates`. */
function bestMatch(wall: Wall, candidates: Wall[]): number {
  let best = Infinity;

  for (const c of candidates) {
    const same = Math.max(dist(wall.start, c.start), dist(wall.end, c.end));
    const flipped = Math.max(dist(wall.start, c.end), dist(wall.end, c.start));
    const thick = Math.abs((wall.thickness ?? DEFAULT_THICKNESS) - (c.thickness ?? DEFAULT_THICKNESS));

    best = Math.min(best, Math.max(Math.min(same, flipped), thick));
  }

  return best;
}

function expectWallsPreserved(original: FloorPlan, imported: FloorPlan) {
  expect(imported.walls).toHaveLength(original.walls.length);
  for (const wall of original.walls) {
    expect(bestMatch(wall, imported.walls), `wall ${wall.id}`).toBeLessThanOrEqual(TOLERANCE_M);
  }
  for (const wall of imported.walls) {
    expect(bestMatch(wall, original.walls)).toBeLessThanOrEqual(TOLERANCE_M);
  }
  expect(Math.abs(imported.width - original.width)).toBeLessThanOrEqual(TOLERANCE_M);
  expect(Math.abs(imported.height - original.height)).toBeLessThanOrEqual(TOLERANCE_M);
}

/** Entities per layer and type, from the parsed DXF. */
function census(text: string): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();

  for (const entity of parseDxf(text).entities) {
    const byType = out.get(entity.layer) ?? new Map<string, number>();

    byType.set(entity.type, (byType.get(entity.type) ?? 0) + 1);
    out.set(entity.layer, byType);
  }

  return out;
}

const count = (c: Map<string, Map<string, number>>, layer: string, type: string) =>
  c.get(layer)?.get(type) ?? 0;

describe("W12 DXF: layers match the editor's layer presets", () => {
  it("has one DXF layer per exportable LayerKey of client/lib/layers.ts (heatmap is raster, not exported)", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, "../../client/lib/layers.ts"), "utf8");
    const block = /export const LAYER_KEYS: LayerKey\[\] = \[([^\]]*)\]/.exec(source);

    expect(block).not.toBeNull();
    const keys = [...block![1].matchAll(/"(\w+)"/g)].map((m) => m[1]);

    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      if (key === "heatmap") {
        expect(DXF_LAYERS).not.toHaveProperty(key);
      } else {
        expect(DXF_LAYERS, key).toHaveProperty(key);
      }
    }
    expect(Object.keys(DXF_LAYERS).sort()).toEqual(keys.filter((k) => k !== "heatmap").sort());
  });

  for (const plan of plans) {
    it(`${plan.id}: every layer is declared in the LAYER table and carries its objects`, () => {
      const b = built.get(plan.id)!;
      const text = exportOf(b);
      const parsed = parseDxf(text);

      expect(parsed.header.$ACADVER).toBe("AC1009");
      expect(parsed.header.$INSUNITS).toBe(6);
      for (const name of Object.values(DXF_LAYERS)) {
        expect(parsed.layers, name).toContain(name);
      }

      const c = census(text);
      const lighting = b.fit.loads.filter((l) => l.type === "lighting").length;
      const other = b.fit.loads.length - lighting;
      const wiring = b.result.wiring;

      expect(count(c, DXF_LAYERS.walls, "POLYLINE")).toBe(plan.floorPlan.walls.length);
      expect(count(c, DXF_LAYERS.rooms, "POLYLINE")).toBe(plan.floorPlan.rooms.length);
      expect(count(c, DXF_LAYERS.rooms, "TEXT")).toBe(plan.floorPlan.rooms.length);
      expect(count(c, DXF_LAYERS.lighting, "CIRCLE")).toBe(lighting + wiring.switches.length);
      expect(count(c, DXF_LAYERS.loads, "CIRCLE")).toBe(other);
      // Panel outline.
      expect(count(c, DXF_LAYERS.loads, "POLYLINE")).toBe(1);
      expect(count(c, DXF_LAYERS.wiring, "POLYLINE")).toBe(
        wiring.segments.length + wiring.switchLegs.length
      );
      expect(wiring.segments.length).toBeGreaterThan(0);
      expect(wiring.switches.length).toBeGreaterThan(0);
      expect(count(c, DXF_LAYERS.furniture, "POLYLINE")).toBe(plan.floorPlan.furniture?.length ?? 0);
      expect(count(c, DXF_LAYERS.violations, "TEXT")).toBe(b.result.violations.length);
      // Nothing lands on an undeclared layer.
      for (const layer of c.keys()) expect(parsed.layers).toContain(layer);
    });
  }
});

describe("W12 DXF: export → import round-trip preserves walls within 1 cm", () => {
  for (const plan of plans) {
    it(`${plan.id} (meters)`, () => {
      const b = built.get(plan.id)!;
      const { floorPlan, report } = importDxfWalls(exportOf(b));

      expect(report.units).toBe("m");
      expect(report.wallLayers).toEqual([DXF_LAYERS.walls]);
      expectWallsPreserved(plan.floorPlan, floorPlan);
    });

    it(`${plan.id} (millimeters, $INSUNITS 4)`, () => {
      const b = built.get(plan.id)!;
      const text = exportOf(b, "mm");

      expect(parseDxf(text).header.$INSUNITS).toBe(4);
      const { floorPlan, report } = importDxfWalls(text);

      expect(report.units).toBe("mm");
      expect(report.scaleToMeters).toBe(0.001);
      expectWallsPreserved(plan.floorPlan, floorPlan);
    });
  }
});

/** A third-party style drawing: mm units, AIA layer names, LINE + LWPOLYLINE + POLYLINE. */
const FOREIGN_MM_DXF = [
  "0", "SECTION", "2", "HEADER",
  "9", "$ACADVER", "1", "AC1015",
  "9", "$INSUNITS", "70", "4",
  "0", "ENDSEC",
  "0", "SECTION", "2", "ENTITIES",
  // 8 m bottom wall as a LINE, 150 mm (no width → default thickness).
  "0", "LINE", "8", "A-WALL", "10", "1000.0", "20", "1000.0", "30", "0.0", "11", "9000.0", "21", "1000.0", "31", "0.0",
  // Closed LWPOLYLINE, 200 mm constant width: 3 more walls of a 8 × 6 m box... drawn as an open U.
  "0", "LWPOLYLINE", "8", "A-WALL", "90", "4", "70", "0", "43", "200",
  "10", "9000", "20", "1000",
  "10", "9000", "20", "7000",
  "10", "1000", "20", "7000",
  "10", "1000", "20", "1000",
  // Interior partition as an R12 POLYLINE, 100 mm wide.
  "0", "POLYLINE", "8", "A-WALL-INTR", "66", "1", "10", "0", "20", "0", "30", "0", "70", "0", "40", "100", "41", "100",
  "0", "VERTEX", "8", "A-WALL-INTR", "10", "5000", "20", "1000", "30", "0",
  "0", "VERTEX", "8", "A-WALL-INTR", "10", "5000", "20", "7000", "30", "0",
  "0", "SEQEND", "8", "A-WALL-INTR",
  // Not walls: furniture and text must be ignored.
  "0", "LINE", "8", "I-FURN", "10", "2000", "20", "2000", "11", "3000", "21", "2000",
  "0", "TEXT", "8", "A-ANNO", "10", "2000", "20", "2000", "40", "200", "1", "Kitchen",
  "0", "ENDSEC",
  "0", "EOF",
].join("\r\n");

describe("W12 DXF import: units and foreign layer names", () => {
  it("reads a mm drawing ($INSUNITS 4) with LINE, LWPOLYLINE and POLYLINE walls into meters", () => {
    const { floorPlan, report } = importDxfWalls(FOREIGN_MM_DXF);

    expect(report.units).toBe("mm");
    expect(report.wallLayers.sort()).toEqual(["A-WALL", "A-WALL-INTR"]);
    expect(floorPlan.walls).toHaveLength(5);

    const lengths = floorPlan.walls.map((w) => Number(dist(w.start, w.end).toFixed(3))).sort();

    expect(lengths).toEqual([6, 6, 6, 8, 8]);
    const thick = floorPlan.walls.map((w) => w.thickness).sort();

    expect(thick).toEqual([0.1, 0.2, 0.2, 0.2, undefined]);
    // No limits in the file: the frame is the walls' extent plus a margin, y flipped to y-down.
    for (const w of floorPlan.walls) {
      for (const p of [w.start, w.end]) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(floorPlan.width);
        expect(p.y).toBeLessThanOrEqual(floorPlan.height);
      }
    }
    // The 8 m LINE at drawing y = 1000 mm is the bottom wall: largest plan y.
    const bottom = floorPlan.walls.find((w) => w.thickness === undefined)!;

    expect(bottom.start.y).toBeCloseTo(Math.max(...floorPlan.walls.flatMap((w) => [w.start.y, w.end.y])), 6);
    expect(floorPlan.width).toBeCloseTo(8 + 2 * report.marginM, 6);
    expect(floorPlan.height).toBeCloseTo(6 + 2 * report.marginM, 6);
  });

  it("a units override wins over an unitless file", () => {
    const unitless = FOREIGN_MM_DXF.replace("$INSUNITS\r\n70\r\n4", "$INSUNITS\r\n70\r\n0");
    const { floorPlan, report } = importDxfWalls(unitless, { units: "mm" });

    expect(report.units).toBe("mm");
    expect(Math.max(...floorPlan.walls.map((w) => dist(w.start, w.end)))).toBeCloseTo(8, 6);
  });

  it("inches ($INSUNITS 1) scale by 0.0254", () => {
    const inches = FOREIGN_MM_DXF.replace("$INSUNITS\r\n70\r\n4", "$INSUNITS\r\n70\r\n1");
    const { floorPlan, report } = importDxfWalls(inches);

    expect(report.units).toBe("in");
    expect(Math.max(...floorPlan.walls.map((w) => dist(w.start, w.end)))).toBeCloseTo(8000 * 0.0254, 6);
  });

  it("explicit wallLayers restrict the import", () => {
    const { floorPlan } = importDxfWalls(FOREIGN_MM_DXF, { wallLayers: ["A-WALL-INTR"] });

    expect(floorPlan.walls).toHaveLength(1);
  });

  it("rejects a file with no walls, and malformed input", () => {
    const noWalls = FOREIGN_MM_DXF.replace(/A-WALL/g, "X-THING");

    expect(() => importDxfWalls(noWalls)).toThrow(DxfImportError);
    expect(() => importDxfWalls("not a dxf")).toThrow(DxfImportError);
    expect(() => importDxfWalls("0\r\nSECTION\r\nabc\r\nHEADER")).toThrow(DxfImportError);
  });
});

describe("W12 DXF API", () => {
  const plan = plans[0];

  async function seeded(withResult: boolean) {
    const app = createApp({ repository: new InMemoryProjectRepository() });
    const created = await request(app).post("/api/projects").send({ name: "DXF house" });
    const id = created.body.id as string;
    const b = built.get(plan.id)!;

    await request(app).put(`/api/projects/${id}/floorplan`).send(plan.floorPlan).expect(200);
    await request(app).put(`/api/projects/${id}/panel`).send(b.fit.panel).expect(200);
    await request(app).put(`/api/projects/${id}/loads`).send(b.fit.loads).expect(200);
    if (withResult) await request(app).post(`/api/projects/${id}/simulate`).send({}).expect(200);

    return { app, id };
  }

  it("POST /projects/:id/export/dxf returns an R12 DXF attachment with wiring from the last result", async () => {
    const { app, id } = await seeded(true);
    const res = await request(app)
      .post(`/api/projects/${id}/export/dxf`)
      .send({ units: "mm" })
      .buffer(true)
      .parse((r, cb) => {
        let data = "";

        r.setEncoding("utf8");
        r.on("data", (chunk: string) => (data += chunk));
        r.on("end", () => cb(null, data));
      })
      .expect(200);

    expect(res.headers["content-type"]).toMatch(/application\/dxf/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename=".*\.dxf"/);
    const text = res.body as string;
    const c = census(text);

    expect(parseDxf(text).header.$INSUNITS).toBe(4);
    expect(count(c, DXF_LAYERS.wiring, "POLYLINE")).toBeGreaterThan(0);
    expectWallsPreserved(plan.floorPlan, importDxfWalls(text).floorPlan);
  });

  it("export works before a simulation (no wiring layer content) and validates units", async () => {
    const { app, id } = await seeded(false);
    const res = await request(app).post(`/api/projects/${id}/export/dxf`).send({}).expect(200);

    expect(String(res.text)).toContain("SOLENCE-WALLS");
    await request(app).post(`/api/projects/${id}/export/dxf`).send({ units: "furlong" }).expect(400);
  });

  it("export: 404 unknown project, 422 without a floor plan", async () => {
    const app = createApp({ repository: new InMemoryProjectRepository() });

    await request(app).post(`/api/projects/nope/export/dxf`).send({}).expect(404);
    const created = await request(app).post("/api/projects").send({ name: "empty" });

    await request(app).post(`/api/projects/${created.body.id}/export/dxf`).send({}).expect(422);
  });

  it("POST /projects/:id/import/dxf replaces the walls, keeps rooms, drops stale openings", async () => {
    const { app, id } = await seeded(false);
    const res = await request(app)
      .post(`/api/projects/${id}/import/dxf`)
      .send({ dxf: FOREIGN_MM_DXF })
      .expect(200);

    expect(res.body.import.units).toBe("mm");
    expect(res.body.import.wallCount).toBe(5);
    expect(res.body.project.floorPlan.walls).toHaveLength(5);
    expect(res.body.project.floorPlan.rooms).toHaveLength(plan.floorPlan.rooms.length);
    expect(res.body.project.floorPlan.openings ?? []).toHaveLength(0);
    // Stored, not just echoed.
    const stored = await request(app).get(`/api/projects/${id}`).expect(200);

    expect(stored.body.floorPlan.walls).toHaveLength(5);
  });

  it("import into a project without a floor plan creates one", async () => {
    const app = createApp({ repository: new InMemoryProjectRepository() });
    const created = await request(app).post("/api/projects").send({ name: "blank" });
    const res = await request(app)
      .post(`/api/projects/${created.body.id}/import/dxf`)
      .send({ dxf: FOREIGN_MM_DXF, units: "mm" })
      .expect(200);

    expect(res.body.project.floorPlan.walls).toHaveLength(5);
    expect(res.body.project.floorPlan.rooms).toEqual([]);
  });

  it("import: 400 bad body, 404 unknown project, 422 no walls found", async () => {
    const { app, id } = await seeded(false);

    await request(app).post(`/api/projects/${id}/import/dxf`).send({}).expect(400);
    await request(app).post(`/api/projects/${id}/import/dxf`).send({ dxf: FOREIGN_MM_DXF, units: "parsec" }).expect(400);
    await request(app).post(`/api/projects/nope/import/dxf`).send({ dxf: FOREIGN_MM_DXF }).expect(404);
    await request(app)
      .post(`/api/projects/${id}/import/dxf`)
      .send({ dxf: FOREIGN_MM_DXF.replace(/A-WALL/g, "X-THING") })
      .expect(422);
    // The failed import changed nothing.
    const stored = await request(app).get(`/api/projects/${id}`).expect(200);

    expect(stored.body.floorPlan.walls).toHaveLength(plan.floorPlan.walls.length);
  });
});
