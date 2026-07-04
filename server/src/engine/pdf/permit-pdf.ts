/**
 * Permit-ready PDF export: wiring diagram, panel schedule, conductor
 * schedule, and panel directory, generated server-side with pdfkit.
 *
 * Every page carries the PEC-VERIFY disclaimer until a licensed EE
 * confirms the code tables the engine runs on.
 */
import PDFDocument from "pdfkit";
import { FloorPlan, Panel } from "../types.js";
import { SimulationResult } from "../simulate.js";

const PALETTE = [
  "#4E79A7",
  "#F28E2B",
  "#59A14F",
  "#B07AA1",
  "#76B7B2",
  "#EDC948",
  "#FF9DA7",
  "#9C755F",
  "#86BCB6",
  "#D37295",
];
const VIOLATION_COLOR = "#E15759";

export interface PermitPdfInput {
  projectName: string;
  floorPlan: FloorPlan;
  panel: Panel;
  result: SimulationResult;
}

export function generatePermitPdf(input: PermitPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawDiagramPage(doc, input);
    doc.addPage();
    drawSchedulePage(doc, input);
    doc.addPage();
    drawDirectoryPage(doc, input);

    doc.end();
  });
}

function circuitColor(
  circuitId: string | undefined,
  circuitIds: string[]
): string {
  if (!circuitId) return "#888888";
  const index = circuitIds.indexOf(circuitId);

  return PALETTE[(index >= 0 ? index : 0) % PALETTE.length];
}

function header(doc: PDFKit.PDFDocument, input: PermitPdfInput, subtitle: string) {
  doc
    .fontSize(16)
    .fillColor("#111111")
    .text(`Solence — ${input.projectName}`, { continued: false });
  doc
    .fontSize(10)
    .fillColor("#555555")
    .text(
      `${subtitle}  ·  ${input.panel.name} (${input.panel.system})  ·  Generated ${new Date().toLocaleDateString()}`
    );
  doc.moveDown(0.5);
  doc
    .moveTo(40, doc.y)
    .lineTo(555, doc.y)
    .lineWidth(0.8)
    .strokeColor("#999999")
    .stroke();
  doc.moveDown(0.5);
}

function disclaimer(doc: PDFKit.PDFDocument) {
  const y = 790;

  doc
    .fontSize(7.5)
    .fillColor("#B00020")
    .text(
      "PEC-VERIFY: This document was generated with placeholder Philippine Electrical Code table values " +
        "(ampacities, demand factors, conductor resistances, breaker ratings). A licensed electrical engineer " +
        "must verify all figures against the current PEC edition before submission to MERALCO/LGU.",
      40,
      y,
      { width: 515, align: "center" }
    );
}

// ---------- Page 1: wiring diagram ----------

function drawDiagramPage(doc: PDFKit.PDFDocument, input: PermitPdfInput) {
  const { floorPlan, panel, result } = input;

  header(doc, input, "Wiring Diagram");

  const originX = 60;
  const originY = doc.y + 20;
  const maxWidth = 475;
  const maxHeight = 520;
  const scale = Math.min(
    maxWidth / floorPlan.width,
    maxHeight / floorPlan.height
  );
  const mapX = (x: number) => originX + x * scale;
  const mapY = (y: number) => originY + y * scale;

  // Rooms
  for (const room of floorPlan.rooms) {
    if (room.boundary.length < 3) continue;
    doc
      .moveTo(mapX(room.boundary[0].x), mapY(room.boundary[0].y));
    for (const point of room.boundary.slice(1)) {
      doc.lineTo(mapX(point.x), mapY(point.y));
    }
    doc
      .closePath()
      .fillOpacity(0.06)
      .fillAndStroke("#7C3AED", "#C4B5FD")
      .fillOpacity(1);

    const cx =
      room.boundary.reduce((sum, p) => sum + p.x, 0) / room.boundary.length;
    const cy =
      room.boundary.reduce((sum, p) => sum + p.y, 0) / room.boundary.length;

    doc
      .fontSize(8)
      .fillColor("#666666")
      .text(`${room.name} (${room.type})`, mapX(cx) - 40, mapY(cy) - 4, {
        width: 80,
        align: "center",
      });
  }

  // Routes (under walls)
  const circuitIds = result.circuits.map((circuit) => circuit.id);
  const violating = new Set(
    result.violations.map((violation) => violation.circuitId)
  );

  for (const route of result.routes) {
    if (route.points.length < 2) continue;
    const color = violating.has(route.circuitId)
      ? VIOLATION_COLOR
      : circuitColor(route.circuitId, circuitIds);

    doc.moveTo(mapX(route.points[0].x), mapY(route.points[0].y));
    for (const point of route.points.slice(1)) {
      doc.lineTo(mapX(point.x), mapY(point.y));
    }
    if (route.fallback) doc.dash(3, { space: 2 });
    doc.lineWidth(1.2).strokeColor(color).stroke();
    doc.undash();
  }

  // Walls
  for (const wall of floorPlan.walls) {
    doc
      .moveTo(mapX(wall.start.x), mapY(wall.start.y))
      .lineTo(mapX(wall.end.x), mapY(wall.end.y))
      .lineWidth(Math.max(2, (wall.thickness ?? 0.15) * scale))
      .strokeColor("#333333")
      .stroke();
  }

  // Panel
  doc
    .rect(mapX(panel.position.x) - 6, mapY(panel.position.y) - 8, 12, 16)
    .fillAndStroke("#1F2937", "#111111");
  doc
    .fontSize(7)
    .fillColor("#111111")
    .text(panel.name, mapX(panel.position.x) - 20, mapY(panel.position.y) + 10, {
      width: 40,
      align: "center",
    });

  // Loads
  const circuitByLoad = new Map<string, string>();

  for (const circuit of result.circuits) {
    for (const loadId of circuit.loadIds) circuitByLoad.set(loadId, circuit.id);
  }

  for (const route of result.routes) {
    const point = route.points[route.points.length - 1];
    const color = violating.has(route.circuitId)
      ? VIOLATION_COLOR
      : circuitColor(route.circuitId, circuitIds);

    doc
      .circle(mapX(point.x), mapY(point.y), 4)
      .fillAndStroke(color, "#FFFFFF");
  }

  // Legend
  let legendY = originY + floorPlan.height * scale + 24;

  doc.fontSize(9).fillColor("#111111").text("Legend", 60, legendY);
  legendY += 14;
  for (const circuit of result.circuits) {
    const color = violating.has(circuit.id)
      ? VIOLATION_COLOR
      : circuitColor(circuit.id, circuitIds);

    doc
      .moveTo(60, legendY + 4)
      .lineTo(90, legendY + 4)
      .lineWidth(2)
      .strokeColor(color)
      .stroke();
    doc
      .fontSize(8)
      .fillColor("#333333")
      .text(
        `${circuit.id} — ${circuit.description} (${circuit.breakerAmps} A, ${circuit.conductor.mm2} mm², phase ${circuit.phase})` +
          (violating.has(circuit.id) ? "  ⚠ VIOLATION" : ""),
        98,
        legendY
      );
    legendY += 13;
    if (legendY > 760) break;
  }

  disclaimer(doc);
}

