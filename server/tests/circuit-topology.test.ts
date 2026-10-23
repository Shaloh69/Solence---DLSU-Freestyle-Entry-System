/**
 * W3 — device-to-device circuit topology on real plans (ResPlan corpus).
 *
 * Before W3 every device had its own home run from the panel (star
 * topology, WIRING-AUDIT F-9), voltage drop assumed the whole circuit
 * current at the farthest point (F-10), and a run was one abstract wire
 * (F-11). These tests pin real circuits: one home run per circuit, then
 * device to device, each segment with its L/N/G set and the current it
 * carries.
 */
import { describe, expect, it } from "vitest";
import { simulate } from "../src/engine/simulate.js";
import { CONDUCTOR_RESISTANCE_OHM_PER_KM } from "../src/engine/sizing/pec-table-3-10-1.js";
import type { WireSegment } from "../src/engine/types.js";
import { fitOut, loadRealPlans } from "./helpers/real-plans.js";

const plans = loadRealPlans();

describe.each(plans.map((p) => [p.id, p] as const))("circuit topology on %s", (_id, plan) => {
  const { panel, loads } = fitOut(plan.floorPlan, { system: "1P2W-230", voltage: 230 });
  const result = simulate({ floorPlan: plan.floorPlan, panel, loads });
  const { segments, junctions, bom, switchLegs, lightingGroups } = result.wiring;
  const switchedCircuits = new Set(lightingGroups.map((g) => g.circuitId));
  const loadVa = new Map(loads.map((l) => [l.id, l.va]));
  const routeLength = new Map(result.routes.map((r) => [r.loadId, r.lengthM]));
  const circuitSegments = (circuitId: string) => segments.filter((s) => s.circuitId === circuitId);

  it("each circuit is one tree from the panel that feeds every routed load once", () => {
    for (const circuit of result.circuits) {
      const segs = circuitSegments(circuit.id);
      const routed = circuit.loadIds.filter((id) => routeLength.has(id));

      expect(segs).toHaveLength(routed.length);
      expect(segs.filter((s) => s.from === "panel")).toHaveLength(routed.length > 0 ? 1 : 0);
      expect(new Set(segs.map((s) => s.to)).size).toBe(segs.length);

      const reached = new Set(["panel"]);
      let grew = true;

      while (grew) {
        grew = false;
        for (const s of segs) {
          if (reached.has(s.from) && !reached.has(s.to)) {
            reached.add(s.to);
            grew = true;
          }
        }
      }
      for (const id of routed) expect(reached.has(id), `${circuit.id} reaches ${id}`).toBe(true);
    }
  });

  it("uses less wire than one home run per device", () => {
    const tree = segments.reduce((sum, s) => sum + s.lengthM, 0);
    const homeRuns = result.routes.reduce((sum, r) => sum + r.lengthM, 0);

    expect(tree).toBeLessThan(homeRuns);
  });

  // W5: switch legs are conduit runs too, so they count in the BOM.
  it("bill of materials equals the sum of the segments and switch legs", () => {
    const expected = new Map<string, number>();

    for (const s of [...segments, ...switchLegs]) {
      for (const c of s.conductors) {
        const key = `${c.role}|${c.awg}|${c.color}`;

        expected.set(key, (expected.get(key) ?? 0) + s.lengthM);
      }
    }
    expect(bom.wire).toHaveLength(expected.size);
    for (const line of bom.wire) {
      expect(line.lengthM).toBeCloseTo(expected.get(`${line.role}|${line.awg}|${line.color}`) ?? -1, 6);
    }
    expect(bom.conduitLengthM).toBeCloseTo(
      [...segments, ...switchLegs].reduce((sum, s) => sum + s.lengthM, 0),
      6
    );
    expect(bom.junctionBoxes).toBe(junctions.length);
  });

  it("current accumulates toward the panel", () => {
    for (const circuit of result.circuits) {
      const segs = circuitSegments(circuit.id);
      const children = (node: string) => segs.filter((s) => s.from === node);

      for (const s of segs) {
        const below = children(s.to).reduce((sum, c: WireSegment) => sum + c.downstreamVa, 0);

        expect(s.downstreamVa).toBeCloseTo((loadVa.get(s.to) ?? 0) + below, 6);
        expect(s.downstreamAmps).toBeCloseTo(s.downstreamVa / circuit.voltage, 6);
      }
      const home = segs.find((s) => s.from === "panel");
      const routedVa = circuit.loadIds
        .filter((id) => routeLength.has(id))
        .reduce((sum, id) => sum + (loadVa.get(id) ?? 0), 0);

      if (home) expect(home.downstreamVa).toBeCloseTo(routedVa, 6);
    }
  });

  // The chain to the far device is longer than that device's old direct
  // home run (it passes through other devices' boxes), so the star-topology
  // figure is not a bound. The F-10 guarantee is on the same wiring: summing
  // per segment never exceeds "all circuit current over the whole chain".
  it("chain voltage drop never exceeds all current at the far end of the same chain", () => {
    for (const circuit of result.circuits) {
      if (!circuit.dropChain?.length) continue;
      const chainLength = circuit.dropChain.reduce((sum, s) => sum + s.lengthM, 0);
      const ohmPerM = CONDUCTOR_RESISTANCE_OHM_PER_KM[circuit.conductor.awg] / 1000;
      const amps = circuit.connectedVa / circuit.voltage;
      const allAtEnd = (2 * amps * ohmPerM * chainLength) / circuit.voltage;

      expect(circuit.voltageDropPercent).toBeLessThanOrEqual(allAtEnd + 1e-9);
      expect(circuit.voltageDropPercent).toBeGreaterThan(0);
    }
  });

  it("keeps every branch under the 3% voltage-drop limit", () => {
    expect(result.violations.filter((v) => v.ruleId === "voltage-drop-branch")).toEqual([]);
  });

  // W5: on switched lighting circuits the hot past a group's box is the
  // switched leg S (exact rule in switching.test.ts); every other circuit
  // keeps exactly L + N + G.
  it("every segment carries the circuit's L/N/G set at the circuit's sizes", () => {
    for (const s of segments) {
      const circuit = result.circuits.find((c) => c.id === s.circuitId)!;
      const byRole = new Map(s.conductors.map((c) => [c.role, c]));

      if (switchedCircuits.has(circuit.id)) {
        expect(s.conductors.filter((c) => c.role === "N")).toHaveLength(1);
        expect(s.conductors.filter((c) => c.role === "G")).toHaveLength(1);
        expect(s.conductors.every((c) => ["L", "N", "G", "S"].includes(c.role))).toBe(true);
        expect(s.conductors.some((c) => c.role === "L" || c.role === "S"), s.id).toBe(true);
      } else {
        expect([...byRole.keys()].sort()).toEqual(["G", "L", "N"]);
        expect(s.conductors).toHaveLength(3);
      }
      for (const c of s.conductors) {
        expect(c.awg).toBe(c.role === "G" ? circuit.groundingConductor.awg : circuit.conductor.awg);
      }
    }
  });

  it("puts a junction box wherever three or more conduits meet at a device", () => {
    const degree = new Map<string, number>();
    const loadIds = new Set(loads.map((l) => l.id));

    // W5: a fixture box a switch leg drops from has one more conduit.
    for (const s of [...segments, ...switchLegs]) {
      for (const node of [s.from, s.to]) {
        if (loadIds.has(node)) degree.set(node, (degree.get(node) ?? 0) + 1);
      }
    }
    const branchPoints = [...degree].filter(([, d]) => d >= 3).map(([id]) => id).sort();

    expect(junctions.map((j) => j.loadId).sort()).toEqual(branchPoints);
  });
});

describe("240 V circuits on a 120/240 V panel", () => {
  it("run two hot legs and a ground, no neutral", () => {
    const plan = plans[0];
    const { panel, loads } = fitOut(plan.floorPlan, { system: "1P3W-120/240", voltage: 240 });
    const { wiring } = simulate({ floorPlan: plan.floorPlan, panel, loads });

    const switchedCircuits = new Set(wiring.lightingGroups.map((g) => g.circuitId));

    expect(wiring.segments.length).toBeGreaterThan(0);
    for (const s of wiring.segments) {
      const roles = s.conductors.map((c) => c.role).sort();

      if (switchedCircuits.has(s.circuitId)) {
        // The switched leg S replaces L past a lighting group's box (W5).
        expect(roles.filter((r) => r !== "L" && r !== "S")).toEqual(["G", "L2"]);
        expect(roles.some((r) => r === "L" || r === "S")).toBe(true);
      } else {
        expect(roles).toEqual(["G", "L", "L2"]);
      }
    }
    expect(wiring.switchLegs.length).toBeGreaterThan(0);
  });
});
