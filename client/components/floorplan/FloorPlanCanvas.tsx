"use client";

/**
 * 2D floor plan editor canvas (SVG) with CAD conventions: snap-to-grid
 * and snap-to-wall, toggleable layers (walls/rooms/loads/lighting/
 * wiring/heatmap/violations), door & window tools, keyboard shortcuts
 * (V/W/R/P/D/N, Del, Esc), and live cursor reporting to the status bar.
 * Routed wiring is color-coded by circuit; violations render red.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Opening, Point, Wall } from "@/lib/api-client";
import { useEditorStore } from "@/lib/editor-store";
import { COMPONENT_LIBRARY } from "@/lib/component-library";
import { circuitColor, VIOLATION_COLOR } from "@/lib/circuit-colors";

const SNAP = 0.25; // meters
const WALL_STROKE = 0.15;

function snap(value: number): number {
  return Math.round(value / SNAP) * SNAP;
}

function openingGeometry(opening: Opening, wall: Wall) {
  const length = Math.hypot(
    wall.end.x - wall.start.x,
    wall.end.y - wall.start.y
  );

  if (length === 0) return null;
  const ux = (wall.end.x - wall.start.x) / length;
  const uy = (wall.end.y - wall.start.y) / length;
  const start = {
    x: wall.start.x + ux * opening.offset,
    y: wall.start.y + uy * opening.offset,
  };
  const end = {
    x: wall.start.x + ux * (opening.offset + opening.width),
    y: wall.start.y + uy * (opening.offset + opening.width),
  };

  return { start, end, ux, uy };
}

const LOAD_GLYPH: Record<string, string> = {
  lighting: "L",
  outlet: "O",
  appliance: "A",
  laundry: "W",
  hvac: "AC",
  motor: "M",
  equipment: "E",
};

/** Lux -> heatmap color: blue (dim) through green to orange (bright). */
function luxColor(lux: number): string {
  const hue = Math.max(0, 220 - Math.min(lux, 500) * 0.44);

  return `hsl(${hue}, 80%, 50%)`;
}

