"use client";

/**
 * CAD-style layers: toggle/isolate walls, rooms, loads, lighting,
 * wiring, the lux heatmap, and violation highlighting — the same mental
 * model as AutoCAD layers.
 */
import { Checkbox } from "@heroui/checkbox";

import { LayerKey, useEditorStore } from "@/lib/editor-store";

const LAYERS: { key: LayerKey; label: string }[] = [
  { key: "walls", label: "Walls & openings" },
  { key: "rooms", label: "Rooms" },
  { key: "loads", label: "Loads" },
  { key: "lighting", label: "Lighting fixtures" },
  { key: "wiring", label: "Wiring" },
  { key: "heatmap", label: "Lux heatmap" },
  { key: "violations", label: "Violation highlights" },
];

export default function LayersPanel() {
  const layers = useEditorStore((state) => state.layers);
  const setLayer = useEditorStore((state) => state.setLayer);

  return (
    <div>
      <h3 className="font-mono text-[11px] font-medium uppercase tracking-widest text-default-500 mb-2">Layers</h3>
      <div className="flex flex-col gap-1.5">
        {LAYERS.map((layer) => (
          <Checkbox
            key={layer.key}
            size="sm"
            isSelected={layers[layer.key]}
            onValueChange={(visible) => setLayer(layer.key, visible)}
          >
            <span className="text-xs">{layer.label}</span>
          </Checkbox>
        ))}
      </div>
    </div>
  );
}
