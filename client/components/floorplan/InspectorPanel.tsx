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
import { Trash2, ImagePlus, Square } from "lucide-react";

import { RoomType, VoltageSystem } from "@/lib/api-client";
import { useEditorStore } from "@/lib/editor-store";

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
    const reader = new FileReader();

    reader.onload = () =>
      store.setBackgroundImage(reader.result as string);
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

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">
        {selection ? "Selection" : "Plan Settings"}
      </h3>

      {!selection && (
        <>
          <div className="flex gap-2">
            <Input
              type="number"
              size="sm"
              label="Width (m)"
              value={String(floorPlan.width)}
              min={2}
              onValueChange={(value) => {
                const width = parseFloat(value);

                if (width > 0) store.setPlanSize(width, floorPlan.height);
              }}
            />
            <Input
              type="number"
              size="sm"
              label="Height (m)"
              value={String(floorPlan.height)}
              min={2}
              onValueChange={(value) => {
                const height = parseFloat(value);

                if (height > 0) store.setPlanSize(floorPlan.width, height);
              }}
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="flat"
              startContent={<Square size={14} />}
              onPress={() => store.addPerimeter()}
            >
              Add perimeter walls
            </Button>
          </div>

          <div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) uploadImage(file);
                event.target.value = "";
              }}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="flat"
                startContent={<ImagePlus size={14} />}
                onPress={() => fileInput.current?.click()}
              >
                {floorPlan.backgroundImage ? "Replace" : "Upload"} floor plan
                image
              </Button>
              {floorPlan.backgroundImage && (
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
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
            size="sm"
            label="Panel system"
            selectedKeys={panel ? [panel.system] : ["1P3W-120/240"]}
            onSelectionChange={(keys) => {
              const system = [...keys][0] as VoltageSystem;

              if (panel) store.placePanel(panel.position, system);
            }}
            isDisabled={!panel}
            description={
              panel
                ? undefined
                : "Place the panel first (Panel tool), then pick its system."
            }
          >
            {SYSTEMS.map((system) => (
              <SelectItem key={system.key}>{system.label}</SelectItem>
            ))}
          </Select>
        </>
      )}

      {selection?.kind === "wall" && (
        <div className="space-y-2">
          <p className="text-xs text-default-500">Wall segment</p>
          <Button
            size="sm"
            color="danger"
            variant="flat"
            startContent={<Trash2 size={14} />}
            onPress={() => store.deleteSelection()}
          >
            Delete wall
          </Button>
        </div>
      )}

      {selection?.kind === "panel" && panel && (
        <div className="space-y-3">
          <Input
            size="sm"
            label="Panel name"
            value={panel.name}
            onValueChange={(name) =>
              useEditorStore.setState((state) => ({
                panel: state.panel ? { ...state.panel, name } : state.panel,
              }))
            }
          />
          <Select
            size="sm"
            label="System"
            selectedKeys={[panel.system]}
            onSelectionChange={(keys) => {
              const system = [...keys][0] as VoltageSystem;

              store.placePanel(panel.position, system);
            }}
          >
            {SYSTEMS.map((system) => (
              <SelectItem key={system.key}>{system.label}</SelectItem>
            ))}
          </Select>
          <p className="text-xs text-default-400">
            Main breaker is auto-sized from feeder demand.
          </p>
          <Button
            size="sm"
            color="danger"
            variant="flat"
            startContent={<Trash2 size={14} />}
            onPress={() => store.deleteSelection()}
          >
            Remove panel
          </Button>
        </div>
      )}

      {selectedRoom && (
        <div className="space-y-3">
          <Input
            size="sm"
            label="Room name"
            value={selectedRoom.name}
            onValueChange={(name) =>
              store.updateRoom(selectedRoom.id, { name })
            }
          />
          <Select
            size="sm"
            label="Room type"
            selectedKeys={[selectedRoom.type]}
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
            size="sm"
            color="danger"
            variant="flat"
            startContent={<Trash2 size={14} />}
            onPress={() => store.deleteSelection()}
          >
            Delete room
          </Button>
        </div>
      )}

      {selectedLoad && (
        <div className="space-y-3">
          <Input
            size="sm"
            label="Name"
            value={selectedLoad.name}
            onValueChange={(name) => store.updateLoad(selectedLoad.id, { name })}
          />
          <div className="flex gap-2">
            <Input
              size="sm"
              type="number"
              label="Rating (VA)"
              value={String(selectedLoad.va)}
              min={1}
              onValueChange={(value) => {
                const va = parseFloat(value);

                if (va > 0) store.updateLoad(selectedLoad.id, { va });
              }}
            />
            <Input
              size="sm"
              type="number"
              label="Voltage (V)"
              value={String(selectedLoad.voltage)}
              min={1}
              onValueChange={(value) => {
                const voltage = parseFloat(value);

                if (voltage > 0)
                  store.updateLoad(selectedLoad.id, { voltage });
              }}
            />
          </div>
          <Switch
            size="sm"
            isSelected={selectedLoad.continuous}
            onValueChange={(continuous) =>
              store.updateLoad(selectedLoad.id, { continuous })
            }
          >
            <span className="text-xs">Continuous load (3+ hours)</span>
          </Switch>
          <p className="text-xs text-default-400">
            Type: {selectedLoad.type}
            {selectedLoad.roomId
              ? ` · Room: ${
                  floorPlan.rooms.find(
                    (room) => room.id === selectedLoad.roomId
                  )?.name ?? selectedLoad.roomId
                }`
              : " · No room"}
          </p>
          <Button
            size="sm"
            color="danger"
            variant="flat"
            startContent={<Trash2 size={14} />}
            onPress={() => store.deleteSelection()}
          >
            Delete load
          </Button>
        </div>
      )}
    </div>
  );
}
