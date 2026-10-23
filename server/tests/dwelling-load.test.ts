/**
 * W8 (F-14): PEC 2.20 dwelling load computation for the feeder/main.
 *
 * Hand-computed example (all values PEC-VERIFY placeholders):
 *   floor area  kitchen 12 + living 30 + bedroom 16 + bath 4 + laundry 4
 *               = 66 m² (garage 18 m² excluded) × 24 VA/m²      = 1 584 VA
 *               (connected lighting + general receptacles 1 020 VA < basis)
 *   small-appliance: 1 kitchen circuit on plan → min. 2 × 1 500  = 3 000 VA
 *   laundry: 1 circuit × 1 500                                   = 1 500 VA
 *   subtotal                                                     = 6 084 VA
 *   lighting demand: 3 000 × 100 % + 3 084 × 35 %                = 4 079.4 VA
 *   fixed appliances (4): 1 200 + 3 500 + 300 + 750 = 5 750 × 75 % = 4 312.5 VA
 *   A/C: 1 800 + 1 000 = 2 800 × 100 %                           = 2 800 VA
 *   largest motor (W8b): 25 % × 1 800 (ac-1)                     =   450 VA
 *   total demand                                                 = 11 641.9 VA
 *   ÷ 230 V = 50.62 A → 60 A main
 */
import { describe, expect, it } from "vitest";
import {
  buildPanelSchedule,
  dwellingLoadCalc,
} from "../src/engine/load-calc/index.js";
import { simulate } from "../src/engine/simulate.js";
import { generatePermitPdf } from "../src/engine/pdf/permit-pdf.js";
import { polygonArea } from "../src/engine/geometry.js";
import type {
  Circuit,
  ElectricalLoad,
  LoadType,
  Panel,
  Room,
  RoomType,
} from "../src/engine/types.js";
import { fitOut, loadRealPlans } from "./helpers/real-plans.js";
import { pdfTextRuns } from "./helpers/pdf-text.js";

function rect(id: string, type: RoomType, x: number, w: number, h: number): Room {
  return {
    id,
    name: id,
    type,
    boundary: [
      { x, y: 0 },
      { x: x + w, y: 0 },
      { x: x + w, y: h },
      { x, y: h },
    ],
  };
}

const rooms: Room[] = [
  rect("kitchen", "kitchen", 0, 3, 4),
  rect("living", "living", 3, 5, 6),
  rect("bedroom", "bedroom", 8, 4, 4),
  rect("bath", "bathroom", 12, 2, 2),
  rect("laundry", "laundry", 14, 2, 2),
  rect("garage", "garage", 16, 3, 6),
];

function load(id: string, type: LoadType, va: number, roomId: string): ElectricalLoad {
  return { id, name: id, type, va, voltage: 230, continuous: false, position: { x: 0, y: 0 }, roomId };
}

function circuitOf(id: string, members: ElectricalLoad[]): Circuit {
  return {
    id,
    description: id,
    loadIds: members.map((m) => m.id),
    connectedVa: members.reduce((s, m) => s + m.va, 0),
    continuousVa: 0,
    voltage: 230,
    phase: "A",
    breakerAmps: 20,
    conductor: { awg: "12", mm2: 3.5, ampacity: 20, insulation: "THHN" },
    lengthM: 10,
  };
}

const lights = Array.from({ length: 10 }, (_, i) => load(`ltg-${i}`, "lighting", 12, "living"));
const gp = Array.from({ length: 4 }, (_, i) => load(`gp-${i}`, "outlet", 180, "living"));
const bathOutlet = load("gp-bath", "outlet", 180, "bath");
const kitchenOutlets = Array.from({ length: 3 }, (_, i) => load(`sa-${i}`, "outlet", 180, "kitchen"));
const laundryOutlet = load("lau-1", "outlet", 180, "laundry");
const fridge = load("fridge", "appliance", 1200, "kitchen");
const heater = load("wh", "appliance", 3500, "bath");
const hood = load("hood", "appliance", 300, "kitchen");
const pump = load("pump", "appliance", 750, "garage");
const ac1 = load("ac-1", "hvac", 1800, "bedroom");
const ac2 = load("ac-2", "hvac", 1000, "living");

const loads = [lights, gp, [bathOutlet], kitchenOutlets, [laundryOutlet], [fridge, heater, hood, pump, ac1, ac2]].flat();
const circuits: Circuit[] = [
  circuitOf("c-ltg", lights),
  circuitOf("c-gp", gp),
  circuitOf("c-bath", [bathOutlet]),
  circuitOf("c-sa1", kitchenOutlets),
  circuitOf("c-lau", [laundryOutlet]),
  ...[fridge, heater, hood, pump, ac1, ac2].map((l) => circuitOf(`c-${l.id}`, [l])),
];

