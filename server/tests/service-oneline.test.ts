/**
 * W7 (F-15): service entrance (kWh meter, main breaker, service
 * conductors, grounding electrode conductor) and the one-line (riser)
 * diagram generated from the panel + circuits.
 *
 * Hand-computed service conductors (all table values PEC-VERIFY):
 *  - 1P2W-230, 60 A main, THHN, 35 °C, 2 current-carrying (L, N):
 *    main ≤ 100 A → 60 °C terminals (TW column). 14 mm²: TW 55 < 60.
 *    22 mm²: min(THHN 95 × 0.96 = 91.2, TW 70) = 70 ≥ 60 → 22 mm² (4 AWG).
 *    GEC for a 22 mm² service (≤ 38 mm²) → 8.0 mm² (8 AWG).
 *  - 1P3W-120/240, 100 A main, THHN, 35 °C, 3 current-carrying (L, L2, N):
 *    38 mm²: TW 95 < 100. 50 mm²: min(145 × 0.96 = 139.2, TW 110) = 110
 *    → 50 mm² (1 AWG). GEC for 50 mm² (38–60 mm²) → 14 mm² (6 AWG).
 *  - 3P4W-230/400, 150 A main, THHN, 35 °C, 4 current-carrying (adj. 0.80):
 *    main > 100 A → 75 °C terminals (THW column). 70 mm²: min(195 × 0.96
 *    × 0.8 = 149.76, THW 175) < 150. 85 mm²: min(172.8, 200) ≥ 150
 *    → 85 mm² (3/0 AWG). GEC for 85 mm² (60–85 mm²) → 22 mm² (4 AWG).
 */
import { describe, expect, it } from "vitest";
import {
  buildServiceEntrance,
  sizeGroundingElectrodeConductor,
} from "../src/engine/service/index.js";
import { GEC_TABLE, GEC_REF } from "../src/engine/service/pec-service.js";
import { PEC_TABLE_3_10_1 } from "../src/engine/sizing/pec-table-3-10-1.js";
import { simulate } from "../src/engine/simulate.js";
import { generatePermitPdf } from "../src/engine/pdf/permit-pdf.js";
import { fitOut, loadRealPlans } from "./helpers/real-plans.js";
import { pdfTextRuns } from "./helpers/pdf-text.js";

function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Expected GEC straight from the PEC-VERIFY table rows (first row whose bound covers the size). */
function gecFromTable(serviceMm2: number) {
  return GEC_TABLE.find((row) => serviceMm2 <= row.maxServiceMm2);
}

describe("W7 grounding electrode conductor table (PEC 2.50 pattern, PEC-VERIFY)", () => {
  it("is flagged and cites the PEC table", () => {
    expect(GEC_REF).toMatch(/PEC-VERIFY/);
    expect(GEC_REF).toMatch(/2\.50\.3\.17/);
  });

  it("rows grow with the service conductor", () => {
    for (let i = 1; i < GEC_TABLE.length; i++) {
      expect(GEC_TABLE[i].maxServiceMm2).toBeGreaterThan(GEC_TABLE[i - 1].maxServiceMm2);
      expect(GEC_TABLE[i].mm2).toBeGreaterThan(GEC_TABLE[i - 1].mm2);
    }
  });

  it.each([
    [2.0, 8.0, "8"],
    [22, 8.0, "8"],
    [38, 8.0, "8"],
    [50, 14, "6"],
    [60, 14, "6"],
    [70, 22, "4"],
    [85, 22, "4"],
    [107, 38, "2"],
    [152, 38, "2"],
    [203, 60, "1/0"],
  ])("service %s mm² → GEC %s mm² (%s AWG)", (service, mm2, awg) => {
    const gec = sizeGroundingElectrodeConductor(service);

    expect(gec.mm2).toBe(mm2);
    expect(gec.awg).toBe(awg);
    expect(gec.pecReference).toBe(GEC_REF);
  });

  it("every service size in Table 3.10.1 maps to its table row", () => {
    for (const row of PEC_TABLE_3_10_1) {
      const expected = gecFromTable(row.mm2)!;

      expect(sizeGroundingElectrodeConductor(row.mm2).mm2, row.awg).toBe(expected.mm2);
    }
  });
});

