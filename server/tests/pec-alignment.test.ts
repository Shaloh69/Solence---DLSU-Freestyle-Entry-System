/**
 * W2 — PEC 2017 alignment. Section numbers follow the PEC 2017 Part 1
 * transcription on the Filipino Engineer wiki (unofficial); every value
 * lives in a PEC-VERIFY data file pending a licensed EE's confirmation.
 */
import { describe, expect, it } from "vitest";
import {
  sizeBranchCircuit,
  sizeEquipmentGroundingConductor,
} from "../src/engine/sizing/index.js";
import {
  checkAmpacity,
  checkSmallConductor,
  checkRequiredBranchCircuits,
  checkReceptacleSpacing,
} from "../src/engine/compliance/index.js";
import { simulate } from "../src/engine/simulate.js";
import { panelSchema } from "../src/schemas.js";
import type { Circuit, ElectricalLoad, Room } from "../src/engine/types.js";
import { fitOut, loadRealPlans } from "./helpers/real-plans.js";

const plans = loadRealPlans();

function circuit(partial: Partial<Circuit>): Circuit {
  return {
    id: "ckt-x",
    description: "test",
    loadIds: [],
    connectedVa: 1000,
    continuousVa: 0,
    voltage: 230,
    phase: "A",
    breakerAmps: 20,
    conductor: { awg: "14", mm2: 2.0, ampacity: 15, insulation: "THHN", terminationTempC: 60 },
    groundingConductor: { awg: "14", mm2: 2.0 },
    lengthM: 10,
    voltageDropPercent: 0,
    ...partial,
  };
}

describe("conductor sizing — small-conductor rule (2.40.1.4(D)) + 60 °C terminations (1.10.1.14(C))", () => {
  it.each([
    [3000, 15, 2.0],
    [4000, 20, 3.5],
    [6500, 30, 5.5],
    [9000, 40, 8.0],
  ])("%i VA multi-outlet circuit @230 V → %i A breaker on %s mm²", (va, amps, mm2) => {
    const { breakerAmps, conductor } = sizeBranchCircuit(va, 0, 230, "THHN");

    expect(breakerAmps).toBe(amps);
    expect(conductor.mm2).toBe(mm2);
    expect(conductor.terminationTempC).toBe(60);
    expect(conductor.ampacity).toBeGreaterThanOrEqual(breakerAmps);
  });

  it("never protects 2.0 mm² above 15 A, 3.5 mm² above 20 A, 5.5 mm² above 30 A", () => {
    const limits: Record<number, number> = { 2.0: 15, 3.5: 20, 5.5: 30 };

    for (let va = 500; va <= 11000; va += 250) {
      for (const continuous of [0, va]) {
        const { breakerAmps, conductor } = sizeBranchCircuit(va, continuous, 230, "THHN");

        if (limits[conductor.mm2] !== undefined) {
          expect(breakerAmps, `${va} VA`).toBeLessThanOrEqual(limits[conductor.mm2]);
        }
      }
    }
  });

  it("uses only 15/20/30/40/50 A for multi-outlet circuits (2.10.2.1), any standard rating for individual ones", () => {
    const shared = sizeBranchCircuit(4300, 4300, 230, "THHN");
    const individual = sizeBranchCircuit(4300, 4300, 230, "THHN", { individual: true });

    expect([15, 20, 30, 40, 50]).toContain(shared.breakerAmps);
    expect(shared.breakerAmps).toBe(30);
    expect(individual.breakerAmps).toBe(25);
    expect(individual.conductor.mm2).toBe(5.5);
  });
});

describe("equipment grounding conductor (Table 2.50.6.13)", () => {
  it.each([
    [15, 2.0],
    [20, 3.5],
    [30, 5.5],
    [60, 5.5],
    [100, 8.0],
    [200, 14],
  ])("%i A → %s mm² copper", (amps, mm2) => {
    expect(sizeEquipmentGroundingConductor(amps).mm2).toBe(mm2);
  });
});

