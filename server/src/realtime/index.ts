/**
 * WebSocket gateway (section 2.4). The Express API is the single
 * real-time endpoint the frontend talks to: clients connect to /ws,
 * subscribe to a project, and receive push events — updated compliance/
 * simulation results after any recompute, and (later) staged AI job
 * progress relayed from solence-vision. The frontend never opens a
 * socket to solence-vision directly.
 *
 * Events (server -> client), all JSON:
 *   { type: "subscribed",  projectId }
 *   { type: "simulation",  projectId, result: SimulationResult }
 *   { type: "ai-progress", projectId, jobId, stage, message? }
 *     stage: queued | running_wall_segmentation | running_detection |
 *            fusing | done | applied | error — relayed from
 *            solence-vision's job WebSocket by routes/vision.ts, plus a
 *            final "applied" stage once the recognized floor plan has
 *            been written into the project.
 *
 * Client -> server:
 *   { type: "subscribe", projectId }
 */
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";

interface ClientState {
  projectId: string | null;
}

const clients = new Map<WebSocket, ClientState>();

export function attachRealtime(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    clients.set(socket, { projectId: null });

    socket.on("message", (raw) => {
      let message: unknown;

      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (
        typeof message === "object" &&
        message !== null &&
        (message as { type?: unknown }).type === "subscribe" &&
        typeof (message as { projectId?: unknown }).projectId === "string"
      ) {
        const projectId = (message as { projectId: string }).projectId;
        const state = clients.get(socket);

        if (state) state.projectId = projectId;
        socket.send(JSON.stringify({ type: "subscribed", projectId }));
      }
    });

    socket.on("close", () => clients.delete(socket));
    socket.on("error", () => clients.delete(socket));
  });

  return wss;
}

/** Push an event to every client subscribed to the project. */
export function broadcastToProject(
  projectId: string,
  event: Record<string, unknown>
): void {
  const payload = JSON.stringify({ ...event, projectId });

  for (const [socket, state] of clients) {
    if (state.projectId === projectId && socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}