describe("W7 service entrance (hand-computed)", () => {
  it("1P2W-230, 60 A: 22 mm² service conductors, 8.0 mm² GEC, Class 100 meter, 2P main", () => {
    const s = buildServiceEntrance({
      system: "1P2W-230",
      mainBreakerAmps: 60,
      mainBreakerSource: "computed",
      demandVa: 11191.9,
      demandAmps: 48.66,
      insulation: "THHN",
      ambientTempC: 35,
    });

    expect(s.voltage).toBe(230);
    expect(s.mainBreaker).toMatchObject({ amps: 60, poles: 2, source: "computed" });
    expect(s.serviceConductors.conductors.map((c) => c.role)).toEqual(["L", "N"]);
    expect(s.serviceConductors.conductors.every((c) => c.mm2 === 22 && c.awg === "4")).toBe(true);
    expect(s.serviceConductors.insulation).toBe("THHN");
    expect(s.serviceConductors.terminationTempC).toBe(60);
    expect(s.serviceConductors.ambientFactor).toBe(0.96);
    expect(s.serviceConductors.adjustmentFactor).toBe(1);
    expect(s.serviceConductors.ampacity).toBe(70);
    expect(s.serviceConductors.raceway.tradeSize).toBeTruthy();
    expect(s.serviceConductors.raceway.fillPercent).toBeLessThanOrEqual(s.serviceConductors.raceway.fillLimitPercent);
    expect(s.groundingElectrodeConductor).toMatchObject({ mm2: 8.0, awg: "8", serviceMm2: 22 });
    expect(s.meter.ratedAmps).toBe(100);
    expect(s.meter.phases).toBe(1);
    expect(s.meter.wires).toBe(2);
    expect(s.groundingElectrode.pecReference).toMatch(/PEC-VERIFY/);
  });

  it("1P3W-120/240, 100 A: 50 mm² (1 AWG), GEC 14 mm²", () => {
    const s = buildServiceEntrance({
      system: "1P3W-120/240",
      mainBreakerAmps: 100,
      mainBreakerSource: "computed",
      demandVa: 20000,
      demandAmps: 83.3,
      insulation: "THHN",
      ambientTempC: 35,
    });

    expect(s.serviceConductors.conductors.map((c) => c.role)).toEqual(["L", "L2", "N"]);
    expect(s.serviceConductors.conductors[0]).toMatchObject({ mm2: 50, awg: "1" });
    expect(s.serviceConductors.ampacity).toBe(110);
    expect(s.serviceConductors.currentCarrying).toBe(3);
    expect(s.groundingElectrodeConductor).toMatchObject({ mm2: 14, awg: "6" });
    expect(s.meter).toMatchObject({ ratedAmps: 100, phases: 1, wires: 3 });
    expect(s.mainBreaker.poles).toBe(2);
  });

  it("3P4W-230/400, 150 A: derated 85 mm² (3/0), GEC 22 mm², 3P main, Class 200 meter", () => {
    const s = buildServiceEntrance({
      system: "3P4W-230/400",
      mainBreakerAmps: 150,
      mainBreakerSource: "manual",
      demandVa: 80000,
      demandAmps: 115.5,
      insulation: "THHN",
      ambientTempC: 35,
    });

    expect(s.voltage).toBe(400);
    expect(s.serviceConductors.conductors).toHaveLength(4);
    expect(s.serviceConductors.conductors[0]).toMatchObject({ mm2: 85, awg: "3/0" });
    expect(s.serviceConductors.terminationTempC).toBe(75);
    expect(s.serviceConductors.adjustmentFactor).toBe(0.8);
    expect(s.serviceConductors.ampacity).toBeCloseTo(172.8, 6);
    expect(s.groundingElectrodeConductor).toMatchObject({ mm2: 22, awg: "4" });
    expect(s.mainBreaker).toMatchObject({ amps: 150, poles: 3, source: "manual" });
    expect(s.meter).toMatchObject({ ratedAmps: 200, phases: 3, wires: 4 });
  });
});