describe("dwellingLoadCalc — hand-computed example", () => {
  const calc = dwellingLoadCalc({ rooms, circuits, loads, system: "1P2W-230" });

  it("general lighting at the 24 VA/m² unit load over 66 m² (garage excluded)", () => {
    expect(calc.floorAreaM2).toBeCloseTo(66, 6);
    expect(calc.unitLoadVaPerM2).toBe(24);
    expect(calc.generalLightingBasisVa).toBeCloseTo(1584, 6);
    expect(calc.connectedGeneralVa).toBeCloseTo(1020, 6);
    expect(calc.generalLightingVa).toBeCloseTo(1584, 6);
    expect(calc.generalLightingSource).toBe("unit-load");
  });

  it("small-appliance (min. 2) and laundry circuits at 1500 VA", () => {
    expect(calc.smallApplianceCircuits).toBe(2);
    expect(calc.smallApplianceVa).toBe(3000);
    expect(calc.laundryCircuits).toBe(1);
    expect(calc.laundryVa).toBe(1500);
    expect(calc.generalSubtotalVa).toBeCloseTo(6084, 6);
  });

  it("lighting demand tiers: 3000 VA at 100 %, remainder at 35 %", () => {
    expect(calc.generalDemandVa).toBeCloseTo(4079.4, 6);
  });

  it("fixed appliances: four or more at 75 %", () => {
    expect(calc.fixedApplianceCount).toBe(4);
    expect(calc.fixedApplianceConnectedVa).toBe(5750);
    expect(calc.fixedApplianceFactor).toBe(0.75);
    expect(calc.fixedApplianceDemandVa).toBeCloseTo(4312.5, 6);
  });

  it("A/C at 100 %", () => {
    expect(calc.airConditioningVa).toBe(2800);
    expect(calc.airConditioningFactor).toBe(1);
    expect(calc.airConditioningDemandVa).toBe(2800);
    expect(calc.otherVa).toBe(0);
  });

  it("total demand 11 641.9 VA (incl. W8b largest motor +450 VA) → 50.62 A at 230 V", () => {
    expect(calc.largestMotorAdderVa).toBe(450);
    expect(calc.demandVa).toBeCloseTo(11641.9, 6);
    expect(calc.systemVoltage).toBe(230);
    expect(calc.demandAmps).toBeCloseTo(11641.9 / 230, 6);
  });

  it("lists every step with its basis and PEC reference", () => {
    expect(calc.steps.map((s) => s.id)).toEqual([
      "general-lighting",
      "small-appliance",
      "laundry",
      "general-subtotal",
      "lighting-demand",
      "fixed-appliance",
      "air-conditioning",
      "space-heating",
      "heating-ac-noncoincident",
      "other",
      "largest-motor",
      "total-demand",
    ]);
    const byId = Object.fromEntries(calc.steps.map((s) => [s.id, s]));

    expect(byId["general-lighting"].basis).toBe("66.0 m² × 24 VA/m² (connected 1,020 VA)");
    expect(byId["small-appliance"].basis).toBe("2 × 1,500 VA (min. 2; 1 on plan)");
    expect(byId["laundry"].basis).toBe("1 × 1,500 VA");
    expect(byId["lighting-demand"].basis).toBe("3,000 VA × 100% + 3,084 VA × 35%");
    expect(byId["fixed-appliance"].basis).toBe("4 appliances, 5,750 VA × 75%");
    expect(byId["air-conditioning"].basis).toBe("2 units, 2,800 VA × 100%");
    expect(byId["largest-motor"].basis).toBe("25% × 1,800 VA (ac-1)");
    expect(byId["total-demand"].basis).toBe("11,642 VA ÷ 230 V = 50.6 A");
    expect(byId["total-demand"].va).toBeCloseTo(11641.9, 6);
    for (const step of calc.steps) expect(step.pecReference, step.id).toMatch(/PEC.*PEC-VERIFY/);
  });

  it("the panel schedule carries the calculation and sizes from it", () => {
    const panel: Panel = { id: "p", name: "LP-1", position: { x: 0, y: 0 }, system: "1P2W-230", mainBreakerAmps: 0 };
    const schedule = buildPanelSchedule(panel, circuits, loads, 60, calc);

    expect(schedule.dwellingCalc).toEqual(calc);
    expect(schedule.totalDemandVa).toBe(11642);
    expect(schedule.feederAmps).toBe(50.6);
    expect(schedule.totalConnectedVa).toBe(loads.reduce((s, l) => s + l.va, 0));
  });
});

