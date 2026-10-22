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
 */
import {
  Circuit,
  CircuitWiring,
  ConductorRole,
  ElectricalLoad,
  JunctionBox,
  Panel,
  RoutedPath,
  WireBomLine,
  WireSegment,
} from "./types.js";
import { routeFromDevice, RouteTarget, WalkabilityGrid } from "./routing/index.js";
import { CONDUCTOR_COLORS } from "./sizing/conductor-colors.js";

const PANEL = "panel";

/** Conductors pulled through every segment of a circuit. */
export function conductorRoles(panel: Panel, voltage: number): ConductorRole[] {
  if (panel.system === "1P3W-120/240" && voltage >= 240) return ["L", "L2", "G"];
  if (panel.system === "3P4W-230/400" && voltage >= 400) return ["L", "L2", "L3", "G"];

  return ["L", "N", "G"];
}

export function buildWiring(
  grid: WalkabilityGrid,
  panel: Panel,
  loads: ElectricalLoad[],
  circuits: Circuit[],
  routes: RoutedPath[],
  targets: RouteTarget[]
): CircuitWiring {
  const loadById = new Map(loads.map((l) => [l.id, l]));
  const routeByLoad = new Map(routes.map((r) => [r.loadId, r]));
  const targetById = new Map(targets.map((t) => [t.id, t]));
  const segments: WireSegment[] = [];
  const junctions: JunctionBox[] = [];

  for (const circuit of circuits) {
    const devices = circuit.loadIds.filter((id) => routeByLoad.has(id));

    if (devices.length === 0) continue;
    const links = treeLinks(devices, routeByLoad, targetById, grid);
    const roles = conductorRoles(panel, circuit.voltage);
    const conductors = roles.map((role) => {
      const size = role === "G" ? circuit.groundingConductor : circuit.conductor;

      return { role, awg: size.awg, mm2: size.mm2, color: CONDUCTOR_COLORS[role] };
    });

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
        conductors: conductors.map((c) => ({ ...c })),
        downstreamVa,
        downstreamAmps: downstreamVa / circuit.voltage,
      };
    });

    segments.push(...circuitSegments);

    // Chain to each device; the circuit's drop is the worst chain.
    const parentSegment = new Map(circuitSegments.map((s) => [s.to, s]));
    let worst: { score: number; chain: WireSegment[] } = { score: -1, chain: [] };
    let farthest = 0;

    for (const device of devices) {
      const chain: WireSegment[] = [];

      for (let s = parentSegment.get(device); s; s = parentSegment.get(s.from)) chain.unshift(s);
      const score = chain.reduce((sum, s) => sum + s.downstreamAmps * s.lengthM, 0);

      farthest = Math.max(farthest, chain.reduce((sum, s) => sum + s.lengthM, 0));
      if (score > worst.score) worst = { score, chain };
    }
    circuit.lengthM = farthest;
    circuit.dropChain = worst.chain.map((s) => ({ lengthM: s.lengthM, amps: s.downstreamAmps }));

    // Junction boxes: devices where three or more conduits meet.
    const degree = new Map<string, number>();

    for (const s of circuitSegments) {
      for (const node of [s.from, s.to]) {
        if (node !== PANEL) degree.set(node, (degree.get(node) ?? 0) + 1);
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

  return { segments, junctions, bom: billOfMaterials(segments, junctions.length) };
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

function billOfMaterials(segments: WireSegment[], junctionBoxes: number): CircuitWiring["bom"] {
  const lines = new Map<string, WireBomLine>();

  for (const s of segments) {
    for (const c of s.conductors) {
      const key = `${c.role}|${c.awg}|${c.color}`;
      const line = lines.get(key) ?? { role: c.role, awg: c.awg, mm2: c.mm2, color: c.color, lengthM: 0 };

      line.lengthM += s.lengthM;
      lines.set(key, line);
    }
  }

  return {
    wire: [...lines.values()],
    conduitLengthM: segments.reduce((sum, s) => sum + s.lengthM, 0),
    junctionBoxes,
  };
}
