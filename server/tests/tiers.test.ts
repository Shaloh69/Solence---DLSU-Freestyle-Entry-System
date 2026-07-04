/**
 * Tier gating: project count cap, circuit cap, and export lock enforced
 * per tier via the x-solence-tier header (stand-in for auth-carried
 * plans until Supabase auth lands).
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { InMemoryProjectRepository } from "../src/db/repository.js";
import { resolveTier, TIERS } from "../src/tiers.js";
import { FloorPlan, Panel } from "../src/engine/types.js";

const floorPlan: FloorPlan = {
  width: 10,
  height: 8,
  walls: [
    { id: "n", start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
    { id: "e", start: { x: 10, y: 0 }, end: { x: 10, y: 8 } },
    { id: "s", start: { x: 10, y: 8 }, end: { x: 0, y: 8 } },
    { id: "w", start: { x: 0, y: 8 }, end: { x: 0, y: 0 } },
  ],
  rooms: [],
};

const panel: Panel = {
  id: "p1",
  name: "LP-1",
  position: { x: 0.5, y: 0.5 },
  system: "1P3W-120/240",
  mainBreakerAmps: 0,
};

/** Six dedicated appliances -> six circuits, over the free cap of 5. */
const sixDedicatedLoads = Array.from({ length: 6 }, (_, i) => ({
  id: `app${i}`,
  name: `Appliance ${i}`,
  type: "appliance" as const,
  va: 1000,
  voltage: 120,
  continuous: false,
  position: { x: 2 + i, y: 4 },
}));

function makeApp() {
  return createApp({ repository: new InMemoryProjectRepository() });
}

describe("resolveTier", () => {
  it("prefers the header, then env, then pro", () => {
    expect(resolveTier("free", "firm").name).toBe("free");
    expect(resolveTier(undefined, "firm").name).toBe("firm");
    expect(resolveTier(undefined, undefined).name).toBe("pro");
    expect(resolveTier("bogus", undefined).name).toBe("pro");
  });

  it("locks export on free only", () => {
    expect(TIERS.free.canExport).toBe(false);
    expect(TIERS.pro.canExport).toBe(true);
    expect(TIERS.firm.apiAccess).toBe(true);
    expect(TIERS.lgu.auditTrail).toBe(true);
  });
});

describe("free tier gating", () => {
  it("caps projects at one", async () => {
    const app = makeApp();

    await request(app)
      .post("/api/projects")
      .set("x-solence-tier", "free")
      .send({ name: "First" })
      .expect(201);

    const denied = await request(app)
      .post("/api/projects")
      .set("x-solence-tier", "free")
      .send({ name: "Second" })
      .expect(403);

    expect(denied.body.error).toContain("upgrade to Pro");

    // Pro is not capped.
    await request(app)
      .post("/api/projects")
      .set("x-solence-tier", "pro")
      .send({ name: "Second" })
      .expect(201);
  });

  it("caps circuits at five", async () => {
    const app = makeApp();
    const project = (
      await request(app).post("/api/projects").send({ name: "Big" })
    ).body;

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
      .send(sixDedicatedLoads)
      .expect(200);

    const denied = await request(app)
      .post(`/api/projects/${project.id}/simulate`)
      .set("x-solence-tier", "free")
      .send({})
      .expect(403);

    expect(denied.body.error).toContain("6 circuits");

    await request(app)
      .post(`/api/projects/${project.id}/simulate`)
      .set("x-solence-tier", "pro")
      .send({})
      .expect(200);
  });

  it("locks PDF export", async () => {
    const app = makeApp();
    const project = (
      await request(app).post("/api/projects").send({ name: "Locked" })
    ).body;

    const denied = await request(app)
      .post(`/api/projects/${project.id}/export`)
      .set("x-solence-tier", "free")
      .expect(403);

    expect(denied.body.error).toContain("export");
  });
});
