"use client";

/**
 * Right-hand inspector: plan settings when nothing is selected,
 * otherwise the properties of the selected room/load/panel/wall.
 */
import { useRef } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Trash2, ImagePlus, Square, Lightbulb } from "lucide-react";
import { toast } from "sonner";

import { RoomType, VoltageSystem } from "@/lib/api-client";
import { useEditorStore } from "@/lib/editor-store";
import { pdfFirstPageToDataUrl } from "@/lib/pdf-import";

const ROOM_TYPES: RoomType[] = [
  "bathroom",
  "kitchen",
  "garage",
  "laundry",
  "bedroom",
  "living",
  "dining",
  "office",
  "hallway",
  "outdoor",
  "other",
];

const SYSTEMS: { key: VoltageSystem; label: string }[] = [
  { key: "1P2W-120", label: "Single-phase 2-wire (120 V)" },
  { key: "1P3W-120/240", label: "Single-phase 3-wire (120/240 V)" },
  { key: "3P4W-230/400", label: "Three-phase 4-wire (230/400 V)" },
];

export default function InspectorPanel() {
  const store = useEditorStore();
  const { floorPlan, panel, loads, selection } = store;
  const fileInput = useRef<HTMLInputElement>(null);

  function uploadImage(file: File) {
    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      toast.info("Converting PDF page 1 to a trace image…");
      void pdfFirstPageToDataUrl(file)
        .then((dataUrl) => store.setBackgroundImage(dataUrl))
        .catch((error: unknown) =>
          toast.error(
            `PDF import failed: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );

      return;
    }
    const reader = new FileReader();

    reader.onload = () => store.setBackgroundImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  const selectedRoom =
    selection?.kind === "room"
      ? floorPlan.rooms.find((room) => room.id === selection.id)
      : undefined;
  const selectedLoad =
    selection?.kind === "load"
      ? loads.find((load) => load.id === selection.id)
      : undefined;
  const selectedFurniture =
    selection?.kind === "furniture"
      ? (floorPlan.furniture ?? []).find((piece) => piece.id === selection.id)
      : undefined;

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-[11px] font-medium uppercase tracking-widest text-default-500">
        {selection ? "Selection" : "Plan Settings"}
      </h3>

      {!selection && (
        <>
          <div className="flex gap-2">
            <Input
              label="Width (m)"
              min={2}
              size="sm"
              type="number"
              value={String(floorPlan.width)}
              onValueChange={(value) => {
                const width = parseFloat(value);

                if (width > 0) store.setPlanSize(width, floorPlan.height);
              }}
            />
            <Input
              label="Height (m)"
              min={2}
              size="sm"
              type="number"
              value={String(floorPlan.height)}
              onValueChange={(value) => {
                const height = parseFloat(value);

                if (height > 0) store.setPlanSize(floorPlan.width, height);
              }}
            />
          </div>

          <Input
            description="Photometric input (§9.1a) — fixture counts change with mounting height"
            label="Ceiling height (m)"
            max={10}
            min={2}
            size="sm"
            step={0.1}
            type="number"
            value={String(floorPlan.ceilingHeight ?? 2.7)}
            onValueChange={(value) => {
              const ceilingHeight = parseFloat(value);

              if (ceilingHeight >= 2 && ceilingHeight <= 10) {
                store.setCeilingHeight(ceilingHeight);
              }
            }}
          />

          <div className="flex gap-2">
            <Button
              size="sm"
              startContent={<Square size={14} />}
              variant="flat"
              onPress={() => store.addPerimeter()}
            >
              Add perimeter walls
            </Button>
          </div>

          <div>
            <input
              ref={fileInput}
              accept="image/*,application/pdf"
              className="hidden"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) uploadImage(file);
                event.target.value = "";
              }}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                startContent={<ImagePlus size={14} />}
                variant="flat"
                onPress={() => fileInput.current?.click()}
              >
                {floorPlan.backgroundImage ? "Replace" : "Upload"} plan
                image/PDF
              </Button>
              {floorPlan.backgroundImage && (
                <Button
                  color="danger"
                  size="sm"
                  variant="flat"
                  onPress={() => store.setBackgroundImage(undefined)}
                >
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-default-400 mt-1">
              Shown as a trace layer — draw walls over it.
            </p>
          </div>

          <Select
            description={
              panel
                ? undefined
                : "Place the panel first (Panel tool), then pick its system."
            }
            isDisabled={!panel}
            label="Panel system"
            selectedKeys={panel ? [panel.system] : ["1P3W-120/240"]}
            size="sm"
            onSelectionChange={(keys) => {
              const system = [...keys][0] as VoltageSystem;

              if (panel) store.placePanel(panel.position, system);
            }}
          >
            {SYSTEMS.map((system) => (
              <SelectItem key={system.key}>{system.label}</SelectItem>
            ))}
          </Select>
        </>
      )}

      {selection?.kind === "wall" && (
        <div className="space-y-2">
          <p className="text-xs text-default-500">
            Wall segment (deleting it also removes its doors/windows)
          </p>
          <Button
            color="danger"
            size="sm"
            startContent={<Trash2 size={14} />}
            variant="flat"
            onPress={() => store.deleteSelection()}
          >
            Delete wall
          </Button>
        </div>
      )}

      {selection?.kind === "opening" && (
        <div className="space-y-2">
          <p className="text-xs text-default-500">
            {floorPlan.openings?.find((o) => o.id === selection.id)?.kind ===
            "window"
              ? "Window — blocked for wire routing, cut visually in 3D"
              : "Door — wiring may route through the doorway"}
          </p>
          <Button
            color="danger"
            size="sm"
            startContent={<Trash2 size={14} />}
            variant="flat"
            onPress={() => store.deleteSelection()}
          >
            Delete opening
          </Button>
        </div>
      )}

      {selection?.kind === "panel" && panel && (
        <div className="space-y-3">
          <Input
            label="Panel name"
            size="sm"
            value={panel.name}
            onValueChange={(name) =>
              useEditorStore.setState((state) => ({
                panel: state.panel ? { ...state.panel, name } : state.panel,
              }))
            }
          />
          <Select
            label="System"
            selectedKeys={[panel.system]}
            size="sm"
            onSelectionChange={(keys) => {
              const system = [...keys][0] as VoltageSystem;

              store.placePanel(panel.position, system);
            }}
          >
            {SYSTEMS.map((system) => (
              <SelectItem key={system.key}>{system.label}</SelectItem>
            ))}
          </Select>
          {/* Exact coordinate input (CAD precision, brief §4.1) */}
          <div className="flex gap-2">
            <Input
              classNames={{ input: "font-mono" }}
              label="X (m)"
              size="sm"
              step={0.05}
              type="number"
              value={String(panel.position.x)}
              onValueChange={(value) => {
                const x = parseFloat(value);

                if (Number.isFinite(x)) {
                  store.placePanel({ ...panel.position, x });
                }
              }}
            />
            <Input
              classNames={{ input: "font-mono" }}
              label="Y (m)"
              size="sm"
              step={0.05}
              type="number"
              value={String(panel.position.y)}
              onValueChange={(value) => {
                const y = parseFloat(value);

                if (Number.isFinite(y)) {
                  store.placePanel({ ...panel.position, y });
                }
              }}
            />
          </div>
          <p className="text-xs text-default-400">
            Main breaker is auto-sized from feeder demand.
          </p>
          <Button
            color="danger"
            size="sm"
            startContent={<Trash2 size={14} />}
            variant="flat"
            onPress={() => store.deleteSelection()}
          >
            Remove panel
          </Button>
        </div>
      )}

      {selectedRoom && (
        <div className="space-y-3">
          <Input
            label="Room name"
            size="sm"
            value={selectedRoom.name}
            onValueChange={(name) =>
              store.updateRoom(selectedRoom.id, { name })
            }
          />
          <Select
            label="Room type"
            selectedKeys={[selectedRoom.type]}
            size="sm"
            onSelectionChange={(keys) =>
              store.updateRoom(selectedRoom.id, {
                type: [...keys][0] as RoomType,
              })
            }
          >
            {ROOM_TYPES.map((type) => (
              <SelectItem key={type}>{type}</SelectItem>
            ))}
          </Select>
          <Button
            color="secondary"
            isLoading={store.isLightingBusy}
            size="sm"
            startContent={<Lightbulb size={14} />}
            variant="flat"
            onPress={() => void store.autoLighting([selectedRoom.id])}
          >
            Auto-light this room
          </Button>
          <Button
            color="danger"
            size="sm"
            startContent={<Trash2 size={14} />}
            variant="flat"
            onPress={() => store.deleteSelection()}
          >
            Delete room
          </Button>
        </div>
      )}

      {selectedLoad && (
        <div className="space-y-3">
          <Input
            label="Name"
            size="sm"
            value={selectedLoad.name}
            onValueChange={(name) =>
              store.updateLoad(selectedLoad.id, { name })
            }
          />
          {/* Exact coordinate input (CAD precision, brief §4.1) */}
          <div className="flex gap-2">
            <Input
              classNames={{ input: "font-mono" }}
              label="X (m)"
              size="sm"
              step={0.05}
              type="number"
              value={String(selectedLoad.position.x)}
              onValueChange={(value) => {
                const x = parseFloat(value);

                if (Number.isFinite(x)) {
                  store.setLoadPosition(selectedLoad.id, {
                    ...selectedLoad.position,
                    x,
                  });
                }
              }}
            />
            <Input
              classNames={{ input: "font-mono" }}
              label="Y (m)"
              size="sm"
              step={0.05}
              type="number"
              value={String(selectedLoad.position.y)}
              onValueChange={(value) => {
                const y = parseFloat(value);

                if (Number.isFinite(y)) {
                  store.setLoadPosition(selectedLoad.id, {
                    ...selectedLoad.position,
                    y,
                  });
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <Input
              label="Rating (VA)"
              min={1}
              size="sm"
              type="number"
              value={String(selectedLoad.va)}
              onValueChange={(value) => {
                const va = parseFloat(value);

                if (va > 0) store.updateLoad(selectedLoad.id, { va });
              }}
            />
            <Input
              label="Voltage (V)"
              min={1}
              size="sm"
              type="number"
              value={String(selectedLoad.voltage)}
              onValueChange={(value) => {
                const voltage = parseFloat(value);

                if (voltage > 0) store.updateLoad(selectedLoad.id, { voltage });
              }}
            />
          </div>
          <Switch
            isSelected={selectedLoad.continuous}
            size="sm"
            onValueChange={(continuous) =>
              store.updateLoad(selectedLoad.id, { continuous })
            }
          >
            <span className="text-xs">Continuous load (3+ hours)</span>
          </Switch>
          {selectedLoad.type === "outlet" && (
            <Switch
              isSelected={selectedLoad.gfci ?? false}
              size="sm"
              onValueChange={(gfci) =>
                store.updateLoad(selectedLoad.id, { gfci })
              }
            >
              <span className="text-xs">
                GFCI-protected (required in wet areas)
              </span>
            </Switch>
          )}
          {selectedLoad.type === "lighting" && (
            <>
              <Input
                label="Luminous flux (lm)"
                min={1}
                placeholder="estimated from VA if empty"
                size="sm"
                type="number"
                value={String(selectedLoad.lumens ?? "")}
                onValueChange={(value) => {
                  const lumens = parseFloat(value);

                  store.updateLoad(selectedLoad.id, {
                    lumens: lumens > 0 ? lumens : undefined,
                  });
                }}
              />
              <Input
                description="Warm 2700–3000 K (bed/living) · cool 4000–5000 K (task) — §9.1a room mood"
                label="Color temperature (K)"
                max={10000}
                min={1000}
                size="sm"
                type="number"
                value={String(selectedLoad.cct ?? "")}
                onValueChange={(value) => {
                  const cct = parseFloat(value);

                  store.updateLoad(selectedLoad.id, {
                    cct: cct >= 1000 && cct <= 10000 ? cct : undefined,
                  });
                }}
              />
              <Switch
                isSelected={selectedLoad.egress ?? false}
                size="sm"
                onValueChange={(egress) =>
                  store.updateLoad(selectedLoad.id, { egress })
                }
              >
                <span className="text-xs">
                  Egress/emergency fixture (needs a dedicated circuit)
                </span>
              </Switch>
            </>
          )}
          <p className="text-xs text-default-400">
            Type: {selectedLoad.type}
            {selectedLoad.roomId
              ? ` · Room: ${
                  floorPlan.rooms.find(
                    (room) => room.id === selectedLoad.roomId,
                  )?.name ?? selectedLoad.roomId
                }`
              : " · No room"}
          </p>
          <Button
            color="danger"
            size="sm"
            startContent={<Trash2 size={14} />}
            variant="flat"
            onPress={() => store.deleteSelection()}
          >
            Delete load
          </Button>
        </div>
      )}

      {selectedFurniture && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Square className="text-brand-amber" size={16} />
            <span className="text-sm font-medium">Furniture</span>
          </div>
          <p className="text-xs text-default-400">
            {selectedFurniture.label} — {selectedFurniture.width}m ×{" "}
            {selectedFurniture.depth}m footprint. Not part of the electrical
            design.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="X (m)"
              size="sm"
              type="number"
              value={String(selectedFurniture.position.x)}
              onValueChange={(value) => {
                const x = parseFloat(value);

                if (!Number.isNaN(x)) {
                  store.moveItem(selection, {
                    ...selectedFurniture.position,
                    x,
                  });
                }
              }}
            />
            <Input
              label="Y (m)"
              size="sm"
              type="number"
              value={String(selectedFurniture.position.y)}
              onValueChange={(value) => {
                const y = parseFloat(value);

                if (!Number.isNaN(y)) {
                  store.moveItem(selection, {
                    ...selectedFurniture.position,
                    y,
                  });
                }
              }}
            />
          </div>
          <Input
            label="Rotation (degrees)"
            size="sm"
            type="number"
            value={String(
              Math.round((selectedFurniture.rotation * 180) / Math.PI),
            )}
            onValueChange={(value) => {
              const degrees = parseFloat(value);

              if (!Number.isNaN(degrees)) {
                store.rotateFurniture(
                  selectedFurniture.id,
                  (degrees * Math.PI) / 180,
                );
              }
            }}
          />
          <p className="text-xs text-default-400">
            Shortcut: [ / ] rotates the selected piece 15° in the 2D canvas.
          </p>
          <Button
            color="danger"
            size="sm"
            startContent={<Trash2 size={14} />}
            variant="flat"
            onPress={() => store.deleteSelection()}
          >
            Delete furniture
          </Button>
        </div>
      )}
    </div>
  );
}
