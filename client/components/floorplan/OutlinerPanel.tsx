"use client";

/**
 * Outliner/hierarchy panel (brief §4.5) — the third leg of the CAD
 * three-panel convention (Outliner | Viewport | Properties): every
 * object in the plan as a clickable list. Clicking selects the object
 * on the canvas (same selection model the inspector edits); circuits
 * are read-only rollups with their color swatch.
 */
import { PanelTop, DoorOpen, RectangleHorizontal } from "lucide-react";
import clsx from "clsx";

import { useEditorStore, Selection } from "@/lib/editor-store";
import { circuitColor, VIOLATION_COLOR } from "@/lib/circuit-colors";

function Row({
  active,
  depth = 0,
  label,
  meta,
  onClick,
  icon,
}: {
  active?: boolean;
  depth?: number;
  label: string;
  meta?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      className={clsx(
        "w-full flex items-center gap-2 px-2 py-1 rounded-chip text-left text-xs transition-colors",
        active
          ? "bg-brand-teal/15 text-brand-teal-dark dark:text-brand-teal"
          : "hover:bg-content2 text-default-600",
        !onClick && "cursor-default"
      )}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
      type="button"
      onClick={onClick}
    >
      {icon}
      <span className="truncate">{label}</span>
      {meta && (
        <span className="ml-auto font-mono text-[10px] text-default-400 shrink-0">
          {meta}
        </span>
      )}
    </button>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-widest text-default-400 px-2 pt-3 pb-1">
      {children}
    </p>
  );
}

export default function OutlinerPanel() {
  const floorPlan = useEditorStore((state) => state.floorPlan);
  const panel = useEditorStore((state) => state.panel);
  const loads = useEditorStore((state) => state.loads);
  const result = useEditorStore((state) => state.result);
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);

  const openings = floorPlan.openings ?? [];
  const circuitIds = result?.circuits.map((circuit) => circuit.id) ?? [];
  const violating = new Set(
    result?.violations.map((violation) => violation.circuitId) ?? []
  );

  const isActive = (candidate: Selection) =>
    JSON.stringify(candidate) === JSON.stringify(selection);

  return (
    <div>
      <h3 className="font-mono text-[11px] font-medium uppercase tracking-widest text-default-500 mb-1">
        Outliner
      </h3>

      {panel && (
        <>
          <GroupLabel>Panel</GroupLabel>
          <Row
            active={isActive({ kind: "panel" })}
            icon={<PanelTop size={12} />}
            label={panel.name}
            meta={panel.system}
            onClick={() => setSelection({ kind: "panel" })}
          />
        </>
      )}

      <GroupLabel>Walls · {floorPlan.walls.length}</GroupLabel>
      {floorPlan.walls.map((wall, index) => (
        <div key={wall.id}>
          <Row
            active={isActive({ kind: "wall", id: wall.id })}
            label={`Wall ${index + 1}`}
            meta={`${Math.hypot(
              wall.end.x - wall.start.x,
              wall.end.y - wall.start.y
            ).toFixed(1)} m`}
            onClick={() => setSelection({ kind: "wall", id: wall.id })}
          />
          {openings
            .filter((opening) => opening.wallId === wall.id)
            .map((opening) => (
              <Row
                key={opening.id}
                active={isActive({ kind: "opening", id: opening.id })}
                depth={1}
                icon={
                  opening.kind === "door" ? (
                    <DoorOpen size={11} />
                  ) : (
                    <RectangleHorizontal size={11} />
                  )
                }
                label={opening.kind}
                meta={`${opening.width.toFixed(1)} m`}
                onClick={() =>
                  setSelection({ kind: "opening", id: opening.id })
                }
              />
            ))}
        </div>
      ))}

      <GroupLabel>Rooms · {floorPlan.rooms.length}</GroupLabel>
      {floorPlan.rooms.map((room) => (
        <Row
          key={room.id}
          active={isActive({ kind: "room", id: room.id })}
          label={room.name}
          meta={room.type}
          onClick={() => setSelection({ kind: "room", id: room.id })}
        />
      ))}

      <GroupLabel>Loads · {loads.length}</GroupLabel>
      {loads.map((load) => (
        <Row
          key={load.id}
          active={isActive({ kind: "load", id: load.id })}
          label={load.name}
          meta={`${load.va} VA`}
          onClick={() => setSelection({ kind: "load", id: load.id })}
        />
      ))}

      {result && result.circuits.length > 0 && (
        <>
          <GroupLabel>Circuits · {result.circuits.length}</GroupLabel>
          {result.circuits.map((circuit) => (
            <Row
              key={circuit.id}
              icon={
                <span
                  className="inline-block w-2.5 h-2.5 rounded-chip shrink-0"
                  style={{
                    backgroundColor: violating.has(circuit.id)
                      ? VIOLATION_COLOR
                      : circuitColor(circuit.id, circuitIds),
                  }}
                />
              }
              label={circuit.description}
              meta={`${circuit.breakerAmps} A`}
            />
          ))}
        </>
      )}
    </div>
  );
}
