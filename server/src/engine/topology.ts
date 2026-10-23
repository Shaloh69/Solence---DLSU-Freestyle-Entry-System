/**
 * Circuit topology (W3): turns per-device home runs into real circuits.
 *
 *   per circuit: one home run from the panel to the device that is
 *   cheapest to reach, then device to device along a minimum spanning
 *   tree over routed lengths (same concealed-conduit cost model).
 *
 * Each segment carries its conductor set (L + N, or L + L2 for 240 V on
 * a 120/240 V panel, plus G) and the current of every device below it,
 * so voltage drop sums segment by segment to the far device instead of
 * assuming the whole circuit current at the farthest point (WIRING-AUDIT
 * F-9, F-10, F-11). A device where three or more conduits meet is a
 * junction box.
 *
 * W5 switching: each lighting group (switched fixtures of one room on one
 * circuit) gets a box — its fixture nearest the panel — and a switch leg
 * from that box to its switch (L down, S back, G), plus S + T + T + G
 * between a 2-way pair. Along the circuit tree the switched leg S runs
 * only where it joins a group's fixtures to each other, and L only where
 * an unswitched device or a group box is downstream (WIRING-AUDIT F-12).
 */
import {
  Circuit,
  CircuitWiring,
  ConductorRole,
  ElectricalLoad,
  JunctionBox,
  LightingGroup,
  Panel,
  Point,
  Room,
  RoutedPath,
  SegmentConductor,
  SwitchDevice,
  SwitchLeg,
  WireBomLine,
  WireRole,
  WireSegment,
} from "./types.js";
import { routeFromDevice, RouteTarget, WalkabilityGrid } from "./routing/index.js";
import { CONDUCTOR_COLORS } from "./sizing/conductor-colors.js";
import { SWITCH_DROP_ROLES, SWITCH_LEG_COLORS, TRAVELER_RUN_ROLES } from "./sizing/switch-leg-conductors.js";
import type { SwitchPlan } from "./switching/index.js";

const PANEL = "panel";

/** Conductors pulled through every segment of a circuit. */
export function conductorRoles(panel: Panel, voltage: number): ConductorRole[] {
  if (panel.system === "1P3W-120/240" && voltage >= 240) return ["L", "L2", "G"];
  if (panel.system === "3P4W-230/400" && voltage >= 400) return ["L", "L2", "L3", "G"];

  return ["L", "N", "G"];
}

export interface SwitchingInput {
  plan: SwitchPlan;
  rooms: Room[];
  /** Ceiling height, meters: switch legs drop from the ceiling to the switch. */
  ceilingHeight: number;
}

