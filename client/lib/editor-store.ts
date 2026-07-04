/**
 * Zustand store for the wiring editor. Owns the working copy of a
 * project (floor plan, panel, loads) plus editor UI state, and syncs
 * with the Express API. No domain math lives here — sizing, routing,
 * and compliance all come back from POST /simulate.
 */
import { create } from "zustand";
import {
  api,
  ElectricalLoad,
  FloorPlan,
  Panel,
  Point,
  Room,
  RoomType,
  SimulationResult,
  VoltageSystem,
  Wall,
} from "./api-client";
import { COMPONENT_LIBRARY, defaultVoltage, LibraryItem } from "./component-library";

export type Tool = "select" | "wall" | "room" | "panel" | "load";
export type Selection =
  | { kind: "wall"; id: string }
  | { kind: "room"; id: string }
  | { kind: "load"; id: string }
  | { kind: "panel" }
  | null;

const DEFAULT_PLAN_WIDTH = 12;
const DEFAULT_PLAN_HEIGHT = 9;

function emptyFloorPlan(): FloorPlan {
  return {
    width: DEFAULT_PLAN_WIDTH,
    height: DEFAULT_PLAN_HEIGHT,
    walls: [],
    rooms: [],
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

let autoCheckTimer: ReturnType<typeof setTimeout> | null = null;

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
  autoCheck: boolean;
  isLoading: boolean;
  isSimulating: boolean;
  dirty: boolean;
  error: string | null;

  // Lifecycle
  openProject(id: string): Promise<void>;
  saveAndSimulate(): Promise<void>;

  // Editing
  setTool(tool: Tool): void;
  setLibraryItem(item: LibraryItem | null): void;
  setView(view: "2d" | "3d"): void;
  setAutoCheck(on: boolean): void;
  setSelection(selection: Selection): void;
  setPlanSize(width: number, height: number): void;
  setBackgroundImage(dataUrl: string | undefined): void;
  addPerimeter(): void;
  addWall(start: Point, end: Point): void;
  addRoom(a: Point, b: Point): void;
  updateRoom(id: string, changes: Partial<Pick<Room, "name" | "type">>): void;
  placePanel(position: Point, system?: VoltageSystem): void;
  placeLoad(item: LibraryItem, position: Point): void;
  updateLoad(id: string, changes: Partial<ElectricalLoad>): void;
  moveItem(selection: Selection, position: Point): void;
  deleteSelection(): void;
  clearError(): void;
}

export const useEditorStore = create<EditorState>((set, get) => {
  /** Mark dirty and kick the debounced auto check if enabled. */
  function touched() {
    set({ dirty: true });
    if (autoCheckTimer) clearTimeout(autoCheckTimer);
    const { autoCheck, panel, loads } = get();

    if (autoCheck && panel && loads.length > 0) {
      autoCheckTimer = setTimeout(() => {
        void get().saveAndSimulate();
      }, 800);
    }
  }

  function roomAt(position: Point): Room | undefined {
    // Point-in-polygon (ray cast) over drawn rooms.
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
    autoCheck: true,
    isLoading: false,
    isSimulating: false,
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
      } catch (error) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    async saveAndSimulate() {
      const { projectId, floorPlan, panel, loads, isSimulating } = get();

      if (!projectId || isSimulating) return;
      set({ isSimulating: true, error: null });
      try {
        await api.projects.setFloorPlan(projectId, floorPlan);
        if (panel) await api.projects.setPanel(projectId, panel);
        await api.projects.setLoads(projectId, loads);

        if (panel && loads.length > 0) {
          const result = await api.projects.simulate(projectId);

          set({ result, dirty: false, isSimulating: false });
        } else {
          set({ dirty: false, isSimulating: false });
        }
      } catch (error) {
        set({
          isSimulating: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    setTool: (tool) => set({ tool, libraryItem: null, selection: null }),
    setLibraryItem: (item) =>
      set({ libraryItem: item, tool: item ? "load" : "select" }),
    setView: (view) => set({ view }),
    setAutoCheck: (autoCheck) => set({ autoCheck }),
    setSelection: (selection) => set({ selection }),
    clearError: () => set({ error: null }),

    setPlanSize(width, height) {
      set((state) => ({
        floorPlan: { ...state.floorPlan, width, height },
      }));
      touched();
    },

    setBackgroundImage(dataUrl) {
      set((state) => ({
        floorPlan: { ...state.floorPlan, backgroundImage: dataUrl },
      }));
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
      const room = roomAt(position);
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
            position,
            roomId: room?.id,
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

    moveItem(selection, position) {
      if (!selection) return;
      if (selection.kind === "load") {
        const room = roomAt(position);

        set((state) => ({
          loads: state.loads.map((load) =>
            load.id === selection.id
              ? { ...load, position, roomId: room?.id }
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
