/**
 * W6 — ampacity correction (ambient), adjustment (>3 current-carrying
 * conductors per raceway) and conduit trade size by fill (WIRING-AUDIT F-13).
 *
 * Hand-checked cases pin the PEC-VERIFY factors (sizing/pec-derating.ts)
 * and the arithmetic; the real-plan block runs all 12 ResPlan houses and
 * proves no circuit violates after resizing and every raceway is within
 * its fill limit (40% for more than two conductors).
 */
import { describe, expect, it } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { simulate } from "../src/engine/simulate.js";
import { checkAmpacity } from "../src/engine/compliance/index.js";
import { PEC_TABLE_3_10_1 } from "../src/engine/sizing/pec-table-3-10-1.js";
import {
  ambientCorrectionFactor,
  adjustmentFactor,
  currentCarryingCount,
  deratedAmpacity,
  sizeConductorForConditions,
  sizeConduit,
} from "../src/engine/sizing/raceway.js";
import {
  CONDUIT_TRADE_SIZES,
  DEFAULT_AMBIENT_TEMP_C,
  conductorAreaMm2,
  fillLimitPercent,
} from "../src/engine/sizing/pec-derating.js";
import { applyRaceways } from "../src/engine/raceways.js";
import { createApp } from "../src/app.js";
import { InMemoryProjectRepository } from "../src/db/repository.js";
import type {
  Circuit,
  CircuitWiring,
  SegmentConductor,
  WireRole,
} from "../src/engine/types.js";
import { fitOut, loadRealPlans } from "./helpers/real-plans.js";

const thresholds = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "thresholds.json"), "utf8")
) as { simulateMsPerPlanMax: number };

const row = (awg: string) => PEC_TABLE_3_10_1.find((r) => r.awg === awg)!;
const wires = (...roles: WireRole[]): SegmentConductor[] =>
  roles.map((role) => ({ role, awg: "14", mm2: 2.0, color: "x" }));

describe("PEC-VERIFY factors (hand-checked against the NEC 2014 tables PEC 2017 mirrors)", () => {
  it("ambient correction, 30 °C basis: 35 °C → 0.91 / 0.94 / 0.96, 40 °C → 0.82 / 0.88 / 0.91", () => {
    expect(ambientCorrectionFactor(30, "TW")).toBe(1);
    expect(ambientCorrectionFactor(35, "TW")).toBe(0.91);
    expect(ambientCorrectionFactor(35, "THW")).toBe(0.94);
    expect(ambientCorrectionFactor(35, "THHN")).toBe(0.96);
    expect(ambientCorrectionFactor(36, "TW")).toBe(0.82);
    expect(ambientCorrectionFactor(40, "TW")).toBe(0.82);
    expect(ambientCorrectionFactor(40, "THHN")).toBe(0.91);
    expect(ambientCorrectionFactor(45, "THHN")).toBe(0.87);
    expect(ambientCorrectionFactor(20, "TW")).toBe(1.15);
    expect(DEFAULT_AMBIENT_TEMP_C).toBe(35);
  });

  it("refuses an ambient above the insulation's table (60 °C wire at 56 °C)", () => {
    expect(() => ambientCorrectionFactor(56, "TW")).toThrow();
    expect(ambientCorrectionFactor(56, "THHN")).toBe(0.71);
  });

  it("adjustment: ≤3 → 1, 4–6 → 0.80, 7–9 → 0.70, 10–20 → 0.50, 21–30 → 0.45, 31–40 → 0.40, ≥41 → 0.35", () => {
    const cases: [number, number][] = [
      [1, 1], [3, 1], [4, 0.8], [6, 0.8], [7, 0.7], [9, 0.7], [10, 0.5],
      [20, 0.5], [21, 0.45], [30, 0.45], [31, 0.4], [40, 0.4], [41, 0.35], [60, 0.35],
    ];

    for (const [n, f] of cases) expect(adjustmentFactor(n), `${n} conductors`).toBe(f);
  });

  it("counts L, L2, L3, N, S and both travelers; never the equipment ground", () => {
    expect(currentCarryingCount(wires("L", "N", "G"))).toBe(2);
    expect(currentCarryingCount(wires("L", "N", "S", "G"))).toBe(3);
    expect(currentCarryingCount(wires("L", "N", "S", "S", "G"))).toBe(4);
    expect(currentCarryingCount(wires("L", "L2", "G"))).toBe(2);
    expect(currentCarryingCount(wires("L", "L2", "L3", "G"))).toBe(3);
    expect(currentCarryingCount(wires("S", "T", "T", "G"))).toBe(3);
    expect(currentCarryingCount(wires("L", "S", "G"))).toBe(2);
  });

  it("fill limits: 1 conductor 53%, 2 → 31%, more than 2 → 40%", () => {
    expect(fillLimitPercent(1)).toBe(53);
    expect(fillLimitPercent(2)).toBe(31);
    expect(fillLimitPercent(3)).toBe(40);
    expect(fillLimitPercent(12)).toBe(40);
  });

  it("conduit sizes ascend from 16 mm (1/2\") and conductor areas grow with size", () => {
    expect(CONDUIT_TRADE_SIZES[0].metricMm).toBe(16);
    for (let i = 1; i < CONDUIT_TRADE_SIZES.length; i++) {
      expect(CONDUIT_TRADE_SIZES[i].areaMm2).toBeGreaterThan(CONDUIT_TRADE_SIZES[i - 1].areaMm2);
    }
    expect(conductorAreaMm2("14", "THHN")).toBeCloseTo(6.258, 3);
    expect(conductorAreaMm2("14", "TW")).toBeCloseTo(8.968, 3);
    expect(conductorAreaMm2("10", "THHN")).toBeCloseTo(13.61, 2);
    for (const r of PEC_TABLE_3_10_1) {
      for (const ins of ["TW", "THW", "THHN", "XHHW"] as const) {
        expect(conductorAreaMm2(r.awg, ins), `${r.awg} ${ins}`).toBeGreaterThan(r.mm2);
      }
    }
  });
});