export function buildWiring(
  grid: WalkabilityGrid,
  panel: Panel,
  loads: ElectricalLoad[],
  circuits: Circuit[],
  routes: RoutedPath[],
  targets: RouteTarget[],
  switching: SwitchingInput = { plan: { groups: [], switches: [] }, rooms: [], ceilingHeight: 0 }
): CircuitWiring {
  const loadById = new Map(loads.map((l) => [l.id, l]));
  const routeByLoad = new Map(routes.map((r) => [r.loadId, r]));
  const targetById = new Map(targets.map((t) => [t.id, t]));
  const switchById = new Map(switching.plan.switches.map((s) => [s.id, s]));
  const roomById = new Map(switching.rooms.map((r) => [r.id, r]));
  const segments: WireSegment[] = [];
  const switchLegs: SwitchLeg[] = [];
  const junctions: JunctionBox[] = [];

  for (const circuit of circuits) {
    const devices = circuit.loadIds.filter((id) => routeByLoad.has(id));

    if (devices.length === 0) continue;
    const links = treeLinks(devices, routeByLoad, targetById, grid);
    const roles = conductorRoles(panel, circuit.voltage);
    const conductor = (role: WireRole, groupId?: string): SegmentConductor => {
      const size = role === "G" ? circuit.groundingConductor : circuit.conductor;
      const color = role === "S" || role === "T" ? SWITCH_LEG_COLORS[role] : CONDUCTOR_COLORS[role];

      return { role, awg: size.awg, mm2: size.mm2, color, ...(groupId ? { groupId } : {}) };
    };

    // Current below each node: its own load plus everything it feeds.
    const childrenOf = new Map<string, string[]>();

    for (const link of links) childrenOf.set(link.from, [...(childrenOf.get(link.from) ?? []), link.to]);
    const downstream = new Map<string, number>();
    const va = (node: string): number => {
      const own = loadById.get(node)?.va ?? 0;
      const total = own + (childrenOf.get(node) ?? []).reduce((sum, c) => sum + va(c), 0);

      downstream.set(node, total);

      return total;
    };

    va(PANEL);

    // Devices at or below each node, and wire distance from the panel.
    const below = new Map<string, Set<string>>();
    const subtree = (node: string): Set<string> => {
      const set = new Set([node]);

      for (const c of childrenOf.get(node) ?? []) for (const id of subtree(c)) set.add(id);
      below.set(node, set);

      return set;
    };

    subtree(PANEL);
    const fromPanel = new Map<string, number>([[PANEL, 0]]);

    for (const link of links) fromPanel.set(link.to, fromPanel.get(link.from)! + link.path.lengthM);

    // Lighting groups: box = the group's routed fixture nearest the panel.
    const groups = switching.plan.groups.filter((g) => g.circuitId === circuit.id);
    const routedOf = new Map(groups.map((g) => [g.id, g.loadIds.filter((id) => fromPanel.has(id))]));

    for (const g of groups) {
      const routed = routedOf.get(g.id)!;

      if (routed.length > 0) {
        g.boxLoadId = routed.reduce((best, id) =>
          fromPanel.get(id)! < fromPanel.get(best)! ||
          (fromPanel.get(id) === fromPanel.get(best) && id < best)
            ? id
            : best
        );
      }
    }
    const switched = new Set(groups.flatMap((g) => g.loadIds));
    const needsL = new Set([
      ...circuit.loadIds.filter((id) => !switched.has(id)),
      ...groups.map((g) => g.boxLoadId),
    ]);

    /** L where something downstream needs the unswitched hot; S where a group's fixtures join. */
    const segmentConductors = (to: string): SegmentConductor[] => {
      const sub = below.get(to)!;
      const hasL = [...sub].some((id) => needsL.has(id));
      const sGroups = groups.filter((g) => {
        const routed = routedOf.get(g.id)!;
        const inside = routed.filter((id) => sub.has(id)).length;

        return inside > 0 && inside < routed.length;
      });
      const out: SegmentConductor[] = [];

      for (const role of roles) {
        if (role === "L" && !hasL) continue;
        if (role === "G") out.push(...sGroups.map((g) => conductor("S", g.id)));
        out.push(conductor(role));
      }

      return out;
    };

    const circuitSegments = links.map((link, index): WireSegment => {
      const downstreamVa = downstream.get(link.to) ?? 0;

      return {
        id: `${circuit.id}-s${index + 1}`,
        circuitId: circuit.id,
        from: link.from,
        to: link.to,
        points: link.path.points,
        lengthM: link.path.lengthM,
        penetrations: link.path.penetrations ?? 0,
        conductors: segmentConductors(link.to),
        downstreamVa,
        downstreamAmps: downstreamVa / circuit.voltage,
      };
    });

    segments.push(...circuitSegments);

    // Switch legs: box → first switch, then between a 2-way pair.
    const legsOf = new Map<string, SwitchLeg[]>();

    for (const g of groups) {
      if (routedOf.get(g.id)!.length === 0) continue;
      const amps = g.loadIds.reduce((sum, id) => sum + (loadById.get(id)?.va ?? 0), 0) / circuit.voltage;
      const legs = switchLegsFor(g, {
        grid,
        box: targetById.get(g.boxLoadId)!,
        switches: g.switchIds.map((id) => switchById.get(id)!),
        room: g.roomId ? roomById.get(g.roomId) : undefined,
        ceilingHeight: switching.ceilingHeight,
        conductor,
        amps,
      });

      legsOf.set(g.id, legs);
      switchLegs.push(...legs);
    }

    // Chain to each device; the circuit's drop is the worst chain. A
    // switched fixture's current also runs down its switch leg and back.
    const parentSegment = new Map(circuitSegments.map((s) => [s.to, s]));
    const groupOf = new Map(groups.flatMap((g) => g.loadIds.map((id) => [id, g.id] as const)));
    let worst: { score: number; chain: { lengthM: number; amps: number }[] } = { score: -1, chain: [] };
    let farthest = 0;

    for (const device of devices) {
      const chain: { lengthM: number; amps: number }[] = [];
      let tree = 0;

      for (let s = parentSegment.get(device); s; s = parentSegment.get(s.from)) {
        chain.unshift({ lengthM: s.lengthM, amps: s.downstreamAmps });
        tree += s.lengthM;
      }
      for (const leg of legsOf.get(groupOf.get(device) ?? "") ?? []) {
        chain.push({ lengthM: leg.lengthM, amps: leg.amps });
      }
      const score = chain.reduce((sum, s) => sum + s.amps * s.lengthM, 0);

      farthest = Math.max(farthest, tree);
      if (score > worst.score) worst = { score, chain };
    }
    circuit.lengthM = farthest;
    circuit.dropChain = worst.chain;

    // Junction boxes: devices where three or more conduits meet (switch legs count).
    const degree = new Map<string, number>();

    for (const s of [...circuitSegments, ...[...legsOf.values()].flat()]) {
      for (const node of [s.from, s.to]) {
        if (loadById.has(node)) degree.set(node, (degree.get(node) ?? 0) + 1);
      }
    }
    for (const [loadId, conduits] of degree) {
      if (conduits >= 3) {
        junctions.push({
          id: `${circuit.id}-jb-${loadId}`,
          circuitId: circuit.id,
          loadId,
          position: loadById.get(loadId)!.position,
          conduits,
        });
      }
    }
  }

  const switches = switching.plan.switches;

  return {
    segments,
    junctions,
    bom: billOfMaterials([...segments, ...switchLegs], junctions.length, switches),
    lightingGroups: switching.plan.groups,
    switches,
    switchLegs,
  };
}

