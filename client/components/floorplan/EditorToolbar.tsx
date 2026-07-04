"use client";

/**
 * Editor toolbar: drawing tools, 2D/3D view toggle, auto-check switch,
 * manual run button, and export.
 */
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
} from "lucide-react";

import { Tool, useEditorStore } from "@/lib/editor-store";

const TOOLS: { key: Tool; label: string; icon: React.ReactNode }[] = [
  { key: "select", label: "Select / move (V)", icon: <MousePointer2 size={16} /> },
  { key: "wall", label: "Draw wall — two clicks (W)", icon: <PenLine size={16} /> },
  { key: "room", label: "Draw room — two corners (R)", icon: <Square size={16} /> },
  { key: "panel", label: "Place panel (P)", icon: <PanelTop size={16} /> },
  { key: "door", label: "Place door on a wall (D)", icon: <DoorOpen size={16} /> },
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
    dirty,
    result,
  } = store;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ButtonGroup size="sm">
        {TOOLS.map((entry) => (
          <Tooltip key={entry.key} content={entry.label} delay={300}>
            <Button
              isIconOnly
              variant={tool === entry.key ? "solid" : "flat"}
              color={tool === entry.key ? "primary" : "default"}
              aria-label={entry.label}
              onPress={() => store.setTool(entry.key)}
            >
              {entry.icon}
            </Button>
          </Tooltip>
        ))}
      </ButtonGroup>

      <ButtonGroup size="sm">
        <Button
          variant={view === "2d" ? "solid" : "flat"}
          color={view === "2d" ? "primary" : "default"}
          startContent={<LayoutGrid size={14} />}
          onPress={() => store.setView("2d")}
        >
          2D Plan
        </Button>
        <Button
          variant={view === "3d" ? "solid" : "flat"}
          color={view === "3d" ? "primary" : "default"}
          startContent={<Boxes size={14} />}
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
          size="sm"
          variant="flat"
          color="secondary"
          isLoading={isLightingBusy}
          startContent={!isLightingBusy && <Lightbulb size={14} />}
          onPress={() => void store.autoLighting()}
        >
          Auto-light
        </Button>
      </Tooltip>

      <div className="flex items-center gap-2 ml-auto">
        <Switch
          size="sm"
          isSelected={autoCheck}
          onValueChange={store.setAutoCheck}
        >
          <span className="text-xs">Live check</span>
        </Switch>
        <Button
          size="sm"
          color="primary"
          isLoading={isSimulating}
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
            size="sm"
            variant="flat"
            isDisabled={!result}
            isLoading={exporting}
            startContent={!exporting && <FileDown size={14} />}
            onPress={onExport}
          >
            Export PDF
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
