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
import { FURNITURE_LIBRARY } from "@/lib/furniture-library";
import { circuitColor, VIOLATION_COLOR } from "@/lib/circuit-colors";

const SNAP = 0.25; // meters
const WALL_STROKE = 0.15;

function snap(value: number): number {
  return Math.round(value / SNAP) * SNAP;
}

function openingGeometry(opening: Opening, wall: Wall) {
  const length = Math.hypot(
    wall.end.x - wall.start.x,
    wall.end.y - wall.start.y,
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
    furnitureItem,
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
    [floorPlan.width, floorPlan.height],
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
    } else if (tool === "furniture" && furnitureItem) {
      store.placeFurniture(furnitureItem, point);
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
    const componentKey = event.dataTransfer.getData(
      "application/x-solence-component",
    );
    const furnitureKey = event.dataTransfer.getData(
      "application/x-solence-furniture",
    );
    const raw = toPlanPoint(event);
    const point = { x: snap(raw.x), y: snap(raw.y) };

    if (componentKey) {
      const item = COMPONENT_LIBRARY.find(
        (candidate) => candidate.key === componentKey,
      );

      if (item) store.placeLoad(item, point);
    } else if (furnitureKey) {
      const item = FURNITURE_LIBRARY.find(
        (candidate) => candidate.key === furnitureKey,
      );

      if (item) store.placeFurniture(item, point);
    }
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
      } else if (
        (event.key === "[" || event.key === "]") &&
        state.selection &&
        state.selection.kind === "furniture"
      ) {
        const furnitureSelection = state.selection;
        const piece = (state.floorPlan.furniture ?? []).find(
          (candidate) => candidate.id === furnitureSelection.id,
        );

        if (piece) {
          const step = Math.PI / 12; // 15 degrees
          const delta = event.key === "]" ? step : -step;

          state.rotateFurniture(piece.id, piece.rotation + delta);
        }
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
      : [],
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
        stroke="currentColor"
        strokeOpacity={0.08}
        strokeWidth={0.02}
        x1={x}
        x2={x}
        y1={0}
        y2={floorPlan.height}
      />,
    );
  }
  for (let y = 0; y <= floorPlan.height; y += 1) {
    gridLines.push(
      <line
        key={`gy${y}`}
        stroke="currentColor"
        strokeOpacity={0.08}
        strokeWidth={0.02}
        x1={0}
        x2={floorPlan.width}
        y1={y}
        y2={y}
      />,
    );
  }

  const visibleLoads = loads.filter((load) =>
    load.type === "lighting" ? layers.lighting : layers.loads,
  );

  return (
    <svg
      ref={svgRef}
      aria-label="Floor plan editor canvas"
      className="w-full h-full bg-content1/40 rounded-lg touch-none select-none"
      role="application"
      viewBox={`0 0 ${floorPlan.width} ${floorPlan.height}`}
      onClick={handleCanvasClick}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onPointerLeave={() => {
        setCursorLocal(null);
        store.setCursor(null);
        setDraggingSelection(false);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={() => setDraggingSelection(false)}
    >
      {floorPlan.backgroundImage && (
        <image
          height={floorPlan.height}
          href={floorPlan.backgroundImage}
          opacity={0.35}
          preserveAspectRatio="xMidYMid meet"
          width={floorPlan.width}
          x={0}
          y={0}
        />
      )}

      {gridLines}

      {/* Lux heatmap layer */}
      {layers.heatmap &&
        result?.luxHeatmap.map((sample, index) => (
          <rect
            key={index}
            fill={luxColor(sample.lux)}
            height={0.5}
            opacity={0.4}
            pointerEvents="none"
            width={0.5}
            x={sample.x - 0.25}
            y={sample.y - 0.25}
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
            (analysis) => analysis.roomId === room.id,
          );

          return (
            <g key={room.id}>
              <polygon
                className="cursor-pointer"
                fill="#14B8A6"
                fillOpacity={selected ? 0.25 : 0.08}
                points={room.boundary.map((p) => `${p.x},${p.y}`).join(" ")}
                stroke="#14B8A6"
                strokeOpacity={0.5}
                strokeWidth={0.03}
                onClick={(event) => {
                  if (tool !== "select") return;
                  event.stopPropagation();
                  store.setSelection({ kind: "room", id: room.id });
                }}
              />
              <text
                fill="currentColor"
                fontSize={0.32}
                opacity={0.7}
                pointerEvents="none"
                textAnchor="middle"
                x={cx}
                y={cy}
              >
                {room.name}
              </text>
              <text
                fill="currentColor"
                fontSize={0.22}
                opacity={0.45}
                pointerEvents="none"
                textAnchor="middle"
                x={cx}
                y={cy + 0.4}
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
              fill="none"
              opacity={0.9}
              pointerEvents="none"
              points={route.points.map((p) => `${p.x},${p.y}`).join(" ")}
              stroke={color}
              strokeDasharray={route.fallback ? "0.2 0.12" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={violating ? 0.09 : 0.06}
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
              className="cursor-pointer"
              stroke={selected ? "#14B8A6" : "currentColor"}
              strokeLinecap="square"
              strokeOpacity={selected ? 1 : 0.85}
              strokeWidth={wall.thickness ?? WALL_STROKE}
              x1={wall.start.x}
              x2={wall.end.x}
              y1={wall.start.y}
              y2={wall.end.y}
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
                stroke="var(--solence-canvas-bg, #ffffff)"
                strokeLinecap="butt"
                strokeWidth={thickness}
                x1={geometry.start.x}
                x2={geometry.end.x}
                y1={geometry.start.y}
                y2={geometry.end.y}
              />
              {opening.kind === "door" ? (
                <>
                  {/* Door leaf + swing arc */}
                  <line
                    stroke={selected ? "#14B8A6" : "currentColor"}
                    strokeWidth={0.04}
                    x1={geometry.start.x}
                    x2={geometry.start.x - geometry.uy * opening.width}
                    y1={geometry.start.y}
                    y2={geometry.start.y + geometry.ux * opening.width}
                  />
                  <path
                    d={`M ${geometry.end.x} ${geometry.end.y} A ${opening.width} ${opening.width} 0 0 1 ${geometry.start.x - geometry.uy * opening.width} ${geometry.start.y + geometry.ux * opening.width}`}
                    fill="none"
                    stroke={selected ? "#14B8A6" : "currentColor"}
                    strokeOpacity={0.5}
                    strokeWidth={0.02}
                  />
                </>
              ) : (
                <>
                  {/* Window: double line across the gap */}
                  <line
                    stroke={selected ? "#14B8A6" : "currentColor"}
                    strokeWidth={0.03}
                    x1={geometry.start.x}
                    x2={geometry.end.x}
                    y1={geometry.start.y}
                    y2={geometry.end.y}
                  />
                  <line
                    stroke={selected ? "#14B8A6" : "currentColor"}
                    strokeWidth={0.03}
                    x1={geometry.start.x - geometry.uy * 0.06}
                    x2={geometry.end.x - geometry.uy * 0.06}
                    y1={geometry.start.y + geometry.ux * 0.06}
                    y2={geometry.end.y + geometry.ux * 0.06}
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
            fill="#404040"
            height={0.7}
            rx={0.05}
            stroke={selection?.kind === "panel" ? "#14B8A6" : "#a3a3a3"}
            strokeWidth={0.05}
            width={0.5}
            x={panel.position.x - 0.25}
            y={panel.position.y - 0.35}
          />
          <text
            fill="#fafafa"
            fontSize={0.24}
            pointerEvents="none"
            textAnchor="middle"
            x={panel.position.x}
            y={panel.position.y + 0.08}
          >
            {panel.name}
          </text>
        </g>
      )}

      {/* Loads (lighting fixtures live on their own layer) */}
      {visibleLoads.map((load) => {
        const selected = selection?.kind === "load" && selection.id === load.id;
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
              fill={fill}
              r={0.22}
              stroke={selected ? "#14B8A6" : "#fafafa"}
              strokeWidth={selected ? 0.08 : 0.04}
            />
            <text
              fill="#fafafa"
              fontSize={0.18}
              pointerEvents="none"
              textAnchor="middle"
              x={load.position.x}
              y={load.position.y + 0.07}
            >
              {LOAD_GLYPH[load.type] ?? "?"}
            </text>
            <text
              fill="currentColor"
              fontSize={0.17}
              opacity={0.6}
              pointerEvents="none"
              textAnchor="middle"
              x={load.position.x}
              y={load.position.y + 0.5}
            >
              {load.va} VA
            </text>
          </g>
        );
      })}

      {/* Furniture (brief §11.1) — spatial context only, its own layer */}
      {layers.furniture &&
        (floorPlan.furniture ?? []).map((piece) => {
          const selected =
            selection?.kind === "furniture" && selection.id === piece.id;

          return (
            <g
              key={piece.id}
              className="cursor-move"
              transform={`rotate(${(piece.rotation * 180) / Math.PI} ${piece.position.x} ${piece.position.y})`}
              onClick={(event) => {
                if (tool !== "select") return;
                event.stopPropagation();
                store.setSelection({ kind: "furniture", id: piece.id });
              }}
              onPointerDown={(event) => {
                if (tool !== "select") return;
                event.stopPropagation();
                store.setSelection({ kind: "furniture", id: piece.id });
                setDraggingSelection(true);
              }}
            >
              <rect
                fill="#d97706"
                fillOpacity={selected ? 0.35 : 0.18}
                height={piece.depth}
                rx={0.04}
                stroke={selected ? "#d97706" : "#a16207"}
                strokeWidth={selected ? 0.05 : 0.025}
                width={piece.width}
                x={piece.position.x - piece.width / 2}
                y={piece.position.y - piece.depth / 2}
              />
              <text
                fill="currentColor"
                fontSize={0.16}
                opacity={0.7}
                pointerEvents="none"
                textAnchor="middle"
                x={piece.position.x}
                y={piece.position.y + 0.06}
              >
                {piece.label}
              </text>
            </g>
          );
        })}

      {/* Draft previews */}
      {draftStart && cursor && tool === "wall" && (
        <line
          pointerEvents="none"
          stroke="#14B8A6"
          strokeLinecap="square"
          strokeOpacity={0.5}
          strokeWidth={WALL_STROKE}
          x1={draftStart.x}
          x2={cursor.x}
          y1={draftStart.y}
          y2={cursor.y}
        />
      )}
      {draftStart && cursor && tool === "room" && (
        <rect
          fill="#14B8A6"
          fillOpacity={0.15}
          height={Math.abs(cursor.y - draftStart.y)}
          pointerEvents="none"
          stroke="#14B8A6"
          strokeOpacity={0.6}
          strokeWidth={0.03}
          width={Math.abs(cursor.x - draftStart.x)}
          x={Math.min(draftStart.x, cursor.x)}
          y={Math.min(draftStart.y, cursor.y)}
        />
      )}
      {cursor && tool !== "select" && (
        <circle
          cx={cursor.x}
          cy={cursor.y}
          fill="#14B8A6"
          opacity={0.7}
          pointerEvents="none"
          r={0.08}
        />
      )}
    </svg>
  );
}