/** Routed switch legs of one group: box → nearer switch, then on to the other of a 2-way pair. */
function switchLegsFor(
  group: LightingGroup,
  ctx: {
    grid: WalkabilityGrid;
    box: RouteTarget;
    switches: SwitchDevice[];
    room?: Room;
    ceilingHeight: number;
    conductor: (role: WireRole, groupId?: string) => SegmentConductor;
    amps: number;
  }
): SwitchLeg[] {
  const target = (s: SwitchDevice): RouteTarget => ({ id: s.id, position: s.position, room: ctx.room?.boundary });
  const drop = Math.max(0, ctx.ceilingHeight - ctx.switches[0].mountingHeightM);
  const fromBox = routeFromDevice(ctx.box, ctx.switches.map(target), ctx.grid);
  const pathTo = (from: RouteTarget, to: SwitchDevice, found?: RoutedPath) => ({
    points: found?.points ?? [from.position, to.position],
    penetrations: found?.penetrations ?? 0,
  });
  const [first, second] = [...ctx.switches].sort(
    (a, b) =>
      polyline(pathTo(ctx.box, a, fromBox.get(a.id)).points) -
      polyline(pathTo(ctx.box, b, fromBox.get(b.id)).points)
  );
  const leg = (
    index: number,
    from: string,
    to: SwitchDevice,
    path: { points: Point[]; penetrations: number },
    verticalM: number,
    roles: readonly WireRole[]
  ): SwitchLeg => ({
    id: `${group.id}-leg${index}`,
    circuitId: group.circuitId,
    groupId: group.id,
    from,
    to: to.id,
    points: path.points,
    lengthM: polyline(path.points) + verticalM,
    verticalM,
    penetrations: path.penetrations,
    conductors: roles.map((role) => ctx.conductor(role, role === "S" || role === "T" ? group.id : undefined)),
    amps: ctx.amps,
  });
  const legs = [
    leg(1, group.boxLoadId, first, pathTo(ctx.box, first, fromBox.get(first.id)), drop, SWITCH_DROP_ROLES),
  ];

  if (second) {
    const between = routeFromDevice(target(first), [target(second)], ctx.grid).get(second.id);

    legs.push(leg(2, first.id, second, pathTo(target(first), second, between), 2 * drop, TRAVELER_RUN_ROLES));
  }

  return legs;
}

