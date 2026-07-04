import { describe, it, expect } from "vitest";
import {
  branchCircuitLoad,
  applyDemandTiers,
  feederDemandVa,
  feederAmps,
  buildPanelSchedule,
} from "../src/engine/load-calc/index.js";
import {
  Circuit,
  ConductorSpec,
  ElectricalLoad,
  Panel,
} from "../src/engine/types.js";

const conductor: ConductorSpec = {
  awg: "12",
  mm2: 3.5,
  ampacity: 30,
  insulation: "THHN",
};

function makeLoad(overrides: Partial<ElectricalLoad> = {}): ElectricalLoad {
  return {
    id: "l1",
    name: "Test load",
    type: "lighting",
    va: 100,
    voltage: 230,
    continuous: false,
    position: { x: 1, y: 1 },
    ...overrides,
  };
}

function makeCircuit(overrides: Partial<Circuit> = {}): Circuit {
  return {
    id: "c1",
    description: "Test circuit",
    loadIds: ["l1"],
    connectedVa: 100,
    continuousVa: 0,
    voltage: 230,
    phase: "A",
    breakerAmps: 20,
    conductor,
    lengthM: 10,
    ...overrides,
  };
}

describe("branchCircuitLoad", () => {
  it("sums connected and continuous VA separately", () => {
    const loads = [
      makeLoad({ id: "a", va: 300, continuous: true }),
      makeLoad({ id: "b", va: 500, continuous: false }),
    ];

    expect(branchCircuitLoad(loads)).toEqual({
      connectedVa: 800,
      continuousVa: 300,
    });
  });

  it("rejects negative VA", () => {
    expect(() => branchCircuitLoad([makeLoad({ va: -5 })])).toThrow();
  });
});

describe("applyDemandTiers (PEC-VERIFY placeholder tiers)", () => {
  it("counts everything under the first tier at 100%", () => {
    expect(applyDemandTiers(2000)).toBe(2000);
  });

  it("applies 35% above 3000 VA", () => {
    // 3000 @100% + 1000 @35%
    expect(applyDemandTiers(4000)).toBeCloseTo(3350);
  });
});

describe("feederDemandVa", () => {
  it("applies lighting tiers to lighting circuits and 100% to others", () => {
    const loads = [
      makeLoad({ id: "light", type: "lighting", va: 4000 }),
      makeLoad({ id: "ac", type: "hvac", va: 2000 }),
    ];
    const circuits = [
      makeCircuit({ id: "c-light", loadIds: ["light"], connectedVa: 4000 }),
      makeCircuit({ id: "c-ac", loadIds: ["ac"], connectedVa: 2000 }),
    ];

    // lighting: 3000 + 1000*0.35 = 3350; hvac at 100% = 2000
    expect(feederDemandVa(circuits, loads)).toBeCloseTo(5350);
  });

  it("applies the fixed-appliance factor at four or more appliance circuits", () => {
    const loads = Array.from({ length: 4 }, (_, i) =>
      makeLoad({ id: `app${i}`, type: "appliance", va: 1000 })
    );
    const circuits = loads.map((load, i) =>
      makeCircuit({ id: `c${i}`, loadIds: [load.id], connectedVa: 1000 })
    );

    expect(feederDemandVa(circuits, loads)).toBeCloseTo(4000 * 0.75);
  });

  it("does not apply the appliance factor below four circuits", () => {
    const loads = Array.from({ length: 3 }, (_, i) =>
      makeLoad({ id: `app${i}`, type: "appliance", va: 1000 })
    );
    const circuits = loads.map((load, i) =>
      makeCircuit({ id: `c${i}`, loadIds: [load.id], connectedVa: 1000 })
    );

    expect(feederDemandVa(circuits, loads)).toBeCloseTo(3000);
  });
});

describe("feederAmps", () => {
  it("computes single-phase amps", () => {
    expect(feederAmps(4600, 230, false)).toBeCloseTo(20);
  });

  it("computes three-phase amps with the sqrt(3) factor", () => {
    expect(feederAmps(6928, 400, true)).toBeCloseTo(10, 1);
  });
});

describe("buildPanelSchedule", () => {
  it("produces rows, phase totals, and feeder sizing", () => {
    const panel: Panel = {
      id: "p1",
      name: "LP-1",
      position: { x: 0, y: 0 },
      system: "1P3W-120/240",
      mainBreakerAmps: 0,
    };
    const loads = [
      makeLoad({ id: "light", type: "lighting", va: 1200, voltage: 120 }),
      makeLoad({ id: "fridge", type: "appliance", va: 800, voltage: 120 }),
    ];
    const circuits = [
      makeCircuit({
        id: "c1",
        loadIds: ["light"],
        connectedVa: 1200,
        voltage: 120,
        phase: "A",
      }),
      makeCircuit({
        id: "c2",
        loadIds: ["fridge"],
        connectedVa: 800,
        voltage: 120,
        phase: "B",
      }),
    ];

    const schedule = buildPanelSchedule(panel, circuits, loads, 60);

    expect(schedule.rows).toHaveLength(2);
    expect(schedule.rows[0].circuitNumber).toBe(1);
    expect(schedule.totalConnectedVa).toBe(2000);
    expect(schedule.phaseVa.A).toBe(1200);
    expect(schedule.phaseVa.B).toBe(800);
    expect(schedule.totalDemandVa).toBe(2000); // under first tier, all at 100%
    expect(schedule.feederAmps).toBeCloseTo(2000 / 240, 1);
    expect(schedule.mainBreakerAmps).toBe(60);
  });
});
