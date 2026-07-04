"use client";

/**
 * The Solence wiring editor: floor plan drawing + load placement (2D),
 * 3D wiring overlay, live PEC compliance, and panel schedule — all
 * engine math comes from the Express API.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Tabs, Tab } from "@heroui/tabs";
import { Button } from "@heroui/button";
import { ArrowLeft, X } from "lucide-react";

import { useEditorStore } from "@/lib/editor-store";
import { api } from "@/lib/api-client";
import EditorToolbar from "@/components/floorplan/EditorToolbar";
import FloorPlanCanvas from "@/components/floorplan/FloorPlanCanvas";
import InspectorPanel from "@/components/floorplan/InspectorPanel";
import ComponentPalette from "@/components/loads/ComponentPalette";
import WiringOverlay3D from "@/components/wiring-overlay/WiringOverlay3D";
import CompliancePanel from "@/components/compliance/CompliancePanel";
import {
  PanelDirectoryList,
  PanelScheduleTable,
} from "@/components/panel-schedule/ScheduleTables";

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const store = useEditorStore();
  const {
    projectId,
    projectName,
    view,
    isLoading,
    error,
    result,
  } = store;
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (params.id) void store.openProject(params.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function exportPdf() {
    if (!projectId) return;
    setExporting(true);
    try {
      const blob = await api.projects.exportPdf(projectId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `${projectName || "solence"}-permit.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      useEditorStore.setState({
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 text-default-500">
        Loading project…
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 pb-8 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button
          as={Link}
          href="/projects"
          size="sm"
          variant="light"
          startContent={<ArrowLeft size={14} />}
        >
          Projects
        </Button>
        <h1 className="text-lg font-semibold truncate">{projectName}</h1>
        {result && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              result.violations.length > 0
                ? "bg-danger-100 text-danger"
                : "bg-success-100 text-success"
            }`}
          >
            {result.violations.length > 0
              ? `${result.violations.length} violation${result.violations.length === 1 ? "" : "s"}`
              : "PEC checks pass"}
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-danger-50 text-danger text-sm">
          <span>{error}</span>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label="Dismiss error"
            onPress={() => store.clearError()}
          >
            <X size={14} />
          </Button>
        </div>
      )}

      <EditorToolbar exporting={exporting} onExport={() => void exportPdf()} />

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_260px] gap-3">
        <aside className="rounded-lg bg-content1/60 backdrop-blur-md p-3 overflow-y-auto max-h-[600px]">
          <ComponentPalette />
        </aside>

        <main className="h-[600px]">
          {view === "2d" ? <FloorPlanCanvas /> : <WiringOverlay3D />}
        </main>

        <aside className="rounded-lg bg-content1/60 backdrop-blur-md p-3 overflow-y-auto max-h-[600px]">
          <InspectorPanel />
        </aside>
      </div>

      <div className="rounded-lg bg-content1/60 backdrop-blur-md">
        <Tabs
          aria-label="Results"
          variant="underlined"
          classNames={{ panel: "pt-0" }}
        >
          <Tab
            key="compliance"
            title={
              <span>
                Compliance
                {result && result.violations.length > 0 && (
                  <span className="ml-1.5 text-danger">
                    ({result.violations.length})
                  </span>
                )}
              </span>
            }
          >
            <CompliancePanel />
          </Tab>
          <Tab key="schedule" title="Panel Schedule">
            <PanelScheduleTable />
          </Tab>
          <Tab key="directory" title="Panel Directory">
            <PanelDirectoryList />
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}
