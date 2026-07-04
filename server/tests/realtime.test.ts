/**
 * Realtime gateway: subscribe over /ws, trigger a simulation via HTTP,
 * expect the result to be pushed to the subscribed socket.
 */
import { describe, it, expect, afterEach } from "vitest";
import { createServer, Server } from "node:http";
import { AddressInfo } from "node:net";
import WebSocket from "ws";
import request from "supertest";
import { createApp } from "../src/app.js";
import { attachRealtime } from "../src/realtime/index.js";
import { InMemoryProjectRepository } from "../src/db/repository.js";
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

let server: Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
});

describe("realtime gateway", () => {
  it("pushes simulation results to subscribed clients", async () => {
    const app = createApp({ repository: new InMemoryProjectRepository() });

    server = createServer(app);
    attachRealtime(server);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const project = (
      await request(server).post("/api/projects").send({ name: "RT" })
    ).body;

    await request(server)
      .put(`/api/projects/${project.id}/floorplan`)
      .send(floorPlan)
      .expect(200);
    await request(server)
      .put(`/api/projects/${project.id}/panel`)
      .send(panel)
      .expect(200);
    await request(server)
      .post(`/api/projects/${project.id}/loads`)
      .send({
        id: "l1",
        name: "Light",
        type: "lighting",
        va: 100,
        voltage: 120,
        continuous: true,
        position: { x: 5, y: 4 },
      })
      .expect(201);

    // Connect + subscribe.
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const events: { type: string; projectId?: string }[] = [];
    const gotSimulation = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("no simulation event within 5s")),
        5000
      );

      socket.on("message", (raw) => {
        const event = JSON.parse(String(raw));

        events.push(event);
        if (event.type === "simulation") {
          clearTimeout(timer);
          resolve();
        }
      });
      socket.on("error", reject);
    });

    await new Promise<void>((resolve) => socket.on("open", () => resolve()));
    socket.send(JSON.stringify({ type: "subscribe", projectId: project.id }));

    // Wait for the subscribe ack before triggering the run.
    await new Promise<void>((resolve) => {
      const check = () => {
        if (events.some((event) => event.type === "subscribed")) resolve();
        else setTimeout(check, 20);
      };

      check();
    });

    await request(server)
      .post(`/api/projects/${project.id}/simulate`)
      .send({})
      .expect(200);

    await gotSimulation;

    const simulation = events.find((event) => event.type === "simulation") as {
      type: string;
      projectId: string;
      result: { circuits: unknown[] };
    };

    expect(simulation.projectId).toBe(project.id);
    expect(simulation.result.circuits.length).toBeGreaterThan(0);
    socket.close();
  });
});
