/**
 * Typed client for the Solence API (server/docs/api.md).
 *
 * All wiring-simulation domain logic lives in the Express service;
 * frontend components must call it through these wrappers only.
 */
import {
  AutoLightingOptions,
  AutoLightingPlacement,
  ElectricalLoad,
  FloorPlan,
  Panel,
  Project,
  SimulateOptions,
  SimulationResult,
} from "./types";

export * from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000";

/** WebSocket endpoint for the realtime gateway (server/docs/api.md). */
export function realtimeUrl(): string {
  return `${BASE_URL.replace(/^http/, "ws")}/ws`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public issues?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error ?? `Request failed with status ${response.status}`,
      payload?.issues,
    );
  }

  return payload as T;
}

export const api = {
  health: () =>
    request<{ status: string; service: string; supabase: string }>(
      "GET",
      "/health",
    ),

  projects: {
    create: (name: string) => request<Project>("POST", "/projects", { name }),
    list: () => request<Project[]>("GET", "/projects"),
    get: (id: string) => request<Project>("GET", `/projects/${id}`),
    rename: (id: string, name: string) =>
      request<Project>("PATCH", `/projects/${id}`, { name }),
    remove: (id: string) => request<void>("DELETE", `/projects/${id}`),

    setFloorPlan: (id: string, floorPlan: FloorPlan) =>
      request<Project>("PUT", `/projects/${id}/floorplan`, floorPlan),
    setPanel: (id: string, panel: Panel) =>
      request<Project>("PUT", `/projects/${id}/panel`, panel),

    setLoads: (id: string, loads: ElectricalLoad[]) =>
      request<Project>("PUT", `/projects/${id}/loads`, loads),
    addLoad: (id: string, load: ElectricalLoad) =>
      request<Project>("POST", `/projects/${id}/loads`, load),
    updateLoad: (id: string, load: ElectricalLoad) =>
      request<Project>("PUT", `/projects/${id}/loads/${load.id}`, load),
    removeLoad: (id: string, loadId: string) =>
      request<Project>("DELETE", `/projects/${id}/loads/${loadId}`),

    autoLighting: (id: string, options?: AutoLightingOptions) =>
      request<{ project: Project; placements: AutoLightingPlacement[] }>(
        "POST",
        `/projects/${id}/lighting/auto`,
        options ?? {},
      ),

    simulate: (id: string, options?: SimulateOptions) =>
      request<SimulationResult>(
        "POST",
        `/projects/${id}/simulate`,
        options ?? {},
      ),
    results: (id: string) =>
      request<SimulationResult>("GET", `/projects/${id}/results`),

    /** Upload a floor plan image for AI recognition (brief §7.4). Progress
     * arrives over the realtime `/ws` gateway as `ai-progress` events;
     * this call only returns the job id. */
    recognize: async (
      id: string,
      file: File | Blob,
    ): Promise<{ jobId: string }> => {
      const form = new FormData();

      form.append("image", file, file instanceof File ? file.name : "plan.png");
      const response = await fetch(`${BASE_URL}/api/projects/${id}/recognize`, {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new ApiError(
          response.status,
          payload?.error ?? `Recognition failed with status ${response.status}`,
        );
      }

      return payload as { jobId: string };
    },

    exportPdf: async (id: string): Promise<Blob> => {
      const response = await fetch(`${BASE_URL}/api/projects/${id}/export`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);

        throw new ApiError(
          response.status,
          payload?.error ?? `Export failed with status ${response.status}`,
        );
      }

      return response.blob();
    },
  },
};
