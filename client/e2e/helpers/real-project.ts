/**
 * E2E fixture: a real ResPlan house (CC BY 4.0, test-assets/plans/resplan)
 * loaded into a fresh project through the public API, furnished from the
 * furniture library, with a panel, one receptacle per room, auto-lighting,
 * and a simulation run — so every layer has real content.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { APIRequestContext } from "@playwright/test";

import { FURNITURE_LIBRARY } from "../../lib/furniture-library";
import type { ElectricalLoad, FloorPlan, Furniture, Point, Room } from "../../lib/api-client/types";

const CORPUS = join(__dirname, "../../../test-assets/plans/resplan");

/** Furniture per room type: footprint-only pieces (no light-emitting items). */
const FURNISH: Partial<Record<Room["type"], string[]>> = {
  bedroom: ["bed-double", "wardrobe", "nightstand"],
  living: ["sofa-3seat", "coffee-table", "tv-stand"],
  dining: ["dining-table"],
  kitchen: ["kitchen-counter", "refrigerator-unit"],
  office: ["desk", "office-chair"],
};

export interface RealProject {
  id: string;
  planId: string;
  floorPlan: FloorPlan;
  loads: ElectricalLoad[];
}

function centroid(points: Point[]): Point {
  const n = points.length;

  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  };
}

export function loadPlan(index: number): { planId: string; floorPlan: FloorPlan } {
  const corpusIndex = JSON.parse(readFileSync(join(CORPUS, "INDEX.json"), "utf8")) as {
    plans: { file: string }[];
  };
  const entry = corpusIndex.plans[index];

  if (!entry) throw new Error(`No plan #${index} in ${CORPUS}/INDEX.json`);
  const raw = JSON.parse(readFileSync(join(CORPUS, entry.file), "utf8"));

  return { planId: entry.file.replace(/\.json$/, ""), floorPlan: raw.floorPlan as FloorPlan };
}

export function furnish(floorPlan: FloorPlan): Furniture[] {
  const pieces: Furniture[] = [];

  for (const room of floorPlan.rooms) {
    const c = centroid(room.boundary);

    (FURNISH[room.type] ?? []).forEach((key, i) => {
      const item = FURNITURE_LIBRARY.find((f) => f.key === key);

      if (!item) throw new Error(`furniture-library has no "${key}"`);
      pieces.push({
        id: `f-${room.id}-${i}`,
        key: item.key,
        label: item.label,
        meshKey: item.meshKey,
        position: { x: c.x + (i - 1) * 0.6, y: c.y + (i - 1) * 0.4 },
        rotation: 0,
        width: item.width,
        depth: item.depth,
        height: item.height,
      });
    });
  }

  return pieces;
}

export async function createRealProject(api: APIRequestContext, apiUrl: string, planIndex = 6): Promise<RealProject> {
  const { planId, floorPlan: plan } = loadPlan(planIndex);
  const floorPlan: FloorPlan = { ...plan, furniture: furnish(plan) };
  const living = floorPlan.rooms.find((r) => r.type === "living") ?? floorPlan.rooms[0];
  const call = async (method: "post" | "put", path: string, data?: unknown) => {
    const res = await api[method](`${apiUrl}/api${path}`, { data });

    if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()} ${await res.text()}`);

    return res.json();
  };

  const project = await call("post", "/projects", { name: `E2E ${planId}` });
  const id: string = project.id;

  await call("put", `/projects/${id}/floorplan`, floorPlan);
  await call("put", `/projects/${id}/panel`, {
    id: "lp-1",
    name: "LP-1",
    position: centroid(living.boundary),
    system: "1P2W-230",
    mainBreakerAmps: 0,
  });
  const receptacles: ElectricalLoad[] = floorPlan.rooms.map((room, i) => {
    const c = centroid(room.boundary);

    return {
      id: `r-${i}`,
      name: `Receptacle ${room.name}`,
      type: "outlet",
      va: 180,
      voltage: 230,
      continuous: false,
      position: { x: c.x + 0.5, y: c.y - 0.5 },
      roomId: room.id,
    };
  });

  await call("put", `/projects/${id}/loads`, receptacles);
  await call("post", `/projects/${id}/lighting/auto`, {});
  await call("post", `/projects/${id}/simulate`);
  const stored = await (await api.get(`${apiUrl}/api/projects/${id}`)).json();

  return { id, planId, floorPlan, loads: stored.loads as ElectricalLoad[] };
}