describe("dwellingLoadCalc — rule edges", () => {
  it("three fixed appliances stay at 100 %", () => {
    const calc = dwellingLoadCalc({
      rooms,
      circuits: circuits.filter((c) => c.id !== "c-pump"),
      loads,
      system: "1P2W-230",
    });

    expect(calc.fixedApplianceCount).toBe(3);
    expect(calc.fixedApplianceFactor).toBe(1);
    expect(calc.fixedApplianceDemandVa).toBe(5000);
  });

  it("uses the connected general load when it exceeds the unit load", () => {
    const big = Array.from({ length: 12 }, (_, i) => load(`big-${i}`, "outlet", 180, "living"));
    const calc = dwellingLoadCalc({
      rooms,
      circuits: [...circuits, circuitOf("c-big", big)],
      loads: [...loads, ...big],
      system: "1P2W-230",
    });

    expect(calc.connectedGeneralVa).toBeCloseTo(1020 + 2160, 6);
    expect(calc.generalLightingVa).toBeCloseTo(3180, 6);
    expect(calc.generalLightingSource).toBe("connected");
  });

  it("counts a small-appliance circuit at its connected VA when above 1500 VA", () => {
    const sa2 = [load("sa2-a", "outlet", 1000, "kitchen"), load("sa2-b", "outlet", 1000, "kitchen")];
    const calc = dwellingLoadCalc({
      rooms,
      circuits: [...circuits, circuitOf("c-sa2", sa2)],
      loads: [...loads, ...sa2],
      system: "1P2W-230",
    });

    expect(calc.smallApplianceCircuits).toBe(2);
    expect(calc.smallApplianceVa).toBe(1500 + 2000);
  });

  it("puts motors and other equipment at 100 % and uses 400 V √3 on three-phase", () => {
    const motor = load("m-1", "motor", 2000, "garage");
    const calc = dwellingLoadCalc({
      rooms,
      circuits: [...circuits, circuitOf("c-m", [motor])],
      loads: [...loads, motor],
      system: "3P4W-230/400",
    });

    expect(calc.otherVa).toBe(2000);
    // W8b: the 2000 VA motor is now the largest motor → +500 VA.
    expect(calc.largestMotorLoadId).toBe("m-1");
    expect(calc.demandVa).toBeCloseTo(11191.9 + 2000 + 500, 6);
    expect(calc.systemVoltage).toBe(400);
    expect(calc.demandAmps).toBeCloseTo(13691.9 / (Math.sqrt(3) * 400), 6);
  });
});

describe("W8 on the 12 real houses", () => {
  const plans = loadRealPlans();

  it("runs on all 12 plans", () => expect(plans).toHaveLength(12));

  describe.each(plans.map((p) => [p.id, p] as const))("%s", (_id, plan) => {
    const { panel, loads: planLoads } = fitOut(plan.floorPlan, { system: "1P3W-120/240", voltage: 230 });
    const result = simulate({ floorPlan: plan.floorPlan, panel, loads: planLoads });
    const calc = result.schedule.dwellingCalc;
    const area = plan.floorPlan.rooms
      .filter((r) => r.type !== "garage" && r.type !== "outdoor")
      .reduce((s, r) => s + polygonArea(r.boundary), 0);

    it("feeder demand uses the general-lighting unit load (not warned)", () => {
      expect(calc).toBeDefined();
      expect(calc!.floorAreaM2).toBeCloseTo(area, 6);
      expect(calc!.generalLightingVa).toBeGreaterThanOrEqual(area * 24 - 1e-9);
      expect(calc!.generalLightingVa).toBeGreaterThanOrEqual(calc!.connectedGeneralVa);
      expect(result.violations.map((v) => v.ruleId)).not.toContain("general-lighting-basis");
    });

    it("A/C at 100 % and the steps add up to the schedule's demand", () => {
      const hvac = planLoads.filter((l) => l.type === "hvac").reduce((s, l) => s + l.va, 0);

      expect(calc!.airConditioningDemandVa).toBe(hvac);
      expect(calc!.smallApplianceCircuits).toBeGreaterThanOrEqual(2);
      expect(calc!.demandVa).toBeCloseTo(
        calc!.generalDemandVa +
          calc!.fixedApplianceDemandVa +
          calc!.airConditioningDemandVa +
          calc!.spaceHeatingDemandVa +
          calc!.otherVa +
          calc!.largestMotorAdderVa,
        6
      );
      expect(result.schedule.totalDemandVa).toBe(Math.round(calc!.demandVa));
      expect(result.schedule.feederAmps).toBeCloseTo(calc!.demandAmps, 1);
    });

    it("main breaker ≥ computed demand", () => {
      expect(result.schedule.mainBreakerAmps).toBeGreaterThanOrEqual(calc!.demandAmps);
    });

    it("the permit PDF prints the schedule of loads step by step", async () => {
      const pdf = await generatePermitPdf({ projectName: plan.id, floorPlan: plan.floorPlan, panel, result });
      const text = pdfTextRuns(pdf);

      expect(text).toContain("Schedule of Loads: PEC 2.20 dwelling calculation (PEC-VERIFY)");
      for (const step of calc!.steps) {
        expect(text, step.id).toContain(step.label);
        expect(text, step.id).toContain(step.basis);
      }
      expect(text).toContain(`${calc!.floorAreaM2.toFixed(1)} m² × 24 VA/m² (connected ${Math.round(calc!.connectedGeneralVa).toLocaleString("en-US")} VA)`);
    });
  });
});
