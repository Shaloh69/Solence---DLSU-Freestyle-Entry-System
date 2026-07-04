/**
 * Integration tests: the full API surface over the in-memory repository,
 * driving the MVP demo story end to end — create project, set floor plan,
 * place panel + loads, simulate, read results.
 */
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { InMemoryProjectRepository } from "../src/db/repository.js";
import { FloorPlan, Panel, ElectricalLoad } from "../src/engine/types.js";

const floorPlan: FloorPlan = {
  width: 10,
  height: 8,
  walls: [
    { id: "n", start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
    { id: "e", start: { x: 10, y: 0 }, end: { x: 10, y: 8 } },
    { id: "s", start: { x: 10, y: 8 }, end: { x: 0, y: 8 } },
    { id: "w", start: { x: 0, y: 8 }, end: { x: 0, y: 0 } },
  ],
  rooms: [
    {
      id: "kitchen",
      name: "Kitchen",
      type: "kitchen",
      boundary: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 8 },
        { x: 0, y: 8 },
      ],
    },
  ],
};

const panel: Panel = {
  id: "panel-1",
  name: "LP-1",
  position: { x: 0.5, y: 0.5 },
  system: "1P3W-120/240",
  mainBreakerAmps: 0,
};

const loads: ElectricalLoad[] = [
  {
    id: "light-1",
    name: "Kitchen lights",
    type: "lighting",
    va: 300,
    voltage: 120,
    continuous: true,
    position: { x: 2.5, y: 2 },
    roomId: "kitchen",
  },
  {
    id: "outlet-1",
    name: "Counter outlet",
    type: "outlet",
    va: 360,
    voltage: 120,
    continuous: false,
    position: { x: 4.5, y: 1 },
    roomId: "kitchen",
  },
  {
    id: "fridge",
    name: "Refrigerator",
    type: "appliance",
    va: 1200,
    voltage: 120,
    continuous: false,
    position: { x: 4.5, y: 6 },
    roomId: "kitchen",
  },
];

function makeApp() {
  return createApp({ repository: new InMemoryProjectRepository() });
}

describe("project CRUD", () => {
  let app: ReturnType<typeof makeApp>;

  beforeEach(() => {
    app = makeApp();
  });

  it("creates, lists, renames, and deletes projects", async () => {
    const created = await request(app)
      .post("/api/projects")
      .send({ name: "House A" })
      .expect(201);

    expect(created.body.name).toBe("House A");
    expect(created.body.loads).toEqual([]);

    const list = await request(app).get("/api/projects").expect(200);

    expect(list.body).toHaveLength(1);

    const renamed = await request(app)
      .patch(`/api/projects/${created.body.id}`)
      .send({ name: "House B" })
      .expect(200);

    expect(renamed.body.name).toBe("House B");

    await request(app).delete(`/api/projects/${created.body.id}`).expect(204);
    await request(app).get(`/api/projects/${created.body.id}`).expect(404);
  });

  it("validates request bodies", async () => {
    const response = await request(app)
      .post("/api/projects")
      .send({ name: "" })
      .expect(400);

    expect(response.body.error).toBe("Validation failed");
    expect(response.body.issues).toBeDefined();
  });

  it("404s on unknown project", async () => {
    await request(app).get("/api/projects/nope").expect(404);
  });
});