describe("compliance rules", () => {
  it("flags 2.0 mm² on a 20 A breaker as a small-conductor violation", () => {
    const v = checkSmallConductor(circuit({ breakerAmps: 20 }));

    expect(v).toHaveLength(1);
    expect(v[0].ruleId).toBe("small-conductor");
    expect(v[0].pecReference).toContain("2.40.1.4(D)");
  });

  it("judges ampacity at the 60 °C termination rating, not the 90 °C insulation rating", () => {
    // 14 AWG THHN is 25 A at 90 °C but 15 A at a 60 °C terminal.
    const v = checkAmpacity(circuit({ breakerAmps: 20 }));

    expect(v.map((x) => x.ruleId)).toContain("ampacity");
  });

  it("requires 20 A circuits for kitchen and bathroom receptacles (2.10.1.11(C))", () => {
    const rooms: Room[] = [
      { id: "k", name: "Kitchen", type: "kitchen", boundary: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 }] },
      { id: "b", name: "Bath", type: "bathroom", boundary: [{ x: 3, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 3 }, { x: 3, y: 3 }] },
    ];
    const loads: ElectricalLoad[] = [
      { id: "ko", name: "Counter", type: "outlet", va: 180, voltage: 230, continuous: false, position: { x: 1, y: 1 }, roomId: "k", gfci: true },
      { id: "bo", name: "Bath", type: "outlet", va: 180, voltage: 230, continuous: false, position: { x: 4, y: 1 }, roomId: "b", gfci: true },
    ];
    const fifteen = [
      circuit({ id: "c1", loadIds: ["ko"], breakerAmps: 15 }),
      circuit({ id: "c2", loadIds: ["bo"], breakerAmps: 15 }),
    ];
    const ids = checkRequiredBranchCircuits(rooms, loads, fifteen).map((v) => v.ruleId);

    expect(ids.filter((x) => x === "required-branch-circuit")).toHaveLength(2);
    const twenty = fifteen.map((c) => ({ ...c, breakerAmps: 20 }));

    expect(checkRequiredBranchCircuits(rooms, loads, twenty)).toEqual([]);
  });
});

describe("PH 230 V single-phase system", () => {
  it("is accepted by the API contract", () => {
    expect(
      panelSchema.safeParse({ id: "p", name: "LP-1", position: { x: 1, y: 1 }, system: "1P2W-230", mainBreakerAmps: 0 }).success
    ).toBe(true);
  });

  const plan = plans.find((p) => p.bedroomBucket === "3")!;
  const { panel, loads } = fitOut(plan.floorPlan, { system: "1P2W-230", voltage: 230 });
  const result = simulate({ floorPlan: plan.floorPlan, panel, loads });

  it("puts every circuit on the single leg and sizes the feeder at 230 V", () => {
    expect(result.circuits.every((c) => c.phase === "A")).toBe(true);
    expect(result.schedule.feederAmps).toBeCloseTo(result.schedule.totalDemandVa / 230, 1);
  });
});

describe.each(plans.map((p) => [p.id, p] as const))("PEC on real plan %s", (_id, plan) => {
  const { panel, loads } = fitOut(plan.floorPlan, { system: "1P2W-230", voltage: 230 });
  const result = simulate({ floorPlan: plan.floorPlan, panel, loads });
  const ruleIds = new Set(result.violations.map((v) => v.ruleId));

  it("produces no small-conductor, ampacity or required-circuit violations", () => {
    expect(ruleIds.has("small-conductor")).toBe(false);
    expect(ruleIds.has("ampacity")).toBe(false);
    expect(ruleIds.has("required-branch-circuit")).toBe(false);
  });

  it("gives every circuit a grounding conductor sized to its breaker", () => {
    for (const c of result.circuits) {
      expect(c.groundingConductor.mm2, c.id).toBe(sizeEquipmentGroundingConductor(c.breakerAmps).mm2);
    }
  });

  it("satisfies receptacle spacing (2.10.3.3(a)(1)) with the full fit-out", () => {
    expect(ruleIds.has("receptacle-spacing")).toBe(false);
  });

  it("flags receptacle spacing when a bedroom loses all but one outlet", () => {
    const bedroom = plan.floorPlan.rooms.find((r) => r.type === "bedroom")!;
    const outlets = loads.filter((l) => l.type === "outlet" && l.roomId === bedroom.id);
    const fewer = loads.filter((l) => !outlets.slice(1).includes(l));

    if (outlets.length < 2) {
      // Rooms this small are covered by one outlet; the rule must agree.
      expect(checkReceptacleSpacing(plan.floorPlan.rooms, fewer).some((v) => v.message.includes(bedroom.name))).toBe(false);
      return;
    }
    expect(
      checkReceptacleSpacing(plan.floorPlan.rooms, fewer).some(
        (v) => v.ruleId === "receptacle-spacing" && v.message.includes(bedroom.name)
      )
    ).toBe(true);
  });
});