describe("derated ampacity and resizing (hand-checked)", () => {
  it("2.0 mm² THHN, 35 °C, 4 conductors: 25 × 0.96 × 0.80 = 19.2 A, capped at 15 A by 60 °C terminals", () => {
    expect(deratedAmpacity(row("14"), "THHN", 60, { ambientTempC: 35, currentCarrying: 4 })).toBe(15);
  });

  it("2.0 mm² TW, 35 °C, 3 conductors: 15 × 0.91 = 13.65 A — under a 15 A breaker", () => {
    expect(deratedAmpacity(row("14"), "TW", 60, { ambientTempC: 35, currentCarrying: 3 })).toBeCloseTo(13.65, 6);
  });

  it("3.5 mm² THHN, 40 °C, 7 conductors: 30 × 0.91 × 0.70 = 19.11 A", () => {
    expect(deratedAmpacity(row("12"), "THHN", 60, { ambientTempC: 40, currentCarrying: 7 })).toBeCloseTo(19.11, 6);
  });

  it("20 A breaker, THHN, 40 °C, 7 conductors → 5.5 mm² (40 × 0.91 × 0.70 = 25.48 A)", () => {
    const c = sizeConductorForConditions(20, "THHN", { ambientTempC: 40, currentCarrying: 7 });

    expect(c.mm2).toBe(5.5);
    expect(c.ampacity).toBeCloseTo(25.48, 6);
  });

  it("15 A breaker, TW, 35 °C, ≤3 conductors → 3.5 mm² (20 × 0.91 = 18.2 A)", () => {
    expect(sizeConductorForConditions(15, "TW", { ambientTempC: 35, currentCarrying: 2 }).mm2).toBe(3.5);
  });

  it("15 A breaker, THHN, 35 °C, ≤3 conductors stays 2.0 mm² (terminal-limited 15 A)", () => {
    const c = sizeConductorForConditions(15, "THHN", { ambientTempC: 35, currentCarrying: 3 });

    expect(c.mm2).toBe(2.0);
    expect(c.ampacity).toBe(15);
  });
});