describe("MVP demo flow", () => {
  it("runs the core loop end to end", async () => {
    const app = makeApp();
    const project = (
      await request(app).post("/api/projects").send({ name: "Demo" })
    ).body;

    await request(app)
      .put(`/api/projects/${project.id}/floorplan`)
      .send(floorPlan)
      .expect(200);
    await request(app)
      .put(`/api/projects/${project.id}/panel`)
      .send(panel)
      .expect(200);

    for (const load of loads) {
      await request(app)
        .post(`/api/projects/${project.id}/loads`)
        .send(load)
        .expect(201);
    }

    const simulated = await request(app)
      .post(`/api/projects/${project.id}/simulate`)
      .send({})
      .expect(200);

    const result = simulated.body;

    // Every load routed, no routing errors.
    expect(result.routingErrors).toEqual([]);
    expect(result.routes).toHaveLength(3);
    for (const route of result.routes) {
      expect(route.points.length).toBeGreaterThan(1);
      expect(route.lengthM).toBeGreaterThan(0);
      expect(route.circuitId).toBeTruthy();
    }

    // Lighting and outlets share/split circuits; the appliance is dedicated.
    expect(result.circuits.length).toBeGreaterThanOrEqual(2);
    for (const circuit of result.circuits) {
      expect(circuit.breakerAmps).toBeGreaterThan(0);
      expect(circuit.conductor.ampacity).toBeGreaterThanOrEqual(
        circuit.breakerAmps
      );
    }

    // Panel schedule with auto-sized main breaker and phase totals.
    expect(result.schedule.rows).toHaveLength(result.circuits.length);
    expect(result.schedule.mainBreakerAmps).toBeGreaterThan(0);
    expect(
      result.schedule.phaseVa.A + result.schedule.phaseVa.B
    ).toBe(result.schedule.totalConnectedVa);

    // Directory entry per circuit.
    expect(result.directory).toHaveLength(result.circuits.length);

    // A sane design has no violations.
    expect(result.violations).toEqual([]);

    // Results are persisted.
    const stored = await request(app)
      .get(`/api/projects/${project.id}/results`)
      .expect(200);

    expect(stored.body.circuits).toHaveLength(result.circuits.length);
  });

  it("flags violations on an intentionally overloaded circuit", async () => {
    const app = makeApp();
    const project = (
      await request(app).post("/api/projects").send({ name: "Overload" })
    ).body;

    await request(app)
      .put(`/api/projects/${project.id}/floorplan`)
      .send(floorPlan)
      .expect(200);
    await request(app)
      .put(`/api/projects/${project.id}/panel`)
      .send(panel)
      .expect(200);

    // A distant, heavily loaded continuous load on a thin wire run:
    // high VA at 120 V over a long wall-following run trips voltage drop.
    await request(app)
      .post(`/api/projects/${project.id}/loads`)
      .send({
        id: "heater",
        name: "Water heater",
        type: "equipment",
        va: 2000,
        voltage: 120,
        continuous: true,
        position: { x: 9.5, y: 7.5 },
        roomId: "kitchen",
      })
      .expect(201);

    const result = (
      await request(app)
        .post(`/api/projects/${project.id}/simulate`)
        .send({})
        .expect(200)
    ).body;

    const ruleIds = result.violations.map(
      (violation: { ruleId: string }) => violation.ruleId
    );

    expect(ruleIds).toContain("voltage-drop-branch");
  });

  it("enforces simulation preconditions", async () => {
    const app = makeApp();
    const project = (
      await request(app).post("/api/projects").send({ name: "Empty" })
    ).body;

    const response = await request(app)
      .post(`/api/projects/${project.id}/simulate`)
      .send({})
      .expect(422);

    expect(response.body.error).toContain("floor plan");
  });

  it("bulk-replaces loads", async () => {
    const app = makeApp();
    const project = (
      await request(app).post("/api/projects").send({ name: "Bulk" })
    ).body;

    const updated = await request(app)
      .put(`/api/projects/${project.id}/loads`)
      .send(loads)
      .expect(200);

    expect(updated.body.loads).toHaveLength(3);

    const cleared = await request(app)
      .put(`/api/projects/${project.id}/loads`)
      .send([])
      .expect(200);

    expect(cleared.body.loads).toHaveLength(0);

    await request(app)
      .put(`/api/projects/${project.id}/loads`)
      .send([loads[0], loads[0]])
      .expect(400);
  });

  it("exports a permit PDF after simulation, 422 before", async () => {
    const app = makeApp();
    const project = (
      await request(app).post("/api/projects").send({ name: "Export" })
    ).body;

    await request(app).post(`/api/projects/${project.id}/export`).expect(422);

    await request(app)
      .put(`/api/projects/${project.id}/floorplan`)
      .send(floorPlan)
      .expect(200);
    await request(app)
      .put(`/api/projects/${project.id}/panel`)
      .send(panel)
      .expect(200);
    await request(app)
      .put(`/api/projects/${project.id}/loads`)
      .send(loads)
      .expect(200);
    await request(app)
      .post(`/api/projects/${project.id}/simulate`)
      .send({})
      .expect(200);

    const response = await request(app)
      .post(`/api/projects/${project.id}/export`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];

        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200)
      .expect("Content-Type", /application\/pdf/);

    const pdf = response.body as Buffer;

    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
