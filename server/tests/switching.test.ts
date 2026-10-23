/**
 * W5 — switches, lighting groups and switch legs (WIRING-AUDIT F-12).
 *
 * Before W5 there were no switches: every lighting fixture hung straight
 * off its circuit's L/N/G. These tests pin the switched model on all 12
 * ResPlan houses: every fixture belongs to exactly one lighting group,
 * controlled by one 1-way switch (or one 2-way pair in a room with two
 * entrances) inside its room at the latch side of its door; the switch
 * legs are routed conduit runs in the topology and their wire is in the
 * bill of materials.
 */
import { describe, expect, it } from "vitest";
import { simulate } from "../src/engine/simulate.js";
import { pointInPolygon, wallLength } from "../src/engine/geometry.js";
import { roomDoors } from "../src/engine/switching/index.js";
import {
  SWITCH_FROM_JAMB_M,
  SWITCH_MOUNTING_HEIGHT_M,
} from "../src/engine/switching/switch-data.js";
import { DEFAULT_CEILING_HEIGHT_M } from "../src/engine/lighting/lighting-data.js";
import type {
  ElectricalLoad,
  FloorPlan,
  Panel,
  Point,
  SegmentConductor,
  WireSegment,
} from "../src/engine/types.js";
import { fitOut, loadRealPlans } from "./helpers/real-plans.js";

const plans = loadRealPlans();

const isSwitchedFixture = (l: ElectricalLoad) => l.type === "lighting" && !l.egress;
const roles = (cs: SegmentConductor[]) => cs.map((c) => c.role).sort();

/** Where a point sits relative to a door: distance along its wall and off the wall line. */
function relativeToDoor(plan: FloorPlan, doorId: string, p: Point) {
  const door = plan.openings!.find((o) => o.id === doorId)!;
  const wall = plan.walls.find((w) => w.id === door.wallId)!;
  const len = wallLength(wall);
  const ux = (wall.end.x - wall.start.x) / len;
  const uy = (wall.end.y - wall.start.y) / len;
  const along = (p.x - wall.start.x) * ux + (p.y - wall.start.y) * uy;
  const off = Math.abs(-(p.x - wall.start.x) * uy + (p.y - wall.start.y) * ux);

  return { door, wall, along, off };
}