// ---------- Page 2: panel schedule ----------

function drawSchedulePage(doc: PDFKit.PDFDocument, input: PermitPdfInput) {
  const { result } = input;
  const { schedule } = result;

  header(doc, input, "Panel Schedule");

  const columns = [
    { label: "CKT", width: 30 },
    { label: "Description", width: 150 },
    { label: "Ph", width: 25 },
    { label: "Conn (VA)", width: 60 },
    { label: "Dem (VA)", width: 60 },
    { label: "Breaker", width: 50 },
    { label: "Conductor", width: 105 },
    { label: "Run (m)", width: 45 },
  ];
  let y = doc.y + 10;
  let x = 40;

  doc.fontSize(8).fillColor("#111111");
  for (const column of columns) {
    doc.text(column.label, x, y, { width: column.width });
    x += column.width;
  }
  y += 14;
  doc.moveTo(40, y - 3).lineTo(555, y - 3).lineWidth(0.5).strokeColor("#999999").stroke();

  for (const row of schedule.rows) {
    x = 40;
    const cells = [
      String(row.circuitNumber),
      row.description,
      row.phase,
      row.connectedVa.toLocaleString(),
      row.demandVa.toLocaleString(),
      `${row.breakerAmps} A`,
      row.conductor,
      String(row.wireLengthM),
    ];

    doc.fontSize(8).fillColor("#333333");
    for (let i = 0; i < columns.length; i++) {
      doc.text(cells[i], x, y, { width: columns[i].width - 4 });
      x += columns[i].width;
    }
    y += 16;
    if (y > 740) {
      doc.addPage();
      y = 60;
    }
  }

  y += 8;
  doc.moveTo(40, y - 4).lineTo(555, y - 4).lineWidth(0.5).strokeColor("#999999").stroke();
  doc.fontSize(9).fillColor("#111111");
  doc.text(
    `Total connected: ${schedule.totalConnectedVa.toLocaleString()} VA    ` +
      `Total demand: ${schedule.totalDemandVa.toLocaleString()} VA    ` +
      `Feeder: ${schedule.feederAmps} A    Main breaker: ${schedule.mainBreakerAmps} A`,
    40,
    y
  );
  y += 16;
  const phaseText = (["A", "B", "C"] as const)
    .filter((phase) => schedule.phaseVa[phase] > 0)
    .map((phase) => `Phase ${phase}: ${schedule.phaseVa[phase].toLocaleString()} VA`)
    .join("    ");

  doc.fontSize(9).fillColor("#333333").text(phaseText, 40, y);

  disclaimer(doc);
}

// ---------- Page 3: conductor schedule + directory ----------

function drawDirectoryPage(doc: PDFKit.PDFDocument, input: PermitPdfInput) {
  const { result } = input;

  header(doc, input, "Conductor Schedule & Panel Directory");

  // Conductor schedule: aggregate by conductor spec.
  const byConductor = new Map<
    string,
    { count: number; totalLengthM: number }
  >();

  for (const circuit of result.circuits) {
    const key = `${circuit.conductor.mm2} mm² (${circuit.conductor.awg} AWG) ${circuit.conductor.insulation}`;
    const entry = byConductor.get(key) ?? { count: 0, totalLengthM: 0 };

    entry.count += 1;
    entry.totalLengthM += circuit.lengthM;
    byConductor.set(key, entry);
  }

  doc.fontSize(11).fillColor("#111111").text("Conductor Schedule");
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor("#333333");
  for (const [spec, entry] of byConductor) {
    doc.text(
      `• ${spec} — ${entry.count} circuit${entry.count === 1 ? "" : "s"}, ` +
        `approx. ${Math.ceil(entry.totalLengthM)} m total run`
    );
  }

  doc.moveDown(1);
  doc.fontSize(11).fillColor("#111111").text("Panel Directory");
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor("#333333");
  for (const entry of result.directory) {
    doc.text(`${entry.circuitNumber}. ${entry.description}`);
  }

  if (result.violations.length > 0) {
    doc.moveDown(1);
    doc.fontSize(11).fillColor("#B00020").text("Open PEC Violations");
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor("#B00020");
    for (const violation of result.violations) {
      doc.text(`⚠ [${violation.ruleId}] ${violation.message}`);
    }
  }

  disclaimer(doc);
}
