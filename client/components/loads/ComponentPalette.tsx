"use client";

/**
 * Drag-and-drop component library. Drag an item onto the canvas, or
 * click to arm it and then click the canvas to place.
 */
import {
  AirVent,
  Archive,
  Armchair,
  BedDouble,
  BedSingle,
  Cog,
  CookingPot,
  DoorClosed,
  Flame,
  Lightbulb,
  Microwave,
  Plug,
  RectangleHorizontal,
  Refrigerator,
  Sofa,
  Square,
  WashingMachine,
} from "lucide-react";

import { COMPONENT_LIBRARY, LibraryItem } from "@/lib/component-library";
import { FURNITURE_LIBRARY, FurnitureItem } from "@/lib/furniture-library";
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

const FURNITURE_ICONS: Record<
  string,
  React.ComponentType<{ size?: number }>
> = {
  square: Square,
  armchair: Armchair,
  sofa: Sofa,
  "bed-single": BedSingle,
  "bed-double": BedDouble,
  "door-closed": DoorClosed,
  "rectangle-horizontal": RectangleHorizontal,
  archive: Archive,
};

export default function ComponentPalette() {
  const libraryItem = useEditorStore((state) => state.libraryItem);
  const setLibraryItem = useEditorStore((state) => state.setLibraryItem);
  const furnitureItem = useEditorStore((state) => state.furnitureItem);
  const setFurnitureItem = useEditorStore((state) => state.setFurnitureItem);

  function toggle(item: LibraryItem) {
    setLibraryItem(libraryItem?.key === item.key ? null : item);
  }

  function toggleFurniture(item: FurnitureItem) {
    setFurnitureItem(furnitureItem?.key === item.key ? null : item);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-widest text-default-500 mb-2">
          Component Library
        </h3>
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
                draggable
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
                  armed
                    ? "border-brand-teal bg-brand-teal/20"
                    : "border-default-200 hover:bg-default-100"
                }`}
                title={`${item.label} — ${item.va} VA${item.continuous ? ", continuous" : ""}`}
                type="button"
                onClick={() => toggle(item)}
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    "application/x-solence-component",
                    item.key,
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

      {/* Furniture (brief §11.1) — a separate category: no current draw,
          no load-calc/PEC involvement, purely spatial/visual context. */}
      <div>
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-widest text-default-500 mb-2">
          Furniture
        </h3>
        <p className="text-xs text-default-500 mb-3">
          Spatial context only — not part of the electrical design.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {FURNITURE_LIBRARY.map((item) => {
            const Icon = FURNITURE_ICONS[item.icon] ?? Square;
            const armed = furnitureItem?.key === item.key;

            return (
              <button
                key={item.key}
                draggable
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
                  armed
                    ? "border-brand-amber bg-brand-amber/20"
                    : "border-default-200 hover:bg-default-100"
                }`}
                title={`${item.label} — ${item.width}m × ${item.depth}m`}
                type="button"
                onClick={() => toggleFurniture(item)}
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    "application/x-solence-furniture",
                    item.key,
                  );
                  event.dataTransfer.effectAllowed = "copy";
                }}
              >
                <Icon size={18} />
                <span className="text-center leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