describe("switch placement on a hand-checked room", () => {
  // 4 m x 3 m room, walls on the room outline (0.15 m thick). Door 1 on the
  // bottom wall 0.1 m from the left corner (hinge at the corner, latch side
  // to the right); door 2 on the right wall.
  const walls = [
    { id: "w-top", start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, thickness: 0.15 },
    { id: "w-right", start: { x: 4, y: 0 }, end: { x: 4, y: 3 }, thickness: 0.15 },
    { id: "w-bottom", start: { x: 0, y: 3 }, end: { x: 4, y: 3 }, thickness: 0.15 },
    { id: "w-left", start: { x: 0, y: 0 }, end: { x: 0, y: 3 }, thickness: 0.15 },
    { id: "w-hall", start: { x: 0, y: 4.5 }, end: { x: 5.5, y: 4.5 }, thickness: 0.15 },
    { id: "w-hall-r", start: { x: 5.5, y: 0 }, end: { x: 5.5, y: 4.5 }, thickness: 0.15 },
  ];
  const room = {
    id: "r-bed",
    name: "Bedroom",
    type: "bedroom" as const,
    boundary: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }],
  };
  const hall = {
    id: "r-hall",
    name: "Hall",
    type: "hallway" as const,
    boundary: [
      { x: 4, y: 0 }, { x: 5.5, y: 0 }, { x: 5.5, y: 4.5 }, { x: 0, y: 4.5 }, { x: 0, y: 3 }, { x: 4, y: 3 },
    ],
  };
  const panel: Panel = { id: "lp", name: "LP", position: { x: 5.2, y: 4.2 }, system: "1P2W-230", mainBreakerAmps: 0 };
  const light = (id: string, x: number, y: number): ElectricalLoad => ({
    id, name: id, type: "lighting", va: 12, voltage: 230, continuous: true, position: { x, y }, roomId: "r-bed",
  });
  const loads = [light("l1", 1, 1.5), light("l2", 3, 1.5)];

  it("puts a 1-way switch at the latch side of a single door, at the DESIGN-VERIFY height", () => {
    const floorPlan: FloorPlan = {
      width: 6, height: 5, walls, rooms: [room, hall],
      openings: [{ id: "d1", wallId: "w-bottom", offset: 0.1, width: 0.8, kind: "door" }],
    };
    const { wiring } = simulate({ floorPlan, panel, loads });
    const group = wiring.lightingGroups.find((g) => g.roomId === "r-bed")!;

    expect(group.loadIds.sort()).toEqual(["l1", "l2"]);
    expect(group.switchIds).toHaveLength(1);
    const sw = wiring.switches.find((s) => s.id === group.switchIds[0])!;

    expect(sw.kind).toBe("1-way");
    expect(sw.doorId).toBe("d1");
    expect(sw.mountingHeightM).toBe(SWITCH_MOUNTING_HEIGHT_M);
    // Latch jamb at x = 0.9; switch SWITCH_FROM_JAMB_M past it, inside the room.
    expect(sw.position.x).toBeCloseTo(0.9 + SWITCH_FROM_JAMB_M, 6);
    expect(sw.position.y).toBeLessThan(3);
    expect(pointInPolygon(sw.position, room.boundary)).toBe(true);
  });

  it("gives a room with two entrance doors a 2-way pair, one switch at each door", () => {
    const floorPlan: FloorPlan = {
      width: 6, height: 5, walls, rooms: [room, hall],
      openings: [
        { id: "d1", wallId: "w-bottom", offset: 0.1, width: 0.8, kind: "door" },
        { id: "d2", wallId: "w-right", offset: 2.1, width: 0.8, kind: "door" },
      ],
    };
    const { wiring } = simulate({ floorPlan, panel, loads });
    const group = wiring.lightingGroups.find((g) => g.roomId === "r-bed")!;
    const pair = group.switchIds.map((id) => wiring.switches.find((s) => s.id === id)!);

    expect(pair).toHaveLength(2);
    expect(pair.map((s) => s.kind)).toEqual(["2-way", "2-way"]);
    expect(pair.map((s) => s.doorId).sort()).toEqual(["d1", "d2"]);
    expect(pair[0].pairedSwitchId).toBe(pair[1].id);
    expect(pair[1].pairedSwitchId).toBe(pair[0].id);
    // Door 2 (y 2.1..2.9 on the right wall): hinge toward the bottom-right
    // corner, latch at y = 2.1, switch above it.
    const s2 = pair.find((s) => s.doorId === "d2")!;

    expect(s2.position.y).toBeCloseTo(2.1 - SWITCH_FROM_JAMB_M, 6);
    expect(s2.position.x).toBeLessThan(4);

    const legs = wiring.switchLegs.filter((l) => l.groupId === group.id);

    expect(legs).toHaveLength(2);
    const fromBox = legs.find((l) => l.from === group.boxLoadId)!;
    const between = legs.find((l) => l.from !== group.boxLoadId)!;

    expect(roles(fromBox.conductors)).toEqual(["G", "L", "S"]);
    expect(roles(between.conductors)).toEqual(["G", "S", "T", "T"]);
    expect(new Set([between.from, between.to])).toEqual(new Set(group.switchIds));
  });

  it("leaves egress fixtures unswitched", () => {
    const floorPlan: FloorPlan = {
      width: 6, height: 5, walls, rooms: [room, hall],
      openings: [{ id: "d1", wallId: "w-bottom", offset: 0.1, width: 0.8, kind: "door" }],
    };
    const egress = { ...light("exit", 2, 2.5), egress: true };
    const { wiring } = simulate({ floorPlan, panel, loads: [...loads, egress] });

    expect(wiring.lightingGroups.some((g) => g.loadIds.includes("exit"))).toBe(false);
  });
});

