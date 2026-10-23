/**
 * W7 one-line (riser) diagram: generated from the service entrance, the
 * panel and its circuits as data (nodes + edges), then laid out as a
 * list of drawing primitives. The same primitives become the SVG string
 * in the result and are drawn into the permit PDF, so both always match.
 *
 * Layout (points, 1/72 in): a vertical spine utility → kWh meter → main
 * breaker → panel bus, the GEC off the main to the ground rod on the
 * left, one horizontal branch per circuit off the bus with its breaker,
 * poles, conductors and description. Text uses only characters the
 * PDF's WinAnsi font can print (`mm²` included, no ≥ √ ⚠).
 */
import type {
  Circuit,
  CircuitWiring,
  OneLineDiagram,
  OneLineEdge,
  OneLineNode,
  Panel,
  ServiceEntrance,
} from "../types.js";
import { conductorRoles } from "../topology.js";

export type OneLinePrimitive =
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; width: number }
  | { type: "rect"; x: number; y: number; w: number; h: number }
  | { type: "circle"; cx: number; cy: number; r: number }
  | { type: "text"; x: number; y: number; text: string; size: number; anchor: "start" | "middle" };

const WIDTH = 560;
const SPINE_X = 120;
const BUS_TOP = 176;
const ROW_H = 14;
const TEXT = 6.5;

function voltageText(service: ServiceEntrance): string {
  switch (service.system) {
    case "1P3W-120/240":
      return "120/240 V";
    case "3P4W-230/400":
      return "230/400 V";
    default:
      return `${service.voltage} V`;
  }
}

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Branch conductor text, e.g. `2-3.5 mm² THHN + 1-3.5 mm² G in 1/2" PVC`. */
function branchConductor(circuit: Circuit, panel: Panel, wiring?: CircuitWiring): string {
  const live = conductorRoles(panel, circuit.voltage).filter((role) => role !== "G").length;
  const homeRun = wiring?.segments.find((s) => s.circuitId === circuit.id && s.from === "panel");
  const raceway = homeRun?.raceway ? ` in ${homeRun.raceway.tradeSize} PVC` : "";

  return (
    `${live}-${circuit.conductor.mm2} mm² ${circuit.conductor.insulation}` +
    ` + 1-${circuit.groundingConductor.mm2} mm² G${raceway}`
  );
}

export interface OneLineInput {
  panel: Panel;
  service: ServiceEntrance;
  circuits: Circuit[];
  wiring?: CircuitWiring;
}

/** Nodes, edges, size and SVG of the one-line diagram. */
export function buildOneLine(input: OneLineInput): OneLineDiagram {
  const { panel, service, circuits, wiring } = input;
  const sc = service.serviceConductors;
  const gec = service.groundingElectrodeConductor;
  const rod = service.groundingElectrode;

  const nodes: OneLineNode[] = [
    {
      id: "utility",
      kind: "utility",
      label: `UTILITY SERVICE ${service.phases}-PHASE ${service.wires}-WIRE ${voltageText(service)}`,
    },
    {
      id: "meter",
      kind: "meter",
      label:
        service.meter.kind === "CT-metered kWh meter"
          ? `kWh METER, CT-METERED, ${service.meter.phases}-PHASE ${service.meter.wires}-WIRE`
          : `kWh METER, CLASS ${service.meter.ratedAmps} A, ${service.meter.phases}-PHASE ${service.meter.wires}-WIRE`,
    },
    {
      id: "main",
      kind: "main",
      label: `MAIN BREAKER ${service.mainBreaker.amps} AT ${service.mainBreaker.poles}P`,
      breakerAmps: service.mainBreaker.amps,
      poles: service.mainBreaker.poles,
    },
    {
      id: "panel",
      kind: "panel",
      label:
        `${panel.name} PANELBOARD, ${circuits.length} CIRCUITS, DEMAND ` +
        `${fmt(service.demandVa)} VA (${fmt(service.demandAmps, 1)} A)`,
    },
    {
      id: "ground",
      kind: "ground",
      label: `GROUND ROD ${rod.diameterMm} mm x ${rod.lengthM} m`,
    },
  ];
  const edges: OneLineEdge[] = [
    { id: "e-utility-meter", from: "utility", to: "meter", kind: "service-drop", label: "Service drop (by the utility)" },
    {
      id: "e-meter-main",
      from: "meter",
      to: "main",
      kind: "service-entrance",
      label:
        `Service entrance: ${sc.conductors.length}-${sc.conductors[0].mm2} mm² (${sc.conductors[0].awg} AWG) ` +
        `${sc.insulation} in ${sc.raceway.tradeSize} PVC`,
    },
    { id: "e-main-panel", from: "main", to: "panel", kind: "main-bus", label: "" },
    {
      id: "e-main-ground",
      from: "main",
      to: "ground",
      kind: "gec",
      label: `GEC ${gec.mm2} mm² (${gec.awg} AWG) Cu`,
    },
  ];

  circuits.forEach((circuit, index) => {
    const poles = conductorRoles(panel, circuit.voltage).filter((r) => r.startsWith("L")).length;
    const conductor = branchConductor(circuit, panel, wiring);
    const id = `branch-${circuit.id}`;

    nodes.push({
      id,
      kind: "branch",
      label: `${index + 1}. ${circuit.breakerAmps} AT ${poles}P - ${conductor} - ${circuit.description}`,
      circuitId: circuit.id,
      circuitNumber: index + 1,
      breakerAmps: circuit.breakerAmps,
      poles,
      conductor,
    });
    edges.push({ id: `e-panel-${circuit.id}`, from: "panel", to: id, kind: "branch", label: "" });
  });

  const height = BUS_TOP + 12 + circuits.length * ROW_H + 10;
  const diagram: OneLineDiagram = { nodes, edges, width: WIDTH, height, svg: "" };

  diagram.svg = oneLineSvg(diagram);

  return diagram;
}