describe("conduit trade size by fill (hand-checked)", () => {
  it("L + N + G, 2.0 mm² THHN: 3 × 6.258 = 18.77 mm² in 16 mm (184 mm²) → 10.2%", () => {
    const r = sizeConduit([{ awg: "14" }, { awg: "14" }, { awg: "14" }], "THHN");

    expect(r.metricMm).toBe(16);
    expect(r.conductorAreaMm2).toBeCloseTo(18.774, 2);
    expect(r.fillPercent).toBeCloseTo(10.2, 1);
    expect(r.fillLimitPercent).toBe(40);
  });

  it("9 × 5.5 mm² THHN = 122.5 mm²: over 40% of 16 mm (73.6) → 21 mm (327 mm²) at 37.5%", () => {
    const r = sizeConduit(Array.from({ length: 9 }, () => ({ awg: "10" })), "THHN");

    expect(r.metricMm).toBe(21);
    expect(r.fillPercent).toBeCloseTo(37.5, 1);
  });

  it("two conductors use the 31% limit", () => {
    const r = sizeConduit([{ awg: "14" }, { awg: "14" }], "TW");

    expect(r.fillLimitPercent).toBe(31);
    expect(r.fillPercent).toBeCloseTo((2 * 8.968 * 100) / 184, 1);
  });
});

describe("applyRaceways on a hand-built circuit", () => {
  const circuit = (): Circuit => ({
    id: "ckt-1",
    description: "lighting",
    loadIds: ["a", "b"],
    connectedVa: 600,
    continuousVa: 600,
    voltage: 230,
    phase: "A",
    breakerAmps: 15,
    conductor: { awg: "14", mm2: 2.0, ampacity: 15, insulation: "TW", terminationTempC: 60 },
    groundingConductor: { awg: "14", mm2: 2.0 },
    lengthM: 10,
    voltageDropPercent: 0,
  });
  const c = (role: WireRole, groupId?: string): SegmentConductor => ({
    role, awg: "14", mm2: 2.0, color: "x", ...(groupId ? { groupId } : {}),
  });
  const wiring = (): CircuitWiring => ({
    segments: [
      {
        id: "ckt-1-s1", circuitId: "ckt-1", from: "panel", to: "a",
        points: [{ x: 0, y: 0 }, { x: 4, y: 0 }], lengthM: 4, penetrations: 0,
        conductors: [c("L"), c("N"), c("S", "g1"), c("S", "g2"), c("G")],
        downstreamVa: 600, downstreamAmps: 600 / 230,
      },
      {
        id: "ckt-1-s2", circuitId: "ckt-1", from: "a", to: "b",
        points: [{ x: 4, y: 0 }, { x: 10, y: 0 }], lengthM: 6, penetrations: 0,
        conductors: [c("L"), c("N"), c("G")],
        downstreamVa: 300, downstreamAmps: 300 / 230,
      },
    ],
    junctions: [],
    bom: { wire: [], conduitLengthM: 10, junctionBoxes: 0, switches: { oneWay: 0, twoWay: 0 } },
    lightingGroups: [],
    switches: [],
    switchLegs: [],
  });

  it("4 current-carrying TW at 35 °C: 2.0 → 5.5 mm² (15×0.728=10.9, 20×0.728=14.6, 30×0.728=21.8 A)", () => {
    const ckt = circuit();
    const w = wiring();

    applyRaceways([ckt], w, { ambientTempC: 35 });

    expect(ckt.conductor.mm2).toBe(5.5);
    expect(ckt.derating).toMatchObject({
      ambientTempC: 35,
      ambientFactor: 0.91,
      maxCurrentCarrying: 4,
      adjustmentFactor: 0.8,
      resizedFrom: { awg: "14", mm2: 2.0 },
    });
    expect(ckt.derating!.ampacity).toBeCloseTo(21.84, 6);
    // Every non-ground conductor follows the new size; the EGC stays (Table 2.50.6.13 by breaker).
    for (const s of w.segments) {
      for (const k of s.conductors) expect(k.mm2, `${s.id} ${k.role}`).toBe(k.role === "G" ? 2.0 : 5.5);
    }
    expect(w.segments[0].raceway).toMatchObject({ currentCarrying: 4, adjustmentFactor: 0.8, fillLimitPercent: 40 });
    expect(w.segments[1].raceway).toMatchObject({ currentCarrying: 2, adjustmentFactor: 1 });
    // BOM: wire by the new size, conduit by trade size sums to the conduit length.
    const l55 = w.bom.wire.filter((l) => l.mm2 === 5.5).reduce((s, l) => s + l.lengthM, 0);

    expect(l55).toBeCloseTo(4 * 4 + 6 * 2, 6);
    expect(w.bom.conduits!.reduce((s, x) => s + x.lengthM, 0)).toBeCloseTo(10, 6);
    // The compliance rule agrees: no ampacity violation after resizing...
    expect(checkAmpacity(ckt)).toEqual([]);
  });

  it("the ampacity rule fires on a derated conductor that no longer covers its breaker", () => {
    const ckt = circuit();

    ckt.derating = {
      ambientTempC: 35, ambientFactor: 0.91, maxCurrentCarrying: 3, adjustmentFactor: 1, ampacity: 15,
    };
    const v = checkAmpacity(ckt);

    expect(v.map((x) => x.ruleId)).toEqual(["ampacity"]);
    expect(v[0].pecReference).toMatch(/3\.10\.1\.15\(B\)/);
  });

  it("THHN at 30 °C with ≤3 conductors is left alone", () => {
    const ckt = { ...circuit(), conductor: { awg: "14", mm2: 2.0, ampacity: 15, insulation: "THHN" as const, terminationTempC: 60 as const } };
    const w = wiring();

    w.segments[0].conductors = [c("L"), c("N"), c("G")];
    applyRaceways([ckt], w, { ambientTempC: 30 });
    expect(ckt.conductor.mm2).toBe(2.0);
    expect(ckt.derating?.resizedFrom).toBeUndefined();
    expect(ckt.derating?.ampacity).toBe(15);
  });
});