describe.each(plans.map((p) => [p.id, p] as const))("switching on %s", (_id, plan) => {
  const fp = plan.floorPlan;
  const { panel, loads } = fitOut(fp, { system: "1P2W-230", voltage: 230 });
  const result = simulate({ floorPlan: fp, panel, loads });
  const { segments, lightingGroups, switches, switchLegs, bom } = result.wiring;
  const loadById = new Map(loads.map((l) => [l.id, l]));
  const roomById = new Map(fp.rooms.map((r) => [r.id, r]));
  const switchById = new Map(switches.map((s) => [s.id, s]));
  const circuitOf = new Map(result.circuits.flatMap((c) => c.loadIds.map((id) => [id, c] as const)));
  const doorsOf = roomDoors(fp);
  const ceiling = fp.ceilingHeight ?? DEFAULT_CEILING_HEIGHT_M;

  it("controls every lighting fixture by exactly one switch (or one 2-way pair)", () => {
    const fixtures = loads.filter(isSwitchedFixture);

    expect(fixtures.length).toBeGreaterThan(0);
    for (const f of fixtures) {
      const groups = lightingGroups.filter((g) => g.loadIds.includes(f.id));

      expect(groups, f.id).toHaveLength(1);
      const sws = groups[0].switchIds.map((id) => switchById.get(id)!);

      expect(sws.every(Boolean), f.id).toBe(true);
      if (sws.length === 1) {
        expect(sws[0].kind).toBe("1-way");
      } else {
        expect(sws).toHaveLength(2);
        expect(sws.map((s) => s.kind)).toEqual(["2-way", "2-way"]);
        expect(sws[0].pairedSwitchId).toBe(sws[1].id);
        expect(sws[1].pairedSwitchId).toBe(sws[0].id);
      }
    }
    // Groups hold only switched fixtures, one circuit and one room each.
    for (const g of lightingGroups) {
      for (const id of g.loadIds) {
        expect(isSwitchedFixture(loadById.get(id)!)).toBe(true);
        expect(circuitOf.get(id)!.id).toBe(g.circuitId);
        expect(loadById.get(id)!.roomId).toBe(g.roomId);
      }
      expect(g.loadIds).toContain(g.boxLoadId);
    }
  });

  it("puts every switch inside its fixtures' room, at a door of that room when it has one", () => {
    for (const g of lightingGroups) {
      const room = roomById.get(g.roomId!)!;
      const doors = doorsOf.get(room.id) ?? [];

      for (const id of g.switchIds) {
        const sw = switchById.get(id)!;

        expect(sw.roomId).toBe(room.id);
        expect(sw.circuitId).toBe(g.circuitId);
        expect(pointInPolygon(sw.position, room.boundary), `${sw.id} in ${room.id}`).toBe(true);
        expect(sw.mountingHeightM).toBe(SWITCH_MOUNTING_HEIGHT_M);
        if (doors.length === 0) continue;
        expect(doors.map((d) => d.doorId), sw.id).toContain(sw.doorId);
        // Beside the door, not in the opening: past a jamb along the wall,
        // within reach of it, on the wall face.
        const { door, wall, along, off } = relativeToDoor(fp, sw.doorId!, sw.position);
        const jambGap = Math.min(Math.abs(along - door.offset), Math.abs(along - (door.offset + door.width)));
        const inOpening = along > door.offset && along < door.offset + door.width;

        expect(inOpening, sw.id).toBe(false);
        expect(jambGap, sw.id).toBeLessThanOrEqual(SWITCH_FROM_JAMB_M + 0.25);
        expect(off, sw.id).toBeLessThanOrEqual((wall.thickness ?? 0.15) / 2 + 0.45);
      }
    }
  });

  it("uses 2-way switching exactly in rooms with two or more entrance doors", () => {
    for (const g of lightingGroups) {
      const entrances = (doorsOf.get(g.roomId!) ?? []).filter((d) => d.entrance);
      const sws = g.switchIds.map((id) => switchById.get(id)!);

      if (entrances.length >= 2) {
        expect(sws.map((s) => s.kind), g.id).toEqual(["2-way", "2-way"]);
        expect(new Set(sws.map((s) => s.doorId)).size, g.id).toBe(2);
        for (const s of sws) expect(entrances.map((d) => d.doorId)).toContain(s.doorId);
      } else {
        expect(sws.map((s) => s.kind), g.id).toEqual(["1-way"]);
        if (entrances.length === 1) expect(sws[0].doorId).toBe(entrances[0].doorId);
      }
    }
  });

  it("routes a switch leg from each group's box to its switch (and between a 2-way pair)", () => {
    for (const g of lightingGroups) {
      const circuit = result.circuits.find((c) => c.id === g.circuitId)!;
      const legs = switchLegs.filter((l) => l.groupId === g.id);

      expect(legs, g.id).toHaveLength(g.switchIds.length);
      const first = legs.find((l) => l.from === g.boxLoadId)!;

      expect(first, g.id).toBeDefined();
      expect(g.switchIds).toContain(first.to);
      expect(roles(first.conductors)).toEqual(["G", "L", "S"]);
      if (legs.length === 2) {
        const second = legs.find((l) => l !== first)!;

        expect(second.from).toBe(first.to);
        expect(g.switchIds).toContain(second.to);
        expect(second.to).not.toBe(first.to);
        expect(roles(second.conductors)).toEqual(["G", "S", "T", "T"]);
        expect(second.verticalM).toBeCloseTo(2 * (ceiling - SWITCH_MOUNTING_HEIGHT_M), 6);
      }
      expect(first.verticalM).toBeCloseTo(ceiling - SWITCH_MOUNTING_HEIGHT_M, 6);
      for (const leg of legs) {
        const plan = leg.points.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - leg.points[i].x, p.y - leg.points[i].y), 0);

        expect(leg.points.length).toBeGreaterThan(1);
        expect(leg.lengthM).toBeCloseTo(plan + leg.verticalM, 6);
        expect(leg.circuitId).toBe(g.circuitId);
        for (const c of leg.conductors) {
          expect(c.awg).toBe(c.role === "G" ? circuit.groundingConductor.awg : circuit.conductor.awg);
          if (c.role === "S" || c.role === "T") expect(c.groupId).toBe(g.id);
        }
        const groupVa = g.loadIds.reduce((s, id) => s + loadById.get(id)!.va, 0);

        expect(leg.amps).toBeCloseTo(groupVa / circuit.voltage, 9);
      }
    }
  });

  it("runs the switched leg only between a group's fixtures, and L only where something needs it", () => {
    for (const circuit of result.circuits) {
      const segs = segments.filter((s) => s.circuitId === circuit.id);
      const groups = lightingGroups.filter((g) => g.circuitId === circuit.id);
      const children = new Map<string, WireSegment[]>();

      for (const s of segs) children.set(s.from, [...(children.get(s.from) ?? []), s]);
      const below = (node: string): Set<string> => {
        const out = new Set([node]);

        for (const c of children.get(node) ?? []) for (const id of below(c.to)) out.add(id);

        return out;
      };
      const switched = new Set(groups.flatMap((g) => g.loadIds));
      const needsL = new Set([
        ...circuit.loadIds.filter((id) => !switched.has(id)),
        ...groups.map((g) => g.boxLoadId),
      ]);

      for (const s of segs) {
        const sub = below(s.to);
        const sFor = s.conductors.filter((c) => c.role === "S").map((c) => c.groupId).sort();
        const expected = groups
          .filter((g) => {
            const inside = g.loadIds.filter((id) => sub.has(id)).length;

            return inside > 0 && inside < g.loadIds.length;
          })
          .map((g) => g.id)
          .sort();

        expect(sFor, s.id).toEqual(expected);
        expect(s.conductors.some((c) => c.role === "L"), s.id).toBe([...sub].some((id) => needsL.has(id)));
        expect(s.conductors.filter((c) => c.role === "N")).toHaveLength(1);
        expect(s.conductors.filter((c) => c.role === "G")).toHaveLength(1);
        for (const c of s.conductors) {
          expect(c.awg).toBe(c.role === "G" ? circuit.groundingConductor.awg : circuit.conductor.awg);
        }
      }
    }
  });

  it("counts switch legs and switches in the bill of materials", () => {
    const expected = new Map<string, number>();

    for (const run of [...segments, ...switchLegs]) {
      for (const c of run.conductors) {
        const key = `${c.role}|${c.awg}|${c.color}`;

        expected.set(key, (expected.get(key) ?? 0) + run.lengthM);
      }
    }
    const legS = switchLegs.reduce((sum, l) => sum + l.conductors.filter((c) => c.role === "S").length * l.lengthM, 0);
    const bomS = bom.wire.filter((w) => w.role === "S").reduce((sum, w) => sum + w.lengthM, 0);

    expect(switchLegs.length).toBeGreaterThan(0);
    expect(legS).toBeGreaterThan(0);
    expect(bomS).toBeGreaterThanOrEqual(legS - 1e-9);
    expect(bom.wire).toHaveLength(expected.size);
    for (const line of bom.wire) {
      expect(line.lengthM).toBeCloseTo(expected.get(`${line.role}|${line.awg}|${line.color}`) ?? -1, 6);
    }
    expect(bom.conduitLengthM).toBeCloseTo(
      [...segments, ...switchLegs].reduce((sum, s) => sum + s.lengthM, 0),
      6
    );
    expect(bom.switches.oneWay).toBe(switches.filter((s) => s.kind === "1-way").length);
    expect(bom.switches.twoWay).toBe(switches.filter((s) => s.kind === "2-way").length);
  });

  it("drops a switched fixture's voltage through its switch leg", () => {
    for (const g of lightingGroups) {
      const circuit = result.circuits.find((c) => c.id === g.circuitId)!;
      const legLengths = switchLegs.filter((l) => l.groupId === g.id).map((l) => l.lengthM);

      // The worst chain of a circuit made only of switched fixtures runs
      // down to a switch and back.
      if (circuit.loadIds.every((id) => g.loadIds.includes(id))) {
        const chain = circuit.dropChain!.map((s) => s.lengthM);

        expect(legLengths.some((len) => chain.some((c) => Math.abs(c - len) < 1e-9)), g.id).toBe(true);
      }
    }
    expect(result.violations.filter((v) => v.ruleId === "voltage-drop-branch")).toEqual([]);
  });
});

describe("corpus coverage", () => {
  it("exercises both 1-way and 2-way switching on the 12 houses", () => {
    let oneWay = 0;
    let twoWay = 0;

    for (const plan of plans) {
      const { panel, loads } = fitOut(plan.floorPlan, { system: "1P2W-230", voltage: 230 });
      const { wiring } = simulate({ floorPlan: plan.floorPlan, panel, loads });

      oneWay += wiring.bom.switches.oneWay;
      twoWay += wiring.bom.switches.twoWay;
    }
    expect(oneWay).toBeGreaterThan(0);
    expect(twoWay).toBeGreaterThan(0);
  });
});