/** Drawing primitives for a diagram (shared by the SVG and the PDF). */
export function oneLinePrimitives(diagram: Pick<OneLineDiagram, "nodes" | "edges">): OneLinePrimitive[] {
  const node = (id: string) => diagram.nodes.find((n) => n.id === id);
  const edge = (id: string) => diagram.edges.find((e) => e.id === id);
  const x = SPINE_X;
  const out: OneLinePrimitive[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, width = 1) =>
    out.push({ type: "line", x1, y1, x2, y2, width });
  const text = (tx: number, ty: number, t: string | undefined, size = TEXT, anchor: "start" | "middle" = "start") => {
    if (t) out.push({ type: "text", x: tx, y: ty, text: t, size, anchor });
  };

  // Utility service drop, arrow into the meter.
  line(x, 6, x, 44);
  line(x - 4, 38, x, 44);
  line(x + 4, 38, x, 44);
  text(x + 12, 12, node("utility")?.label);
  text(x + 12, 30, edge("e-utility-meter")?.label);

  // kWh meter.
  out.push({ type: "circle", cx: x, cy: 58, r: 14 });
  text(x, 60.5, "kWh", 7, "middle");
  text(x + 22, 60.5, node("meter")?.label);

  // Service-entrance conductors.
  line(x, 72, x, 104);
  text(x + 12, 90, edge("e-meter-main")?.label);

  // Main breaker.
  out.push({ type: "rect", x: x - 7, y: 104, w: 14, h: 22 });
  line(x - 5, 123, x + 5, 107);
  text(x + 22, 117, node("main")?.label);

  // GEC to the ground rod (left).
  const gx = x - 50;

  line(x - 7, 115, gx, 115);
  line(gx, 115, gx, 140);
  line(gx - 10, 140, gx + 10, 140);
  line(gx - 6, 144, gx + 6, 144);
  line(gx - 2, 148, gx + 2, 148);
  text(x + 22, 129, edge("e-main-ground")?.label);
  text(4, 160, node("ground")?.label);

  // Main to the panel bus.
  line(x, 126, x, BUS_TOP);
  text(x + 12, 162, node("panel")?.label);

  const branches = diagram.nodes.filter((n) => n.kind === "branch");
  const busBottom = BUS_TOP + 12 + Math.max(0, branches.length - 1) * ROW_H + 6;

  line(x, BUS_TOP, x, busBottom, 3);
  branches.forEach((branch, i) => {
    const y = BUS_TOP + 12 + i * ROW_H;

    line(x, y, x + 20, y);
    out.push({ type: "rect", x: x + 20, y: y - 3, w: 10, h: 6 });
    line(x + 30, y, x + 46, y);
    text(x + 50, y + 2.3, branch.label);
  });

  return out;
}

function xml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** SVG string of the diagram (black on white, Helvetica-compatible text). */
export function oneLineSvg(diagram: Pick<OneLineDiagram, "nodes" | "edges" | "width" | "height">): string {
  const parts = oneLinePrimitives(diagram).map((p) => {
    switch (p.type) {
      case "line":
        return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke-width="${p.width}"/>`;
      case "rect":
        return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#ffffff"/>`;
      case "circle":
        return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="#ffffff"/>`;
      case "text":
        return `<text x="${p.x}" y="${p.y}" font-size="${p.size}" text-anchor="${p.anchor}" stroke="none" fill="#111111">${xml(p.text)}</text>`;
    }
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${diagram.width}" height="${diagram.height}" ` +
    `viewBox="0 0 ${diagram.width} ${diagram.height}" font-family="Helvetica, Arial, sans-serif">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>` +
    `<g stroke="#111111" fill="none">${parts.join("")}</g></svg>`
  );
}