describe("all 12 ResPlan houses", () => {
  const plans = loadRealPlans();
  const scenarios = [
    { name: "THHN, default 35 °C", insulation: "THHN" as const, ambientTempC: undefined },
    { name: "TW, 40 °C ceiling", insulation: "TW" as const, ambientTempC: 40 },
  ];

  it("covers the whole corpus", () => {
    expect(plans.length).toBe(12);
  });

  for (const sc of scenarios) {
    describe(sc.name, () => {
      for (const plan of plans) {
        it(`${plan.id}: no circuit violates after resizing; every raceway within its fill limit`, () => {
          const { panel, loads } = fitOut(plan.floorPlan, { system: "1P2W-230", voltage: 230 });
          const floorPlan = { ...plan.floorPlan, ...(sc.ambientTempC ? { ambientTempC: sc.ambientTempC } : {}) };
          const t0 = performance.now();
          const result = simulate({
            floorPlan,
            panel,
            loads,
            options: { circuits: { insulation: sc.insulation } },
          });

          expect(performance.now() - t0).toBeLessThanOrEqual(thresholds.simulateMsPerPlanMax);
          const ambient = sc.ambientTempC ?? 35;

          expect(result.violations.filter((v) => v.ruleId === "ampacity" || v.ruleId === "small-conductor")).toEqual([]);

          for (const ckt of result.circuits) {
            const d = ckt.derating!;

            expect(d, ckt.id).toBeDefined();
            expect(d.ambientTempC).toBe(ambient);
            expect(d.ambientFactor).toBe(ambientCorrectionFactor(ambient, sc.insulation));
            // Recomputed from the table, never trusted from the record.
            const usable = deratedAmpacity(row(ckt.conductor.awg), sc.insulation, ckt.conductor.terminationTempC, {
              ambientTempC: ambient,
              currentCarrying: d.maxCurrentCarrying,
            });

            expect(usable, ckt.id).toBeGreaterThanOrEqual(ckt.breakerAmps);
            // Smallest such size: the next smaller row would not do.
            const idx = PEC_TABLE_3_10_1.findIndex((r) => r.awg === ckt.conductor.awg);

            if (idx > 0 && d.resizedFrom) {
              const smaller = deratedAmpacity(PEC_TABLE_3_10_1[idx - 1], sc.insulation, ckt.conductor.terminationTempC, {
                ambientTempC: ambient,
                currentCarrying: d.maxCurrentCarrying,
              });

              expect(smaller, ckt.id).toBeLessThan(ckt.breakerAmps);
            }
          }

          const runs = [...result.wiring.segments, ...result.wiring.switchLegs];
          const byCircuit = new Map(result.circuits.map((c) => [c.id, c]));

          for (const run of runs) {
            const r = run.raceway!;
            const ckt = byCircuit.get(run.circuitId)!;

            expect(r, run.id).toBeDefined();
            expect(r.currentCarrying).toBe(currentCarryingCount(run.conductors));
            expect(r.currentCarrying).toBeLessThanOrEqual(ckt.derating!.maxCurrentCarrying);
            expect(r.fillPercent, run.id).toBeLessThanOrEqual(r.fillLimitPercent);
            if (run.conductors.length > 2) expect(r.fillPercent, run.id).toBeLessThanOrEqual(40);
            // Recomputed fill matches the raceway record.
            const area = run.conductors.reduce((s, k) => s + conductorAreaMm2(k.awg, sc.insulation), 0);
            const size = CONDUIT_TRADE_SIZES.find((t) => t.metricMm === r.metricMm)!;

            expect(r.conductorAreaMm2).toBeCloseTo(area, 6);
            expect(r.fillPercent).toBeCloseTo((area * 100) / size.areaMm2, 6);
            // Smallest trade size that fits.
            const i = CONDUIT_TRADE_SIZES.indexOf(size);

            if (i > 0) expect((area * 100) / CONDUIT_TRADE_SIZES[i - 1].areaMm2).toBeGreaterThan(r.fillLimitPercent);
            // Conductors in the run carry the circuit's (possibly resized) sizes.
            for (const k of run.conductors) {
              expect(k.mm2, `${run.id} ${k.role}`).toBe(k.role === "G" ? ckt.groundingConductor.mm2 : ckt.conductor.mm2);
            }
          }

          // BOM: conduit by trade size sums to the conduit length; wire matches the runs.
          const bom = result.wiring.bom;

          expect(bom.conduits!.reduce((s, x) => s + x.lengthM, 0)).toBeCloseTo(bom.conduitLengthM, 6);
          const wireTotal = runs.reduce((s, r) => s + r.lengthM * r.conductors.length, 0);

          expect(bom.wire.reduce((s, l) => s + l.lengthM, 0)).toBeCloseTo(wireTotal, 6);
          if (sc.insulation === "TW") {
            // 60 °C wire at 40 °C (×0.82) can't stay 2.0 mm² on a 15 A breaker.
            expect(result.circuits.filter((c) => c.breakerAmps === 15).every((c) => c.conductor.mm2 >= 3.5)).toBe(true);
          }
        });
      }
    });
  }
});

