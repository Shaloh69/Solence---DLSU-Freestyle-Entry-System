"use client";

/**
 * 2D floor plan editor canvas (SVG). Draw walls and rooms, place the
 * panel and loads (click or drag-and-drop from the palette), select and
 * move items, and see routed wiring color-coded by circuit with
 * violations in red.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Point } from "@/lib/api-client";
import { useEditorStore } from "@/lib/editor-store";
import { COMPONENT_LIBRARY } from "@/lib/component-library";
import { circuitColor, VIOLATION_COLOR } from "@/lib/circuit-colors";

const SNAP = 0.25; // meters
const WALL_STROKE = 0.15;

function snap(value: number): number {
  return Math.round(value / SNAP) * SNAP;
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
  } = store;

  const [draftStart, setDraftStart] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [draggingSelection, setDraggingSelection] = useState(false);

  // Reset any in-progress drawing when the tool changes.
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
      if (!draftStart) {
        setDraftStart(point);
      } else {
        store.addWall(draftStart, point);
        setDraftStart(null);
      }
    } else if (tool === "room") {
      if (!draftStart) {
        setDraftStart(point);
      } else {
        store.addRoom(draftStart, point);
        setDraftStart(null);
      }
    } else if (tool === "panel") {
      store.placePanel(point);
    } else if (tool === "load" && libraryItem) {
      store.placeLoad(libraryItem, point);
    } else if (tool === "select") {
      store.setSelection(null);
    }
  }

  function handlePointerMove(event: React.PointerEvent) {
    const raw = toPlanPoint(event);

    setCursor({ x: snap(raw.x), y: snap(raw.y) });
    if (draggingSelection && selection) {
      store.moveItem(selection, { x: snap(raw.x), y: snap(raw.y) });
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

  // Delete key removes the selection (except while typing in inputs).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;

      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (event.key === "Delete" || event.key === "Backspace") {
        useEditorStore.getState().deleteSelection();
      }
      if (event.key === "Escape") {
        setDraftStart(null);
        useEditorStore.getState().setTool("select");
      }
    }
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const circuitIds = result?.circuits.map((circuit) => circuit.id) ?? [];
  const violatingCircuits = new Set(
    result?.violations
      .map((violation) => violation.circuitId)
      .filter(Boolean) ?? []
  );
  const circuitByLoad = new Map<string, string>();

  for (const circuit of result?.circuits ?? []) {
    for (const loadId of circuit.loadIds) circuitByLoad.set(loadId, circuit.id);
  }

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
        setCursor(null);
        setDraggingSelection(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Trace-layer image */}
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

      {/* Rooms */}
      {floorPlan.rooms.map((room) => {
        const selected =
          selection?.kind === "room" && selection.id === room.id;
        const cx =
          room.boundary.reduce((sum, p) => sum + p.x, 0) /
          room.boundary.length;
        const cy =
          room.boundary.reduce((sum, p) => sum + p.y, 0) /
          room.boundary.length;

        return (
          <g key={room.id}>
            <polygon
              points={room.boundary.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={selected ? "#8b5cf6" : "#8b5cf6"}
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
            </text>
          </g>
        );
      })}

      {/* Routed wiring (under walls so walls stay crisp) */}
      {result?.routes.map((route) => {
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
      {floorPlan.walls.map((wall) => {
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

      {/* Loads */}
      {loads.map((load) => {
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
