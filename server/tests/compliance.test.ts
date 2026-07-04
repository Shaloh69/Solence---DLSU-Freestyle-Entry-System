import { describe, it, expect } from "vitest";
import {
  runComplianceChecks,
  checkAmpacity,
  checkContinuousLoad,
  checkVoltageDrop,
  voltageDropPercent,
  generatePanelDirectory,
} from "../src/engine/compliance/index.js";
import {
  Circuit,
  ConductorSpec,
  ElectricalLoad,
  Room,
} from "../src/engine/types.js";

const conductor12: ConductorSpec = {
  awg: "12",
  mm2: 3.5,
  ampacity: 30,
  insulation: "THHN",
};

function makeCircuit(overrides: Partial<Circuit> = {}): Circuit {
  return {
    id: "c1",
    description: "Test circuit",
    loadIds: ["l1"],
    connectedVa: 2300, // 10 A @ 230 V
    continuousVa: 0,
    voltage: 230,
    phase: "A",
    breakerAmps: 20,
    conductor: conductor12,
    lengthM: 10,
    ...overrides,
  };
}

describe("checkAmpacity", () => {
  it("passes when conductor ampacity covers the breaker", () => {
    expect(checkAmpacity(makeCircuit())).toHaveLength(0);
  });

  it("flags a breaker that outrates its conductor", () => {
    const violations = checkAmpacity(makeCircuit({ breakerAmps: 40 }));

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe("ampacity");
    expect(violations[0].severity).toBe("error");
  });
});

describe("checkContinuousLoad", () => {
  it("passes at exactly 80% of the breaker", () => {
    // 80% of 20 A @ 230 V = 3680 VA continuous
    const circuit = makeCircuit({ connectedVa: 3680, continuousVa: 3680 });

    expect(checkContinuousLoad(circuit)).toHaveLength(0);
  });

  it("flags continuous load above 80% of the breaker", () => {
    const circuit = makeCircuit({ connectedVa: 3700, continuousVa: 3700 });
    const violations = checkContinuousLoad(circuit);

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe("continuous-80");
  });
});

describe("voltage drop", () => {
  it("computes a sane single-phase drop", () => {
    // 12 AWG placeholder resistance 6.39 ohm/km, 10 A, 10 m run:
    // VD = 2 * 10 * 0.0639 = 1.278 V -> 0.556% of 230 V
    const drop = voltageDropPercent(makeCircuit());

    expect(drop).toBeCloseTo(0.00556, 4);
  });

  it("passes a short run", () => {
    expect(checkVoltageDrop(makeCircuit())).toHaveLength(0);
  });

  it("flags a long run beyond 3% branch drop", () => {
    const violations = checkVoltageDrop(makeCircuit({ lengthM: 60 }));

    expect(violations.map((violation) => violation.ruleId)).toContain(
      "voltage-drop-branch"
    );
  });

  it("flags total drop when feeder drop pushes past 5%", () => {
    const violations = checkVoltageDrop(makeCircuit({ lengthM: 30 }), {
      feederDropPercent: 0.04,
    });

    expect(violations.map((violation) => violation.ruleId)).toContain(
      "voltage-drop-total"
    );
    expect(violations.map((violation) => violation.ruleId)).not.toContain(
      "voltage-drop-branch"
    );
  });
});

describe("runComplianceChecks", () => {
  it("aggregates violations across circuits and rules", () => {
    const bad = makeCircuit({
      id: "bad",
      breakerAmps: 40, // ampacity violation (conductor 30 A)
      connectedVa: 8000,
      continuousVa: 8000, // 34.8 A continuous > 80% of 40 A
      lengthM: 80, // voltage drop violation
    });
    const good = makeCircuit({ id: "good" });

    const violations = runComplianceChecks([bad, good]);
    const byRule = new Set(violations.map((violation) => violation.ruleId));

    expect(byRule).toContain("ampacity");
    expect(byRule).toContain("continuous-80");
    expect(byRule).toContain("voltage-drop-branch");
    expect(
      violations.every((violation) => violation.circuitId === "bad")
    ).toBe(true);
  });
});

describe("generatePanelDirectory", () => {
  it("describes circuits by load type and room", () => {
    const rooms: Room[] = [
      {
        id: "r1",
        name: "Kitchen",
        type: "kitchen",
        boundary: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 3 },
          { x: 0, y: 3 },
        ],
      },
    ];
    const loads: ElectricalLoad[] = [
      {
        id: "l1",
        name: "Counter outlet",
        type: "outlet",
        va: 180,
        voltage: 230,
        continuous: false,
        position: { x: 1, y: 1 },
        roomId: "r1",
      },
      {
        id: "l2",
        name: "Counter outlet 2",
        type: "outlet",
        va: 180,
        voltage: 230,
        continuous: false,
        position: { x: 2, y: 1 },
        roomId: "r1",
      },
    ];
    const circuit = makeCircuit({
      loadIds: ["l1", "l2"],
      connectedVa: 360,
    });

    const directory = generatePanelDirectory([circuit], loads, rooms);

    expect(directory).toHaveLength(1);
    expect(directory[0].circuitNumber).toBe(1);
    expect(directory[0].description).toContain("Convenience outlets");
    expect(directory[0].description).toContain("Kitchen");
    expect(directory[0].description).toContain("2 loads");
  });
});