describe("W7 on the 12 real houses", () => {
  const plans = loadRealPlans();

  it("runs on all 12 plans", () => expect(plans).toHaveLength(12));

  describe.each(plans.map((p) => [p.id, p] as const))("%s", (_id, plan) => {
    const { panel, loads } = fitOut(plan.floorPlan, { system: "1P3W-120/240", voltage: 230 });
    const result = simulate({ floorPlan: plan.floorPlan, panel, loads });
    const { service, oneLine, schedule, circuits } = result;

    it("service entrance follows the computed demand and main breaker", () => {
      expect(service).toBeDefined();
      expect(service.mainBreaker.amps).toBe(schedule.mainBreakerAmps);
      expect(service.mainBreaker.source).toBe("computed");
      expect(service.demandAmps).toBeCloseTo(schedule.dwellingCalc!.demandAmps, 6);
      expect(service.serviceConductors.ampacity).toBeGreaterThanOrEqual(service.mainBreaker.amps);
      expect(service.mainBreaker.amps).toBeGreaterThanOrEqual(service.demandAmps);
      expect(service.meter.ratedAmps).toBeGreaterThanOrEqual(service.mainBreaker.amps);
    });

    it("GEC is sized from its PEC-VERIFY table by the service conductor", () => {
      const expected = gecFromTable(service.serviceConductors.conductors[0].mm2)!;

      expect(service.groundingElectrodeConductor.mm2).toBe(expected.mm2);
      expect(service.groundingElectrodeConductor.awg).toBe(expected.awg);
      expect(service.groundingElectrodeConductor.pecReference).toBe(GEC_REF);
    });

    it("one-line diagram lists every circuit with its breaker and conductor", () => {
      const branches = oneLine.nodes.filter((n) => n.kind === "branch");

      expect(branches).toHaveLength(circuits.length);
      for (const circuit of circuits) {
        const node = branches.find((n) => n.circuitId === circuit.id);

        expect(node, circuit.id).toBeDefined();
        expect(node!.breakerAmps).toBe(circuit.breakerAmps);
        expect(node!.conductor).toContain(`${circuit.conductor.mm2} mm²`);
        expect(node!.conductor).toContain(circuit.conductor.insulation);
        expect(node!.conductor).toContain(`${circuit.groundingConductor.mm2} mm² G`);
        expect(node!.label).toContain(`${circuit.breakerAmps} AT`);
        expect(node!.label).toContain(node!.conductor!);
        expect(oneLine.edges.some((e) => e.from === "panel" && e.to === node!.id), circuit.id).toBe(true);
        expect(oneLine.svg).toContain(xml(node!.label));
      }
    });

    it("one-line diagram chains utility → meter → main → panel, with the GEC to the electrode", () => {
      const kinds = oneLine.nodes.map((n) => n.kind);

      for (const kind of ["utility", "meter", "main", "panel", "ground"] as const) {
        expect(kinds).toContain(kind);
      }
      const edge = (from: string, to: string) => oneLine.edges.find((e) => e.from === from && e.to === to);

      expect(edge("utility", "meter")).toBeDefined();
      expect(edge("meter", "main")!.label).toContain(`${service.serviceConductors.conductors[0].mm2} mm²`);
      expect(edge("main", "panel")).toBeDefined();
      expect(edge("main", "ground")!.label).toContain(`${service.groundingElectrodeConductor.mm2} mm²`);
      expect(oneLine.svg.startsWith("<svg")).toBe(true);
      expect(oneLine.svg).toContain(`viewBox="0 0 ${oneLine.width} ${oneLine.height}"`);
      for (const node of oneLine.nodes) expect(oneLine.svg, node.id).toContain(xml(node.label));
    });

    it("the permit PDF prints the one-line diagram with every circuit", async () => {
      const pdf = await generatePermitPdf({ projectName: plan.id, floorPlan: plan.floorPlan, panel, result });
      const text = pdfTextRuns(pdf);

      expect(text).toContain("One-Line (Riser) Diagram");
      for (const node of oneLine.nodes) expect(text, node.id).toContain(node.label);
      for (const edge of oneLine.edges.filter((e) => e.label)) expect(text, edge.id).toContain(edge.label);
    });
  });
});
