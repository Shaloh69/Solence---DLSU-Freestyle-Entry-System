"use client";

/**
 * Editor toolbar: drawing tools, 2D/3D view toggle, auto-check switch,
 * manual run button, and export.
 */
import { useRef } from "react";
import { Button, ButtonGroup } from "@heroui/button";
import { Switch } from "@heroui/switch";
import { Tooltip } from "@heroui/tooltip";
import {
  MousePointer2,
  PenLine,
  Square,
  PanelTop,
  Play,
  Boxes,
  LayoutGrid,
  FileDown,
  DoorOpen,
  RectangleHorizontal,
  Lightbulb,
  ScanEye,
} from "lucide-react";

import { Tool, useEditorStore } from "@/lib/editor-store";

const TOOLS: { key: Tool; label: string; icon: React.ReactNode }[] = [
  {
    key: "select",
    label: "Select / move (V)",
    icon: <MousePointer2 size={16} />,
  },
  {
    key: "wall",
    label: "Draw wall — two clicks (W)",
    icon: <PenLine size={16} />,
  },
  {
    key: "room",
    label: "Draw room — two corners (R)",
    icon: <Square size={16} />,
  },
  { key: "panel", label: "Place panel (P)", icon: <PanelTop size={16} /> },
  {
    key: "door",
    label: "Place door on a wall (D)",
    icon: <DoorOpen size={16} />,
  },
  {
    key: "window",
    label: "Place window on a wall (N)",
    icon: <RectangleHorizontal size={16} />,
  },
];

export default function EditorToolbar({
  onExport,
  exporting,
}: {
  onExport: () => void;
  exporting: boolean;
}) {
  const store = useEditorStore();
  const {
    tool,
    view,
    autoCheck,
    isSimulating,
    isLightingBusy,
    isRecognizing,
    dirty,
    result,
  } = store;
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ButtonGroup size="sm">
        {TOOLS.map((entry) => (
          <Tooltip key={entry.key} content={entry.label} delay={300}>
            <Button
              isIconOnly
              aria-label={entry.label}
              color={tool === entry.key ? "primary" : "default"}
              variant={tool === entry.key ? "solid" : "flat"}
              onPress={() => store.setTool(entry.key)}
            >
              {entry.icon}
            </Button>
          </Tooltip>
        ))}
      </ButtonGroup>

      <ButtonGroup size="sm">
        <Button
          color={view === "2d" ? "primary" : "default"}
          startContent={<LayoutGrid size={14} />}
          variant={view === "2d" ? "solid" : "flat"}
          onPress={() => store.setView("2d")}
        >
          2D Plan
        </Button>
        <Button
          color={view === "3d" ? "primary" : "default"}
          startContent={<Boxes size={14} />}
          variant={view === "3d" ? "solid" : "flat"}
          onPress={() => store.setView("3d")}
        >
          3D Wiring
        </Button>
      </ButtonGroup>

      <Tooltip
        content="Auto-generate lighting fixtures for every room (lumen method) — results stay fully editable"
        delay={300}
      >
        <Button
          color="secondary"
          isLoading={isLightingBusy}
          size="sm"
          startContent={!isLightingBusy && <Lightbulb size={14} />}
          variant="flat"
          onPress={() => void store.autoLighting()}
        >
          Auto-light
        </Button>
      </Tooltip>

      <Tooltip
        content="Upload a floor plan image — AI recognizes walls, doors/windows, and rooms (brief §7)"
        delay={300}
      >
        <Button
          color="secondary"
          isLoading={isRecognizing}
          size="sm"
          startContent={!isRecognizing && <ScanEye size={14} />}
          variant="flat"
          onPress={() => fileInputRef.current?.click()}
        >
          AI Recognize
        </Button>
      </Tooltip>
      <input
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];

          event.target.value = "";
          if (file) void store.recognizeFloorPlan(file);
        }}
      />

      <div className="flex items-center gap-2 ml-auto">
        <Switch
          isSelected={autoCheck}
          size="sm"
          onValueChange={store.setAutoCheck}
        >
          <span className="text-xs">Live check</span>
        </Switch>
        <Button
          color="primary"
          isLoading={isSimulating}
          size="sm"
          startContent={!isSimulating && <Play size={14} />}
          onPress={() => void store.saveAndSimulate()}
        >
          {dirty ? "Save & Check" : "Re-check"}
        </Button>
        <Tooltip
          content={
            result
              ? "Download the permit-ready PDF"
              : "Run a check first, then export"
          }
          delay={300}
        >
          <Button
            isDisabled={!result}
            isLoading={exporting}
            size="sm"
            startContent={!exporting && <FileDown size={14} />}
            variant="flat"
            onPress={onExport}
          >
            Export PDF
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
