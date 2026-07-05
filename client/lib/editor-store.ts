/**
 * Zustand store for the wiring editor. Owns the working copy of a
 * project (floor plan, openings, panel, loads) plus editor UI state
 * (tool, selection, CAD layers, cursor), syncs with the Express API,
 * and listens on the realtime WebSocket for pushed simulation results.
 * No domain math lives here — sizing, routing, photometrics, and
 * compliance all come back from the backend engine.
 */
import { create } from "zustand";
import { toast } from "sonner";
import {
  api,
  realtimeUrl,
  ElectricalLoad,
  FloorPlan,
  Opening,
  Panel,
  Point,
  Room,
  RoomType,
  SimulationResult,
  VoltageSystem,
  Wall,
} from "./api-client";
import {
  COMPONENT_LIBRARY,
  defaultVoltage,
  LibraryItem,
} from "./component-library";

export type Tool = "select" | "wall" | "room" | "panel" | "load" | "door" | "window";
export type Selection =
  | { kind: "wall"; id: string }
  | { kind: "room"; id: string }
  | { kind: "load"; id: string }
  | { kind: "opening"; id: string }
  | { kind: "panel" }
  | null;

export type LayerKey =
  | "walls"
  | "rooms"
  | "loads"
  | "lighting"
  | "wiring"
  | "heatmap"
  | "violations";

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  walls: true,
  rooms: true,
  loads: true,
  lighting: true,
  wiring: true,
  heatmap: false,
  violations: true,
};

const DEFAULT_PLAN_WIDTH = 12;
const DEFAULT_PLAN_HEIGHT = 9;
const WALL_SNAP_DISTANCE = 0.35;
const WALL_STANDOFF = 0.2;

function emptyFloorPlan(): FloorPlan {
  return {
    width: DEFAULT_PLAN_WIDTH,
    height: DEFAULT_PLAN_HEIGHT,
    walls: [],
    rooms: [],
    openings: [],
  };
}

function perimeterWalls(width: number, height: number): Wall[] {
  const stamp = Date.now();

  return [
    { id: `w-${stamp}-n`, start: { x: 0, y: 0 }, end: { x: width, y: 0 } },
    { id: `w-${stamp}-e`, start: { x: width, y: 0 }, end: { x: width, y: height } },
    { id: `w-${stamp}-s`, start: { x: width, y: height }, end: { x: 0, y: height } },
    { id: `w-${stamp}-w`, start: { x: 0, y: height }, end: { x: 0, y: 0 } },
  ];
}

/** Nearest wall within maxDistance, with projection info. */
function nearestWall(
  point: Point,
  walls: Wall[],
  maxDistance: number
): { wall: Wall; distance: number; t: number; proj: Point } | null {
  let best: { wall: Wall; distance: number; t: number; proj: Point } | null =
    null;

  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) continue;
    const t = Math.min(
      1,
      Math.max(
        0,
        ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) /
          lengthSq
      )
    );
    const proj = { x: wall.start.x + t * dx, y: wall.start.y + t * dy };
    const distance = Math.hypot(point.x - proj.x, point.y - proj.y);

    if (distance <= maxDistance && (!best || distance < best.distance)) {
      best = { wall, distance, t, proj };
    }
  }

  return best;
}

let autoCheckTimer: ReturnType<typeof setTimeout> | null = null;
let socket: WebSocket | null = null;
let socketProjectId: string | null = null;

interface EditorState {
  // Project working copy
  projectId: string | null;
  projectName: string;
  floorPlan: FloorPlan;
  panel: Panel | null;
  loads: ElectricalLoad[];
  result: SimulationResult | null;

  // UI state
  tool: Tool;
  libraryItem: LibraryItem | null;
  selection: Selection;
  view: "2d" | "3d";
  layers: Record<LayerKey, boolean>;
  cursor: Point | null;
  snappedToWall: boolean;
  autoCheck: boolean;
  isLoading: boolean;
  isSimulating: boolean;
  isLightingBusy: boolean;
  dirty: boolean;
  error: string | null;

  // Lifecycle
  openProject(id: string): Promise<void>;
  saveAndSimulate(options?: { silent?: boolean }): Promise<void>;
  autoLighting(roomIds?: string[]): Promise<void>;

