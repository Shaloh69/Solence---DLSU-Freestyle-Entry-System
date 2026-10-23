/**
 * W8b (F-14 follow-up): two more PEC 2.20 dwelling-calculation rules.
 *
 *   1. Largest motor +25 % (NEC 220.50 / 430.24 pattern, PEC 2017
 *      2.20.3.11 / 4.30.2.4 by the PEC numbering pattern; PEC-VERIFY):
 *      25 % of the largest single motor load counted in the demand
 *      (load types "hvac" — A/C motor-compressor — and "motor", e.g. a
 *      water pump).
 *   2. Heating / A-C non-coincidence (NEC 220.60 pattern, PEC 2017
 *      2.20.3.21; PEC-VERIFY): with both space heating ("heating" load
 *      type) and A/C, only the larger total is counted; a tie keeps A/C.
 *
 * Hand-computed base (all values PEC-VERIFY placeholders):
 *   floor area living 30 + bedroom 16 + kitchen 12 = 58 m² × 24 VA/m² = 1 392 VA
 *     (connected lighting 10 × 12 = 120 VA < basis)
 *   small-appliance: 0 circuits on plan → min. 2 × 1 500        = 3 000 VA
 *   laundry: no laundry room                                     =     0 VA
 *   subtotal                                                     = 4 392 VA
 *   lighting demand: 3 000 × 100 % + 1 392 × 35 %                = 3 487.2 VA
 *   no fixed appliances.
 *
 * Cases on top of the base:
 *   A  no motors, no heating, no A/C                → 3 487.2 VA, adder 0
 *   B  A/C 1 800 + 1 100, pump 750 (motor)          → 3 487.2 + 2 900 + 750
 *      largest motor 1 800 × 25 % = 450             → 7 587.2 VA
 *   C  heating 3 000 > A/C 1 800, pump 750          → A/C omitted (−1 800);
 *      largest counted motor = pump 750 → 187.5     → 3 487.2 + 3 000 + 750 + 187.5 = 7 424.7 VA
 *   D  A/C 1 800 + 1 100 = 2 900 > heating 1 000     → heating omitted (−1 000);
 *      largest motor 1 800 → 450                    → 3 487.2 + 2 900 + 450 = 6 837.2 VA
 *   E  heating 2 000 only                           → 3 487.2 + 2 000 = 5 487.2 VA
 *   F  A/C 1 800 only                               → 3 487.2 + 1 800 + 450 = 5 737.2 VA
 *   G  heating 1 800 = A/C 1 800 (tie keeps A/C)    → 3 487.2 + 1 800 + 450 = 5 737.2 VA
 */