export default function FloorPlanCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const store = useEditorStore();
  const {
    floorPlan,
    panel,
    loads,
    result,
    tool,
    libraryItem,
    selection,
    layers,
  } = store;

  const [draftStart, setDraftStart] = useState<Point | null>(null);
  const [cursor, setCursorLocal] = useState<Point | null>(null);
  const [draggingSelection, setDraggingSelection] = useState(false);

  useEffect(() => {
    setDraftStart(null);
  }, [tool]);

  const toPlanPoint = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const svg = svgRef.current;

      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * floorPlan.width;
      const y = ((event.clientY - rect.top) / rect.height) * floorPlan.height;

      return {
        x: Math.min(floorPlan.width, Math.max(0, x)),
        y: Math.min(floorPlan.height, Math.max(0, y)),
      };
    },
    [floorPlan.width, floorPlan.height]
  );

  function handleCanvasClick(event: React.MouseEvent) {
    const raw = toPlanPoint(event);
    const point = { x: snap(raw.x), y: snap(raw.y) };

    if (tool === "wall") {
      if (!draftStart) setDraftStart(point);
      else {
        store.addWall(draftStart, point);
        setDraftStart(null);
      }
    } else if (tool === "room") {
      if (!draftStart) setDraftStart(point);
      else {
        store.addRoom(draftStart, point);
        setDraftStart(null);
      }
    } else if (tool === "panel") {
      store.placePanel(point);
    } else if (tool === "door" || tool === "window") {
      store.addOpening(tool, raw); // raw: openings need the exact wall hit
    } else if (tool === "load" && libraryItem) {
      store.placeLoad(libraryItem, point);
    } else if (tool === "select") {
      store.setSelection(null);
    }
  }

  function handlePointerMove(event: React.PointerEvent) {
    const raw = toPlanPoint(event);
    const point = { x: snap(raw.x), y: snap(raw.y) };

    setCursorLocal(point);
    store.setCursor(point);
    if (draggingSelection && selection) {
      store.moveItem(selection, point);
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    const key = event.dataTransfer.getData("application/x-solence-component");
    const item = COMPONENT_LIBRARY.find((candidate) => candidate.key === key);

    if (!item) return;
    const raw = toPlanPoint(event);

    store.placeLoad(item, { x: snap(raw.x), y: snap(raw.y) });
  }

  // CAD keyboard shortcuts.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;

      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const state = useEditorStore.getState();

      const toolByKey: Record<string, Parameters<typeof state.setTool>[0]> = {
        v: "select",
        w: "wall",
        r: "room",
        p: "panel",
        d: "door",
        n: "window",
      };
      const key = event.key.toLowerCase();

      if (toolByKey[key] && !event.ctrlKey && !event.metaKey) {
        state.setTool(toolByKey[key]);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        state.deleteSelection();
      } else if (event.key === "Escape") {
        setDraftStart(null);
        state.setTool("select");
      }
    }
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const circuitIds = result?.circuits.map((circuit) => circuit.id) ?? [];
  const violatingCircuits = new Set(
    layers.violations
      ? (result?.violations
          .map((violation) => violation.circuitId)
          .filter(Boolean) ?? [])
      : []
  );
  const circuitByLoad = new Map<string, string>();

  for (const circuit of result?.circuits ?? []) {
    for (const loadId of circuit.loadIds) circuitByLoad.set(loadId, circuit.id);
  }
  const wallById = new Map(floorPlan.walls.map((wall) => [wall.id, wall]));

  const gridLines: React.ReactNode[] = [];

  for (let x = 0; x <= floorPlan.width; x += 1) {
    gridLines.push(
      <line
        key={`gx${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={floorPlan.height}
        stroke="currentColor"
        strokeOpacity={0.08}
        strokeWidth={0.02}
      />
    );
  }
  for (let y = 0; y <= floorPlan.height; y += 1) {
    gridLines.push(
      <line
        key={`gy${y}`}
        x1={0}
        y1={y}
        x2={floorPlan.width}
        y2={y}
        stroke="currentColor"
        strokeOpacity={0.08}
        strokeWidth={0.02}
      />
    );
  }

  const visibleLoads = loads.filter((load) =>
    load.type === "lighting" ? layers.lighting : layers.loads
  );

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-content1/40 rounded-lg touch-none select-none"
      viewBox={`0 0 ${floorPlan.width} ${floorPlan.height}`}
      role="application"
      aria-label="Floor plan editor canvas"
      onClick={handleCanvasClick}
      onPointerMove={handlePointerMove}
      onPointerUp={() => setDraggingSelection(false)}
      onPointerLeave={() => {
        setCursorLocal(null);
        store.setCursor(null);
        setDraggingSelection(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      {floorPlan.backgroundImage && (
        <image
          href={floorPlan.backgroundImage}
          x={0}
          y={0}
          width={floorPlan.width}
          height={floorPlan.height}
          opacity={0.35}
          preserveAspectRatio="xMidYMid meet"
        />
      )}

      {gridLines}

      {/* Lux heatmap layer */}
      {layers.heatmap &&
        result?.luxHeatmap.map((sample, index) => (
          <rect
            key={index}
            x={sample.x - 0.25}
            y={sample.y - 0.25}
            width={0.5}
            height={0.5}
            fill={luxColor(sample.lux)}
            opacity={0.4}
            pointerEvents="none"
          />
        ))}

      {/* Rooms */}
      {layers.rooms &&
        floorPlan.rooms.map((room) => {
          const selected =
            selection?.kind === "room" && selection.id === room.id;
          const cx =
            room.boundary.reduce((sum, p) => sum + p.x, 0) /
            room.boundary.length;
          const cy =
            room.boundary.reduce((sum, p) => sum + p.y, 0) /
            room.boundary.length;
          const lighting = result?.roomLighting.find(
            (analysis) => analysis.roomId === room.id
          );

          return (
            <g key={room.id}>
              <polygon
                points={room.boundary.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="#8b5cf6"
                fillOpacity={selected ? 0.25 : 0.08}
                stroke="#8b5cf6"
                strokeOpacity={0.5}
                strokeWidth={0.03}
                className="cursor-pointer"
                onClick={(event) => {
                  if (tool !== "select") return;
                  event.stopPropagation();
                  store.setSelection({ kind: "room", id: room.id });
                }}
              />
              <text
                x={cx}
                y={cy}
                fontSize={0.32}
                textAnchor="middle"
                fill="currentColor"
                opacity={0.7}
                pointerEvents="none"
              >
                {room.name}
              </text>
              <text
                x={cx}
                y={cy + 0.4}
                fontSize={0.22}
                textAnchor="middle"
                fill="currentColor"
                opacity={0.45}
                pointerEvents="none"
              >
                {room.type}
                {lighting && lighting.fixtureCount > 0
                  ? ` · ~${lighting.averageLux} lx`
                  : ""}
              </text>
            </g>
          );
        })}

      {/* Routed wiring */}
      {layers.wiring &&
        result?.routes.map((route) => {
          const violating = violatingCircuits.has(route.circuitId);
          const color = violating
            ? VIOLATION_COLOR
            : circuitColor(route.circuitId, circuitIds);

          return (
            <polyline
              key={route.loadId}
              points={route.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={color}
              strokeWidth={violating ? 0.09 : 0.06}
              strokeDasharray={route.fallback ? "0.2 0.12" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.9}
              pointerEvents="none"
            />
          );
        })}

      {/* Walls */}
      {layers.walls &&
        floorPlan.walls.map((wall) => {
          const selected =
            selection?.kind === "wall" && selection.id === wall.id;

          return (
            <line
              key={wall.id}
              x1={wall.start.x}
              y1={wall.start.y}
              x2={wall.end.x}
              y2={wall.end.y}
              stroke={selected ? "#8b5cf6" : "currentColor"}
              strokeOpacity={selected ? 1 : 0.85}
              strokeWidth={wall.thickness ?? WALL_STROKE}
              strokeLinecap="square"
              className="cursor-pointer"
              onClick={(event) => {
                if (tool !== "select") return;
                event.stopPropagation();
                store.setSelection({ kind: "wall", id: wall.id });
              }}
            />
          );
        })}

      {/* Openings (doors/windows) */}
      {layers.walls &&
        (floorPlan.openings ?? []).map((opening) => {
          const wall = wallById.get(opening.wallId);

          if (!wall) return null;
          const geometry = openingGeometry(opening, wall);

          if (!geometry) return null;
          const selected =
            selection?.kind === "opening" && selection.id === opening.id;
          const thickness = (wall.thickness ?? WALL_STROKE) + 0.04;

          return (
            <g
              key={opening.id}
              className="cursor-pointer"
              onClick={(event) => {
                if (tool !== "select") return;
                event.stopPropagation();
                store.setSelection({ kind: "opening", id: opening.id });
              }}
            >
              {/* Cut the wall visually */}
              <line
                x1={geometry.start.x}
                y1={geometry.start.y}
                x2={geometry.end.x}
                y2={geometry.end.y}
                stroke="var(--solence-canvas-bg, #ffffff)"
                strokeWidth={thickness}
                strokeLinecap="butt"
              />
              {opening.kind === "door" ? (
                <>
                  {/* Door leaf + swing arc */}
                  <line
                    x1={geometry.start.x}
                    y1={geometry.start.y}
                    x2={geometry.start.x - geometry.uy * opening.width}
                    y2={geometry.start.y + geometry.ux * opening.width}
                    stroke={selected ? "#8b5cf6" : "currentColor"}
                    strokeWidth={0.04}
                  />
                  <path
                    d={`M ${geometry.end.x} ${geometry.end.y} A ${opening.width} ${opening.width} 0 0 1 ${geometry.start.x - geometry.uy * opening.width} ${geometry.start.y + geometry.ux * opening.width}`}
                    fill="none"
                    stroke={selected ? "#8b5cf6" : "currentColor"}
                    strokeOpacity={0.5}
                    strokeWidth={0.02}
                  />
                </>
              ) : (
                <>
                  {/* Window: double line across the gap */}
                  <line
                    x1={geometry.start.x}
                    y1={geometry.start.y}
                    x2={geometry.end.x}
                    y2={geometry.end.y}
                    stroke={selected ? "#8b5cf6" : "currentColor"}
                    strokeWidth={0.03}
                  />
                  <line
                    x1={geometry.start.x - geometry.uy * 0.06}
                    y1={geometry.start.y + geometry.ux * 0.06}
                    x2={geometry.end.x - geometry.uy * 0.06}
                    y2={geometry.end.y + geometry.ux * 0.06}
                    stroke={selected ? "#8b5cf6" : "currentColor"}
                    strokeWidth={0.03}
                  />
                </>
              )}
            </g>
          );
        })}

      {/* Panel */}
      {panel && (
        <g
          className="cursor-move"
          onClick={(event) => {
            if (tool !== "select") return;
            event.stopPropagation();
            store.setSelection({ kind: "panel" });
          }}
          onPointerDown={(event) => {
            if (tool !== "select") return;
            event.stopPropagation();
            store.setSelection({ kind: "panel" });
            setDraggingSelection(true);
          }}
        >
          <rect
            x={panel.position.x - 0.25}
            y={panel.position.y - 0.35}
            width={0.5}
            height={0.7}
            fill="#404040"
            stroke={selection?.kind === "panel" ? "#8b5cf6" : "#a3a3a3"}
            strokeWidth={0.05}
            rx={0.05}
          />
          <text
            x={panel.position.x}
            y={panel.position.y + 0.08}
            fontSize={0.24}
            textAnchor="middle"
            fill="#fafafa"
            pointerEvents="none"
          >
            {panel.name}
          </text>
        </g>
      )}

      {/* Loads (lighting fixtures live on their own layer) */}
      {visibleLoads.map((load) => {
        const selected =
          selection?.kind === "load" && selection.id === load.id;
        const circuitId = circuitByLoad.get(load.id);
        const violating = violatingCircuits.has(circuitId);
        const fill = violating
          ? VIOLATION_COLOR
          : circuitId
            ? circuitColor(circuitId, circuitIds)
            : "#737373";

        return (
          <g
            key={load.id}
            className="cursor-move"
            onClick={(event) => {
              if (tool !== "select") return;
              event.stopPropagation();
              store.setSelection({ kind: "load", id: load.id });
            }}
            onPointerDown={(event) => {
              if (tool !== "select") return;
              event.stopPropagation();
              store.setSelection({ kind: "load", id: load.id });
              setDraggingSelection(true);
            }}
          >
            <circle
              cx={load.position.x}
              cy={load.position.y}
              r={0.22}
              fill={fill}
              stroke={selected ? "#8b5cf6" : "#fafafa"}
              strokeWidth={selected ? 0.08 : 0.04}
            />
            <text
              x={load.position.x}
              y={load.position.y + 0.07}
              fontSize={0.18}
              textAnchor="middle"
              fill="#fafafa"
              pointerEvents="none"
            >
              {LOAD_GLYPH[load.type] ?? "?"}
            </text>
            <text
              x={load.position.x}
              y={load.position.y + 0.5}
              fontSize={0.17}
              textAnchor="middle"
              fill="currentColor"
              opacity={0.6}
              pointerEvents="none"
            >
              {load.va} VA
            </text>
          </g>
        );
      })}

      {/* Draft previews */}
      {draftStart && cursor && tool === "wall" && (
        <line
          x1={draftStart.x}
          y1={draftStart.y}
          x2={cursor.x}
          y2={cursor.y}
          stroke="#8b5cf6"
          strokeWidth={WALL_STROKE}
          strokeOpacity={0.5}
          strokeLinecap="square"
          pointerEvents="none"
        />
      )}
      {draftStart && cursor && tool === "room" && (
        <rect
          x={Math.min(draftStart.x, cursor.x)}
          y={Math.min(draftStart.y, cursor.y)}
          width={Math.abs(cursor.x - draftStart.x)}
          height={Math.abs(cursor.y - draftStart.y)}
          fill="#8b5cf6"
          fillOpacity={0.15}
          stroke="#8b5cf6"
          strokeOpacity={0.6}
          strokeWidth={0.03}
          pointerEvents="none"
        />
      )}
      {cursor && tool !== "select" && (
        <circle
          cx={cursor.x}
          cy={cursor.y}
          r={0.08}
          fill="#8b5cf6"
          opacity={0.7}
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
