"use client";

/**
 * Drag-and-drop component library. Drag an item onto the canvas, or
 * click to arm it and then click the canvas to place.
 */
import {
  AirVent,
  Cog,
  CookingPot,
  Flame,
  Lightbulb,
  Microwave,
  Plug,
  Refrigerator,
  WashingMachine,
} from "lucide-react";

import { COMPONENT_LIBRARY, LibraryItem } from "@/lib/component-library";
import { useEditorStore } from "@/lib/editor-store";

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  lightbulb: Lightbulb,
  plug: Plug,
  refrigerator: Refrigerator,
  microwave: Microwave,
  "washing-machine": WashingMachine,
  "air-vent": AirVent,
  flame: Flame,
  cog: Cog,
  "cooking-pot": CookingPot,
};

export default function ComponentPalette() {
  const libraryItem = useEditorStore((state) => state.libraryItem);
  const setLibraryItem = useEditorStore((state) => state.setLibraryItem);

  function toggle(item: LibraryItem) {
    setLibraryItem(libraryItem?.key === item.key ? null : item);
  }

  return (
    <div>
      <h3 className="font-mono text-[11px] font-medium uppercase tracking-widest text-default-500 mb-2">Component Library</h3>
      <p className="text-xs text-default-500 mb-3">
        Drag onto the plan, or click then click the plan.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {COMPONENT_LIBRARY.map((item) => {
          const Icon = ICONS[item.icon] ?? Plug;
          const armed = libraryItem?.key === item.key;

          return (
            <button
              key={item.key}
              type="button"
              draggable
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
                armed
                  ? "border-brand-teal bg-brand-teal/20"
                  : "border-default-200 hover:bg-default-100"
              }`}
              title={`${item.label} — ${item.va} VA${item.continuous ? ", continuous" : ""}`}
              onClick={() => toggle(item)}
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  "application/x-solence-component",
                  item.key
                );
                event.dataTransfer.effectAllowed = "copy";
              }}
            >
              <Icon size={18} />
              <span className="text-center leading-tight">{item.label}</span>
              <span className="text-default-400">{item.va} VA</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