import { describe, expect, it } from "vitest";
import { dwellingLoadCalc } from "../src/engine/load-calc/index.js";
import { simulate } from "../src/engine/simulate.js";
import { generatePermitPdf } from "../src/engine/pdf/permit-pdf.js";
import { loadSchema } from "../src/schemas.js";
import type {
  Circuit,
  DwellingLoadCalc,
  ElectricalLoad,
  LoadType,
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
  rect("living", "living", 0, 5, 6),
  rect("bedroom", "bedroom", 5, 4, 4),
  rect("kitchen", "kitchen", 9, 3, 4),
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
const BASE_DEMAND = 3487.2;

function calcWith(extra: ElectricalLoad[]): DwellingLoadCalc {
  const loads = [...lights, ...extra];
  const circuits = [circuitOf("c-ltg", lights), ...extra.map((l) => circuitOf(`c-${l.id}`, [l]))];

  return dwellingLoadCalc({ rooms, circuits, loads, system: "1P2W-230" });
}

function step(calc: DwellingLoadCalc, id: string) {
  const found = calc.steps.find((s) => s.id === id);

  expect(found, `step ${id}`).toBeDefined();
  return found!;
}

const acBig = () => load("ac-1", "hvac", 1800, "bedroom");
const acSmall = () => load("ac-2", "hvac", 1100, "living");
const pump = () => load("pump", "motor", 750, "kitchen");
const heater = (va: number) => load("heat-1", "heating", va, "bedroom");

describe("W8b — heating is a load type of the contract", () => {
  it("the API schema accepts type \"heating\"", () => {
    const parsed = loadSchema.safeParse({
      id: "h",
      name: "Space heater",
      type: "heating",
      va: 1500,
      voltage: 230,
      continuous: true,
      position: { x: 1, y: 1 },
    });

    expect(parsed.success).toBe(true);
  });
});

describe("W8b — largest motor +25 %", () => {
  it("A: no motors → no adder, demand unchanged", () => {
    const calc = calcWith([]);

    expect(calc.generalDemandVa).toBeCloseTo(BASE_DEMAND, 6);
    expect(calc.largestMotorVa).toBe(0);
    expect(calc.largestMotorLoadId).toBeNull();
    expect(calc.largestMotorAdderVa).toBe(0);
    expect(calc.demandVa).toBeCloseTo(BASE_DEMAND, 6);
    expect(step(calc, "largest-motor").basis).toBe("no motor loads");
    expect(step(calc, "largest-motor").va).toBe(0);
  });

  it("B: A/C 1800 + 1100 and a 750 VA pump → +25 % of 1800 = 450 VA", () => {
    const calc = calcWith([acBig(), acSmall(), pump()]);

    expect(calc.airConditioningVa).toBe(2900);
    expect(calc.airConditioningDemandVa).toBe(2900);
    expect(calc.otherVa).toBe(750);
    expect(calc.largestMotorVa).toBe(1800);
    expect(calc.largestMotorLoadId).toBe("ac-1");
    expect(calc.largestMotorFactor).toBe(0.25);
    expect(calc.largestMotorAdderVa).toBe(450);
    expect(calc.demandVa).toBeCloseTo(7587.2, 6);
    expect(step(calc, "largest-motor").label).toBe("Largest motor +25%");
    expect(step(calc, "largest-motor").basis).toBe("25% × 1,800 VA (ac-1)");
    expect(step(calc, "largest-motor").va).toBe(450);
    expect(step(calc, "largest-motor").pecReference).toMatch(/4\.30\.2\.4.*PEC-VERIFY/);
    expect(step(calc, "total-demand").basis).toBe("7,587 VA ÷ 230 V = 33.0 A");
  });

  it("a motor alone (pump) gets its own 25 %", () => {
    const calc = calcWith([pump()]);

    expect(calc.largestMotorLoadId).toBe("pump");
    expect(calc.largestMotorAdderVa).toBe(187.5);
    expect(calc.demandVa).toBeCloseTo(BASE_DEMAND + 750 + 187.5, 6);
  });

  it("fixed appliances and equipment are not motors", () => {
    const calc = calcWith([load("fridge", "appliance", 1200, "kitchen"), load("range", "equipment", 8000, "kitchen")]);

    expect(calc.largestMotorAdderVa).toBe(0);
    expect(calc.demandVa).toBeCloseTo(BASE_DEMAND + 1200 + 8000, 6);
  });
});

describe("W8b — heating / A-C non-coincidence", () => {
  it("C: heating 3000 > A/C 1800 → A/C omitted; largest counted motor is the pump", () => {
    const calc = calcWith([heater(3000), acBig(), pump()]);

    expect(calc.spaceHeatingVa).toBe(3000);
    expect(calc.spaceHeatingDemandVa).toBe(3000);
    expect(calc.airConditioningVa).toBe(1800);
    expect(calc.airConditioningDemandVa).toBe(0);
    expect(calc.nonCoincidentOmitted).toBe("air-conditioning");
    expect(calc.nonCoincidentOmittedVa).toBe(1800);
    expect(calc.largestMotorLoadId).toBe("pump");
    expect(calc.largestMotorAdderVa).toBe(187.5);
    expect(calc.demandVa).toBeCloseTo(7424.7, 6);

    const nc = step(calc, "heating-ac-noncoincident");

    expect(nc.label).toBe("Heating/A-C non-coincident (smaller omitted)");
    expect(nc.basis).toBe("heating 3,000 VA > A/C 1,800 VA: A/C omitted");
    expect(nc.va).toBe(-1800);
    expect(nc.pecReference).toMatch(/2\.20\.3\.21.*PEC-VERIFY/);
    expect(step(calc, "space-heating").basis).toBe("1 units, 3,000 VA × 100%");
    expect(step(calc, "space-heating").va).toBe(3000);
  });

  it("D: A/C 2900 > heating 1000 → heating omitted; A/C compressor stays the largest motor", () => {
    const calc = calcWith([heater(1000), acBig(), acSmall()]);

    expect(calc.spaceHeatingDemandVa).toBe(0);
    expect(calc.airConditioningDemandVa).toBe(2900);
    expect(calc.nonCoincidentOmitted).toBe("heating");
    expect(calc.nonCoincidentOmittedVa).toBe(1000);
    expect(calc.largestMotorAdderVa).toBe(450);
    expect(calc.demandVa).toBeCloseTo(6837.2, 6);
    expect(step(calc, "heating-ac-noncoincident").basis).toBe("A/C 2,900 VA > heating 1,000 VA: heating omitted");
    expect(step(calc, "heating-ac-noncoincident").va).toBe(-1000);
  });

  it("E: heating only → counted in full, nothing omitted, no motor adder", () => {
    const calc = calcWith([heater(2000)]);

    expect(calc.spaceHeatingDemandVa).toBe(2000);
    expect(calc.nonCoincidentOmitted).toBeNull();
    expect(calc.nonCoincidentOmittedVa).toBe(0);
    expect(calc.largestMotorAdderVa).toBe(0);
    expect(calc.demandVa).toBeCloseTo(5487.2, 6);
    expect(step(calc, "heating-ac-noncoincident").basis).toBe("heating only, nothing omitted");
    expect(step(calc, "heating-ac-noncoincident").va).toBe(0);
  });

  it("F: A/C only → counted in full plus its 25 % motor adder", () => {
    const calc = calcWith([acBig()]);

    expect(calc.spaceHeatingVa).toBe(0);
    expect(calc.nonCoincidentOmitted).toBeNull();
    expect(calc.airConditioningDemandVa).toBe(1800);
    expect(calc.demandVa).toBeCloseTo(5737.2, 6);
    expect(step(calc, "heating-ac-noncoincident").basis).toBe("A/C only, nothing omitted");
    expect(step(calc, "space-heating").basis).toBe("0 units, 0 VA × 100%");
  });

  it("G: a tie keeps the A/C (and its motor adder), omits heating", () => {
    const calc = calcWith([heater(1800), acBig()]);

    expect(calc.nonCoincidentOmitted).toBe("heating");
    expect(calc.demandVa).toBeCloseTo(5737.2, 6);
  });

  it("neither present → step says so", () => {
    expect(step(calcWith([]), "heating-ac-noncoincident").basis).toBe("no heating or A/C");
  });

  it("step order: A/C, heating, non-coincidence, other, largest motor, total", () => {
    const ids = calcWith([]).steps.map((s) => s.id);

    expect(ids.slice(-6)).toEqual([
      "air-conditioning",
      "space-heating",
      "heating-ac-noncoincident",
      "other",
      "largest-motor",
      "total-demand",
    ]);
  });
});

describe("W8b on the 12 real houses", () => {
  const plans = loadRealPlans();

  it("runs on all 12 plans", () => expect(plans).toHaveLength(12));

  describe.each(plans.map((p) => [p.id, p] as const))("%s", (_id, plan) => {
    const { panel, loads: planLoads } = fitOut(plan.floorPlan, { system: "1P3W-120/240", voltage: 230 });
    const result = simulate({ floorPlan: plan.floorPlan, panel, loads: planLoads });
    const calc = result.schedule.dwellingCalc!;
    const motors = planLoads.filter((l) => l.type === "hvac" || l.type === "motor");
    const largest = motors.reduce((m, l) => Math.max(m, l.va), 0);

    it("adds 25 % of the largest motor load to the demand", () => {
      expect(calc.largestMotorVa).toBe(largest);
      expect(calc.largestMotorAdderVa).toBeCloseTo(largest * 0.25, 6);
      expect(calc.demandVa).toBeCloseTo(
        calc.generalDemandVa +
          calc.fixedApplianceDemandVa +
          calc.airConditioningDemandVa +
          (calc.spaceHeatingDemandVa) +
          calc.otherVa +
          (calc.largestMotorAdderVa),
        6
      );
    });

    it("main breaker covers the new computed demand", () => {
      expect(result.schedule.totalDemandVa).toBe(Math.round(calc.demandVa));
      expect(result.schedule.mainBreakerAmps).toBeGreaterThanOrEqual(calc.demandAmps);
    });

    it("the permit PDF prints both new steps", async () => {
      const pdf = await generatePermitPdf({ projectName: plan.id, floorPlan: plan.floorPlan, panel, result });
      const text = pdfTextRuns(pdf);
      const lm = calc.steps.find((s) => s.id === "largest-motor")!;

      expect(text).toContain("Largest motor +25%");
      expect(text).toContain("Heating/A-C non-coincident (smaller omitted)");
      if (largest > 0) expect(text).toContain(lm.basis);
      expect(lm.basis).toMatch(largest > 0 ? /^25% × 1,800 VA \(/ : /^no motor loads$/);
      expect(text).toContain(motors.some((l) => l.type === "hvac") ? "A/C only, nothing omitted" : "no heating or A/C");
    });
  });

  it("a real house with a space heater larger than its A/C omits the A/C (simulate → PDF)", async () => {
    const plan = plans[plans.length - 1];
    const { panel, loads: planLoads } = fitOut(plan.floorPlan, { system: "1P3W-120/240", voltage: 230 });
    const acVa = planLoads.filter((l) => l.type === "hvac").reduce((s, l) => s + l.va, 0);

    expect(acVa).toBeGreaterThan(0);
    const room = plan.floorPlan.rooms.find((r) => r.type === "bedroom") ?? plan.floorPlan.rooms[0];
    const heaterVa = acVa + 1000;
    const heaterLoad = {
      ...load("space-heater", "heating", heaterVa, room.id),
      position: room.boundary[0],
      continuous: true,
    };
    const result = simulate({ floorPlan: plan.floorPlan, panel, loads: [...planLoads, heaterLoad] });
    const calc = result.schedule.dwellingCalc!;
    const fmt = (v: number) => v.toLocaleString("en-US");

    expect(calc.nonCoincidentOmitted).toBe("air-conditioning");
    expect(calc.airConditioningDemandVa).toBe(0);
    expect(calc.spaceHeatingDemandVa).toBe(heaterVa);
    expect(result.schedule.mainBreakerAmps).toBeGreaterThanOrEqual(calc.demandAmps);

    const text = pdfTextRuns(await generatePermitPdf({ projectName: plan.id, floorPlan: plan.floorPlan, panel, result }));

    expect(text).toContain(`heating ${fmt(heaterVa)} VA > A/C ${fmt(acVa)} VA: A/C omitted`);
    expect(text).toContain(`-${fmt(acVa)} VA`);
  });
});
