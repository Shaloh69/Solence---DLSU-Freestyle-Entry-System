"use client";

/**
 * CAD status bar: live cursor coordinates, snap state, active tool, and
 * the keyboard shortcut reference.
 */
import { useEditorStore } from "@/lib/editor-store";

const TOOL_LABELS: Record<string, string> = {
  select: "Select (V)",
  wall: "Wall (W)",
  room: "Room (R)",
  panel: "Panel (P)",
  door: "Door (D)",
  window: "Window (N)",
  load: "Place load",
};

export default function StatusBar() {
  const cursor = useEditorStore((state) => state.cursor);
  const snappedToWall = useEditorStore((state) => state.snappedToWall);
  const tool = useEditorStore((state) => state.tool);
  const dirty = useEditorStore((state) => state.dirty);
  const isSimulating = useEditorStore((state) => state.isSimulating);

  return (
    <div className="flex items-center gap-4 px-3 py-1.5 rounded-lg bg-content1/60 backdrop-blur-md text-xs text-default-500 font-mono">
      <span className="min-w-[130px]">
        {cursor ? `X ${cursor.x.toFixed(2)}  Y ${cursor.y.toFixed(2)} m` : "—"}
      </span>
      <span>Snap 0.25 m{snappedToWall ? " · wall" : ""}</span>
      <span className="text-default-600">{TOOL_LABELS[tool] ?? tool}</span>
      <span className="ml-auto hidden md:inline">
        V select · W wall · R room · P panel · D door · N window · Del delete ·
        Esc cancel
      </span>
      <span className="text-default-600">
        {isSimulating ? "checking…" : dirty ? "unsaved" : "saved"}
      </span>
    </div>
  );
}
