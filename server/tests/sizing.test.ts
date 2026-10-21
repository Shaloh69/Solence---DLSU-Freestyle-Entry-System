import { describe, it, expect } from "vitest";
import {
  requiredAmps,
  sizeBreaker,
  sizeConductor,
  sizeBranchCircuit,
  balanceThreePhase,
} from "../src/engine/sizing/index.js";
import { PEC_TABLE_3_10_1 } from "../src/engine/sizing/pec-table-3-10-1.js";

describe("requiredAmps", () => {
  it("computes plain amps for non-continuous load", () => {
    expect(requiredAmps(2300, 0, 230)).toBeCloseTo(10);
  });

  it("applies 125% to the continuous portion only", () => {
    // 1000 VA non-continuous + 1000 VA continuous @ 230 V
    expect(requiredAmps(2000, 1000, 230)).toBeCloseTo((1000 + 1250) / 230);
  });

  it("rejects continuous greater than connected", () => {
    expect(() => requiredAmps(1000, 2000, 230)).toThrow();
  });

  it("rejects non-positive voltage", () => {
    expect(() => requiredAmps(1000, 0, 0)).toThrow();
  });
});

describe("sizeBreaker", () => {
  it("picks the exact standard size when it matches", () => {
    expect(sizeBreaker(20)).toBe(20);
  });

  it("rounds up to the next standard size", () => {
    expect(sizeBreaker(21)).toBe(25);
    expect(sizeBreaker(16.1)).toBe(20);
  });

  it("throws beyond the largest standard breaker", () => {
    expect(() => sizeBreaker(9999)).toThrow();
  });
});

describe("sizeConductor", () => {
  // W2: before PEC alignment this test asserted "20 A fits on 14 AWG"
  // (THHN 90 °C column). PEC 2017 2.40.1.4(D) caps 2.0 mm² at 15 A and
  // 1.10.1.14(C) limits ≤100 A circuits to the 60 °C column.
  it("selects the smallest conductor the breaker may protect", () => {
    const spec = sizeConductor(20, "THHN");

    expect(spec.awg).toBe("12");
    expect(spec.mm2).toBe(3.5);
    expect(spec.terminationTempC).toBe(60);
    expect(spec.ampacity).toBeGreaterThanOrEqual(20);
  });

  it("moves up sizes as amps increase, judged at the termination rating", () => {
    const spec = sizeConductor(60, "THW");

    expect(spec.ampacity).toBeGreaterThanOrEqual(60);
    const index = PEC_TABLE_3_10_1.findIndex((row) => row.awg === spec.awg);
    const smaller = PEC_TABLE_3_10_1[index - 1];

    // 60 A ≤ 100 A → 60 °C terminals → usable = min(THW, TW column).
    expect(Math.min(smaller.ampacity.THW, smaller.ampacity.TW)).toBeLessThan(60);
  });

  it("throws when no single conductor is large enough", () => {
    expect(() => sizeConductor(10000)).toThrow();
  });
});

describe("sizeBranchCircuit", () => {
  it("sizes conductor to protect against the breaker, not just the load", () => {
    // 4300 VA fully continuous @230 V -> 23.4 A required. As an individual
    // circuit that is a 25 A breaker, which needs 5.5 mm² (3.5 mm² is
    // capped at 20 A by 2.40.1.4(D)).
    const { breakerAmps, conductor } = sizeBranchCircuit(4300, 4300, 230, "THHN", {
      individual: true,
    });

    expect(breakerAmps).toBe(25);
    expect(conductor.mm2).toBe(5.5);
    expect(conductor.ampacity).toBeGreaterThanOrEqual(breakerAmps);
  });
});

describe("balanceThreePhase", () => {
  it("assigns every circuit exactly one phase", () => {
    const circuits = [
      { id: "c1", va: 1000 },
      { id: "c2", va: 2000 },
      { id: "c3", va: 1500 },
    ];
    const { assignments } = balanceThreePhase(circuits);

    expect(Object.keys(assignments)).toHaveLength(3);
    for (const phase of Object.values(assignments)) {
      expect(["A", "B", "C"]).toContain(phase);
    }
  });

  it("keeps phases reasonably balanced", () => {
    const circuits = Array.from({ length: 9 }, (_, i) => ({
      id: `c${i}`,
      va: 1000,
    }));
    const { phaseVa } = balanceThreePhase(circuits);

    expect(phaseVa.A).toBe(3000);
    expect(phaseVa.B).toBe(3000);
    expect(phaseVa.C).toBe(3000);
  });

  it("puts the heaviest loads on different phases", () => {
    const circuits = [
      { id: "big1", va: 5000 },
      { id: "big2", va: 5000 },
      { id: "big3", va: 5000 },
      { id: "small", va: 100 },
    ];
    const { assignments } = balanceThreePhase(circuits);
    const bigPhases = new Set([
      assignments.big1,
      assignments.big2,
      assignments.big3,
    ]);

    expect(bigPhases.size).toBe(3);
  });
});
