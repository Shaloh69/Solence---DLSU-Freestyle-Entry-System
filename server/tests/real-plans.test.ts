/**
 * Engine on real residential plans (ResPlan corpus, CC BY 4.0).
 *
 * W1 scope: the corpus is valid input for the API contract, every plan
 * simulates end to end, sizing invariants hold on real load mixes, the
 * schedule adds up, and the permit PDF renders. Routing-model gaps the
 * corpus exposed are covered by routing-real-plans.test.ts (W1b).
 */
import { describe, expect, it } from "vitest";
import { floorPlanSchema } from "../src/schemas.js";
import { simulate } from "../src/engine/simulate.js";
import { requiredAmps } from "../src/engine/sizing/index.js";
import { generatePermitPdf } from "../src/engine/pdf/permit-pdf.js";
import { fitOut, loadRealPlans } from "./helpers/real-plans.js";

const plans = loadRealPlans();

describe("real-plan corpus", () => {
  it("has 12 plans covering 1, 2, 3 and 4+ bedrooms", () => {
    expect(plans).toHaveLength(12);
    const buckets = new Set(plans.map((p) => p.bedroomBucket));

    expect([...buckets].sort()).toEqual(["1", "2", "3", "4+"]);
  });

  it.each(plans.map((p) => [p.id, p] as const))(
    "%s satisfies the API floor-plan contract",
    (_id, plan) => {
      const parsed = floorPlanSchema.safeParse(plan.floorPlan);

      expect(parsed.success, JSON.stringify(parsed.error?.issues?.slice(0, 3))).toBe(true);
      expect(plan.floorPlan.walls.length).toBeGreaterThanOrEqual(8);
      expect(plan.floorPlan.openings?.some((o) => o.kind === "door")).toBe(true);
      for (const type of ["bedroom", "bathroom", "kitchen", "living"]) {
        expect(plan.floorPlan.rooms.some((r) => r.type === type), type).toBe(true);
      }
    }
  );
});

describe.each(plans.map((p) => [p.id, p] as const))("simulate on %s", (_id, plan) => {
  const { panel, loads } = fitOut(plan.floorPlan, {
    system: "1P3W-120/240",
    voltage: 230,
  });
  const result = simulate({ floorPlan: plan.floorPlan, panel, loads });

  it("completes and accounts for every load (routed or reported)", () => {
    const routed = new Set(result.routes.map((r) => r.loadId));
    const reported = new Set(result.routingErrors.map((e) => e.loadId));

    for (const load of loads) {
      expect(routed.has(load.id) || reported.has(load.id), load.id).toBe(true);
    }
  });

  it("puts every load on exactly one circuit", () => {
    const seen = new Map<string, number>();

    for (const c of result.circuits) for (const id of c.loadIds) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect([...seen.values()].every((n) => n === 1)).toBe(true);
    expect(seen.size).toBe(loads.length);
  });

  it("protects every circuit: breaker covers the load, conductor covers the breaker", () => {
    for (const c of result.circuits) {
      expect(c.breakerAmps, c.id).toBeGreaterThanOrEqual(
        requiredAmps(c.connectedVa, c.continuousVa, c.voltage) - 1e-9
      );
      expect(c.conductor.ampacity, c.id).toBeGreaterThanOrEqual(c.breakerAmps);
    }
  });

  it("gives every dedicated appliance its own circuit", () => {
    for (const load of loads.filter((l) => ["appliance", "hvac"].includes(l.type))) {
      const circuit = result.circuits.find((c) => c.loadIds.includes(load.id));

      expect(circuit?.loadIds, load.id).toEqual([load.id]);
    }
  });

  it("schedule totals equal the connected load", () => {
    const total = loads.reduce((s, l) => s + l.va, 0);

    expect(result.schedule.totalConnectedVa).toBeCloseTo(total, 6);
    expect(result.schedule.rows).toHaveLength(result.circuits.length);
    expect(result.schedule.mainBreakerAmps).toBeGreaterThan(0);
  });

  it("renders a permit PDF", async () => {
    const pdf = await generatePermitPdf({
      projectName: plan.id,
      floorPlan: plan.floorPlan,
      panel,
      result,
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
  });
});