function polyline(points: Point[]): number {
  return points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
}

interface Link {
  from: string;
  to: string;
  path: RoutedPath;
}

/** Device-to-device links are only searched toward this many nearest neighbours. */
const NEIGHBOURS = 4;
/**
 * Prim–Dijkstra trade-off: a candidate link costs its length plus this
 * share of the wire already between the panel and its upstream device.
 * 0 = pure minimum spanning tree (least wire, long snakes, high voltage
 * drop); 1 = shortest-path tree (each device as close to the panel as
 * possible, more wire).
 */
const CHAIN_WEIGHT = 0.5;

/**
 * Home run to the device cheapest to reach from the panel, then a
 * Prim–Dijkstra tree over device-to-device routed lengths. A device no
 * link can reach keeps its own home run so it is never dropped.
 */
function treeLinks(
  devices: string[],
  routeByLoad: Map<string, RoutedPath>,
  targetById: Map<string, RouteTarget>,
  grid: WalkabilityGrid
): Link[] {
  const homeRun = (id: string) => routeByLoad.get(id)!;
  const root = devices.reduce((best, id) => (homeRun(id).lengthM < homeRun(best).lengthM ? id : best));
  const links: Link[] = [{ from: PANEL, to: root, path: homeRun(root) }];

  if (devices.length === 1) return links;

  // Routed links from each device to its nearest neighbours (both directions
  // kept, so a link found from either end is usable).
  const pairs = new Map<string, Map<string, RoutedPath>>(devices.map((id) => [id, new Map()]));
  const at = (id: string) => targetById.get(id)!;

  for (const id of devices) {
    const p = at(id).position;
    const nearest = devices
      .filter((d) => d !== id)
      .sort((a, b) => dist(at(a).position, p) - dist(at(b).position, p))
      .slice(0, NEIGHBOURS);

    for (const [to, path] of routeFromDevice(at(id), nearest.map(at), grid)) {
      pairs.get(id)!.set(to, path);
      if (!pairs.get(to)!.has(id)) pairs.get(to)!.set(id, { ...path, points: [...path.points].reverse(), loadId: id });
    }
  }

  const inTree = new Set([root]);
  const fromPanel = new Map([[root, homeRun(root).lengthM]]);

  while (inTree.size < devices.length) {
    let best: Link | null = null;
    let bestKey = Infinity;

    for (const from of inTree) {
      for (const [to, path] of pairs.get(from)!) {
        if (inTree.has(to)) continue;
        const key = path.lengthM + CHAIN_WEIGHT * fromPanel.get(from)!;

        if (key < bestKey) {
          bestKey = key;
          best = { from, to, path };
        }
      }
    }
    if (!best) break;
    links.push(best);
    inTree.add(best.to);
    fromPanel.set(best.to, fromPanel.get(best.from)! + best.path.lengthM);
  }
  for (const id of devices) {
    if (!inTree.has(id)) links.push({ from: PANEL, to: id, path: homeRun(id) });
  }

  return links;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function billOfMaterials(
  runs: { lengthM: number; conductors: SegmentConductor[] }[],
  junctionBoxes: number,
  switches: SwitchDevice[]
): CircuitWiring["bom"] {
  const lines = new Map<string, WireBomLine>();

  for (const s of runs) {
    for (const c of s.conductors) {
      const key = `${c.role}|${c.awg}|${c.color}`;
      const line = lines.get(key) ?? { role: c.role, awg: c.awg, mm2: c.mm2, color: c.color, lengthM: 0 };

      line.lengthM += s.lengthM;
      lines.set(key, line);
    }
  }

  return {
    wire: [...lines.values()],
    conduitLengthM: runs.reduce((sum, s) => sum + s.lengthM, 0),
    junctionBoxes,
    switches: {
      oneWay: switches.filter((s) => s.kind === "1-way").length,
      twoWay: switches.filter((s) => s.kind === "2-way").length,
    },
  };
}