  // Editing
  setTool(tool: Tool): void;
  setLibraryItem(item: LibraryItem | null): void;
  setView(view: "2d" | "3d"): void;
  setLayer(layer: LayerKey, visible: boolean): void;
  setAutoCheck(on: boolean): void;
  setSelection(selection: Selection): void;
  setCursor(point: Point | null, snapped?: boolean): void;
  setPlanSize(width: number, height: number): void;
  setBackgroundImage(dataUrl: string | undefined): void;
  addPerimeter(): void;
  addWall(start: Point, end: Point): void;
  addRoom(a: Point, b: Point): void;
  addOpening(kind: "door" | "window", at: Point): void;
  updateRoom(id: string, changes: Partial<Pick<Room, "name" | "type">>): void;
  placePanel(position: Point, system?: VoltageSystem): void;
  placeLoad(item: LibraryItem, position: Point): void;
  updateLoad(id: string, changes: Partial<ElectricalLoad>): void;
  /** Typed-coordinate placement: exact position (no snapping), room re-detected. */
  setLoadPosition(id: string, position: Point): void;
  moveItem(selection: Selection, position: Point): void;
  deleteSelection(): void;
  clearError(): void;
}

export const useEditorStore = create<EditorState>((set, get) => {
  function touched() {
    set({ dirty: true });
    if (autoCheckTimer) clearTimeout(autoCheckTimer);
    const { autoCheck, panel, loads } = get();

    if (autoCheck && panel && loads.length > 0) {
      autoCheckTimer = setTimeout(() => {
        void get().saveAndSimulate({ silent: true });
      }, 800);
    }
  }

  function roomAt(position: Point): Room | undefined {
    return get().floorPlan.rooms.find((room) => {
      let inside = false;
      const boundary = room.boundary;

      for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
        const a = boundary[i];
        const b = boundary[j];

        if (
          a.y > position.y !== b.y > position.y &&
          position.x <
            ((b.x - a.x) * (position.y - a.y)) / (b.y - a.y) + a.x
        ) {
          inside = !inside;
        }
      }

      return inside;
    });
  }

  /** Snap a load position against nearby walls at a standoff. */
  function snapLoadPosition(point: Point): { point: Point; snapped: boolean } {
    const hit = nearestWall(point, get().floorPlan.walls, WALL_SNAP_DISTANCE);

    if (!hit || hit.distance < 0.01) return { point, snapped: false };
    const nx = (point.x - hit.proj.x) / hit.distance;
    const ny = (point.y - hit.proj.y) / hit.distance;

    return {
      point: {
        x: Math.round((hit.proj.x + nx * WALL_STANDOFF) * 100) / 100,
        y: Math.round((hit.proj.y + ny * WALL_STANDOFF) * 100) / 100,
      },
      snapped: true,
    };
  }

  function connectRealtime(projectId: string) {
    if (socketProjectId === projectId && socket?.readyState === WebSocket.OPEN) {
      return;
    }
    socket?.close();
    socketProjectId = projectId;
    try {
      socket = new WebSocket(realtimeUrl());
    } catch {
      return; // realtime is an enhancement, not a requirement
    }

    socket.onopen = () =>
      socket?.send(JSON.stringify({ type: "subscribe", projectId }));
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(String(message.data));

        if (
          event.type === "simulation" &&
          event.projectId === get().projectId
        ) {
          applyResult(event.result as SimulationResult, { silent: true });
        }
      } catch {
        // ignore malformed events
      }
    };
    socket.onclose = () => {
      if (socketProjectId === projectId) {
        setTimeout(() => {
          if (get().projectId === projectId) connectRealtime(projectId);
        }, 3000);
      }
    };
  }

  function applyResult(
    result: SimulationResult,
    options: { silent?: boolean } = {}
  ) {
    const previousErrors =
      get().result?.violations.filter((v) => v.severity === "error").length ??
      0;
    const errors = result.violations.filter(
      (violation) => violation.severity === "error"
    ).length;

    set({ result });

    if (errors > previousErrors) {
      toast.warning(
        `${errors} PEC violation${errors === 1 ? "" : "s"} in this design`,
        {
          description: result.violations.find(
            (violation) => violation.severity === "error"
          )?.message,
          duration: 10000,
        }
      );
    } else if (!options.silent) {
      toast.success(
        `Checked: ${result.circuits.length} circuits, ${result.violations.length} finding${result.violations.length === 1 ? "" : "s"}`
      );
    }
  }

  return {
    projectId: null,
    projectName: "",
    floorPlan: emptyFloorPlan(),
    panel: null,
    loads: [],
    result: null,

    tool: "select",
    libraryItem: null,
    selection: null,
    view: "2d",
    layers: { ...DEFAULT_LAYERS },
    cursor: null,
    snappedToWall: false,
    autoCheck: true,
    isLoading: false,
    isSimulating: false,
    isLightingBusy: false,
    dirty: false,
    error: null,

    async openProject(id) {
      set({ isLoading: true, error: null, result: null, selection: null });
      try {
        const project = await api.projects.get(id);

        set({
          projectId: project.id,
          projectName: project.name,
          floorPlan: project.floorPlan ?? emptyFloorPlan(),
          panel: project.panel,
          loads: project.loads,
          result: project.lastResult,
          dirty: false,
          isLoading: false,
        });
        connectRealtime(project.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        set({ isLoading: false, error: message });
        toast.error(`Could not open project: ${message}`);
      }
    },

    async saveAndSimulate(options = {}) {
      const { projectId, floorPlan, panel, loads, isSimulating } = get();

      if (!projectId || isSimulating) return;
      set({ isSimulating: true, error: null });
      try {
        await api.projects.setFloorPlan(projectId, floorPlan);
        if (panel) await api.projects.setPanel(projectId, panel);
        await api.projects.setLoads(projectId, loads);

        if (panel && loads.length > 0) {
          const result = await api.projects.simulate(projectId);

          applyResult(result, options);
          set({ dirty: false, isSimulating: false });
        } else {
          set({ dirty: false, isSimulating: false });
          if (!options.silent) toast.success("Project saved");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        set({ isSimulating: false, error: message });
        toast.error(`Check failed: ${message}`);
      }
    },

    async autoLighting(roomIds) {
      const { projectId, floorPlan } = get();

      if (!projectId) return;
      if (floorPlan.rooms.length === 0) {
        toast.error("Draw at least one room before auto-generating lighting");

        return;
      }
      set({ isLightingBusy: true });
      toast.info("Generating lighting layout (lumen method)…");
      try {
        // Persist current geometry first so the engine sees it.
        await api.projects.setFloorPlan(projectId, floorPlan);
        const { project, placements } = await api.projects.autoLighting(
          projectId,
          { roomIds }
        );

        set({ loads: project.loads, isLightingBusy: false });
        const total = placements.reduce(
          (sum, placement) => sum + placement.placedCount,
          0
        );

        toast.success(
          `Placed ${total} fixture${total === 1 ? "" : "s"} across ${placements.length} room${placements.length === 1 ? "" : "s"} — drag or delete any of them`
        );
        void get().saveAndSimulate({ silent: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        set({ isLightingBusy: false });
        toast.error(`Auto-lighting failed: ${message}`);
      }
    },

    setTool: (tool) => set({ tool, libraryItem: null, selection: null }),
    setLibraryItem: (item) =>
      set({ libraryItem: item, tool: item ? "load" : "select" }),
    setView: (view) => set({ view }),
    setLayer: (layer, visible) =>
      set((state) => ({ layers: { ...state.layers, [layer]: visible } })),
    setAutoCheck: (autoCheck) => set({ autoCheck }),
    setSelection: (selection) => set({ selection }),
    setCursor: (cursor, snapped = false) =>
      set({ cursor, snappedToWall: snapped }),
    clearError: () => set({ error: null }),

    setPlanSize(width, height) {
      set((state) => ({ floorPlan: { ...state.floorPlan, width, height } }));
      touched();
    },

    setBackgroundImage(dataUrl) {
      set((state) => ({
        floorPlan: { ...state.floorPlan, backgroundImage: dataUrl },
      }));
      if (dataUrl) toast.success("Trace image added — draw walls over it");
      touched();
    },

    addPerimeter() {
      set((state) => ({
        floorPlan: {
          ...state.floorPlan,
          walls: [
            ...state.floorPlan.walls,
            ...perimeterWalls(state.floorPlan.width, state.floorPlan.height),
          ],
        },
      }));
      touched();
    },

    addWall(start, end) {
      if (Math.hypot(end.x - start.x, end.y - start.y) < 0.2) return;
      set((state) => ({
        floorPlan: {
          ...state.floorPlan,
          walls: [
            ...state.floorPlan.walls,
            { id: `w-${crypto.randomUUID().slice(0, 8)}`, start, end },
          ],
        },
      }));
      touched();
    },

    addRoom(a, b) {
      const x1 = Math.min(a.x, b.x);
      const x2 = Math.max(a.x, b.x);
      const y1 = Math.min(a.y, b.y);
      const y2 = Math.max(a.y, b.y);

      if (x2 - x1 < 0.5 || y2 - y1 < 0.5) return;
      const id = `r-${crypto.randomUUID().slice(0, 8)}`;

      set((state) => ({
        floorPlan: {
          ...state.floorPlan,
          rooms: [
            ...state.floorPlan.rooms,
            {
              id,
              name: `Room ${state.floorPlan.rooms.length + 1}`,
              type: "other" as RoomType,
              boundary: [
                { x: x1, y: y1 },
                { x: x2, y: y1 },
                { x: x2, y: y2 },
                { x: x1, y: y2 },
              ],
            },
          ],
        },
        selection: { kind: "room", id },
      }));
      touched();
    },

    addOpening(kind, at) {
      const hit = nearestWall(at, get().floorPlan.walls, 0.5);

      if (!hit) {
        toast.error(`Click on a wall to place a ${kind}`);

        return;
      }
      const width = kind === "door" ? 0.9 : 1.2;
      const wallLen = Math.hypot(
        hit.wall.end.x - hit.wall.start.x,
        hit.wall.end.y - hit.wall.start.y
      );
      const offset = Math.min(
        Math.max(hit.t * wallLen - width / 2, 0),
        Math.max(wallLen - width, 0)
      );
      const id = `o-${crypto.randomUUID().slice(0, 8)}`;

      set((state) => ({
        floorPlan: {
          ...state.floorPlan,
          openings: [
            ...(state.floorPlan.openings ?? []),
            { id, wallId: hit.wall.id, offset, width, kind },
          ],
        },
        selection: { kind: "opening", id },
      }));
      touched();
    },

    updateRoom(id, changes) {
      set((state) => ({
        floorPlan: {
          ...state.floorPlan,
          rooms: state.floorPlan.rooms.map((room) =>
            room.id === id ? { ...room, ...changes } : room
          ),
        },
      }));
      touched();
    },

    placePanel(position, system) {
      set((state) => ({
        panel: {
          id: state.panel?.id ?? "panel-1",
          name: state.panel?.name ?? "LP-1",
          position,
          system: system ?? state.panel?.system ?? "1P3W-120/240",
          mainBreakerAmps: state.panel?.mainBreakerAmps ?? 0,
        },
        selection: { kind: "panel" },
        tool: "select",
      }));
      touched();
    },

    placeLoad(item, position) {
      const { panel } = get();
      const system = panel?.system ?? "1P3W-120/240";
      const snapped = snapLoadPosition(position);
      const room = roomAt(snapped.point);
      const id = `l-${crypto.randomUUID().slice(0, 8)}`;

      set((state) => ({
        loads: [
          ...state.loads,
          {
            id,
            name: item.label,
            type: item.type,
            va: item.va,
            voltage: defaultVoltage(system, item),
            continuous: item.continuous,
            position: snapped.point,
            roomId: room?.id,
            lumens: item.type === "lighting" ? item.va * 100 : undefined,
            gfci: item.type === "outlet" ? false : undefined,
          },
        ],
        selection: { kind: "load", id },
      }));
      touched();
    },

    updateLoad(id, changes) {
      set((state) => ({
        loads: state.loads.map((load) =>
          load.id === id ? { ...load, ...changes } : load
        ),
      }));
      touched();
    },

    setLoadPosition(id, position) {
      const room = roomAt(position);

      set((state) => ({
        loads: state.loads.map((load) =>
          load.id === id ? { ...load, position, roomId: room?.id } : load
        ),
      }));
      touched();
    },

    moveItem(selection, position) {
      if (!selection) return;
      if (selection.kind === "load") {
        const snapped = snapLoadPosition(position);
        const room = roomAt(snapped.point);

        set((state) => ({
          snappedToWall: snapped.snapped,
          loads: state.loads.map((load) =>
            load.id === selection.id
              ? { ...load, position: snapped.point, roomId: room?.id }
              : load
          ),
        }));
      } else if (selection.kind === "panel") {
        set((state) => ({
          panel: state.panel ? { ...state.panel, position } : state.panel,
        }));
      } else {
        return;
      }
      touched();
    },

    deleteSelection() {
      const { selection } = get();

      if (!selection) return;
      if (selection.kind === "load") {
        set((state) => ({
          loads: state.loads.filter((load) => load.id !== selection.id),
          selection: null,
        }));
      } else if (selection.kind === "wall") {
        set((state) => ({
          floorPlan: {
            ...state.floorPlan,
            walls: state.floorPlan.walls.filter(
              (wall) => wall.id !== selection.id
            ),
            openings: (state.floorPlan.openings ?? []).filter(
              (opening) => opening.wallId !== selection.id
            ),
          },
          selection: null,
        }));
      } else if (selection.kind === "opening") {
        set((state) => ({
          floorPlan: {
            ...state.floorPlan,
            openings: (state.floorPlan.openings ?? []).filter(
              (opening) => opening.id !== selection.id
            ),
          },
          selection: null,
        }));
      } else if (selection.kind === "room") {
        set((state) => ({
          floorPlan: {
            ...state.floorPlan,
            rooms: state.floorPlan.rooms.filter(
              (room) => room.id !== selection.id
            ),
          },
          loads: state.loads.map((load) =>
            load.roomId === selection.id
              ? { ...load, roomId: undefined }
              : load
          ),
          selection: null,
        }));
      } else if (selection.kind === "panel") {
        set({ panel: null, selection: null });
      }
      touched();
    },
  };
});

export { COMPONENT_LIBRARY };
export { nearestWall };