describe("ambient temperature is a project setting (API)", () => {
  const plan = loadRealPlans()[0];
  const { panel, loads } = fitOut(plan.floorPlan, { system: "1P2W-230", voltage: 230 });

  it("stores floorPlan.ambientTempC, rejects out-of-table values, and simulates with it", async () => {
    const app = createApp({ repository: new InMemoryProjectRepository() });
    const project = (await request(app).post("/api/projects").send({ name: "Hot ceiling" })).body;

    await request(app)
      .put(`/api/projects/${project.id}/floorplan`)
      .send({ ...plan.floorPlan, ambientTempC: 90 })
      .expect(400);
    const saved = await request(app)
      .put(`/api/projects/${project.id}/floorplan`)
      .send({ ...plan.floorPlan, ambientTempC: 40 })
      .expect(200);

    expect(saved.body.floorPlan.ambientTempC).toBe(40);
    await request(app).put(`/api/projects/${project.id}/panel`).send(panel).expect(200);
    await request(app).put(`/api/projects/${project.id}/loads`).send(loads).expect(200);
    const result = (await request(app).post(`/api/projects/${project.id}/simulate`).send({}).expect(200)).body;

    for (const ckt of result.circuits) {
      expect(ckt.derating.ambientTempC).toBe(40);
      expect(ckt.derating.ambientFactor).toBe(0.91); // THHN (90 °C column) at 36–40 °C
    }
    expect(result.wiring.segments.every((s: { raceway?: unknown }) => s.raceway)).toBe(true);
  });

  it("defaults to a 35 °C ceiling when the plan has no setting", async () => {
    const app = createApp({ repository: new InMemoryProjectRepository() });
    const project = (await request(app).post("/api/projects").send({ name: "Default" })).body;

    await request(app).put(`/api/projects/${project.id}/floorplan`).send(plan.floorPlan).expect(200);
    await request(app).put(`/api/projects/${project.id}/panel`).send(panel).expect(200);
    await request(app).put(`/api/projects/${project.id}/loads`).send(loads).expect(200);
    const result = (await request(app).post(`/api/projects/${project.id}/simulate`).send({}).expect(200)).body;

    expect(result.circuits.every((c: Circuit) => c.derating?.ambientTempC === 35)).toBe(true);
  });
});
