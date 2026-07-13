"use client";

/**
 * The Solence wiring editor. Desktop-first CAD surface with responsive
 * tiers (section 4.4):
 *  - xl+   : palette+layers | canvas | inspector, results tabs below
 *  - lg    : palette+layers | canvas, inspector joins the bottom tabs
 *  - sm-lg : canvas with all panels as bottom tabs (tablet/review)
 *  - <sm   : no drafting canvas — project summary, compliance, export
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Tabs, Tab } from "@heroui/tabs";
import { Button } from "@heroui/button";
import { ArrowLeft, X, FileDown } from "lucide-react";
import { toast } from "sonner";

import { useEditorStore } from "@/lib/editor-store";
import { api } from "@/lib/api-client";
import EditorToolbar from "@/components/floorplan/EditorToolbar";
import FloorPlanCanvas from "@/components/floorplan/FloorPlanCanvas";
import InspectorPanel from "@/components/floorplan/InspectorPanel";
import LayersPanel from "@/components/floorplan/LayersPanel";
import OutlinerPanel from "@/components/floorplan/OutlinerPanel";
import StatusBar from "@/components/floorplan/StatusBar";
import ComponentPalette from "@/components/loads/ComponentPalette";
import WiringOverlay3D from "@/components/wiring-overlay/WiringOverlay3D";
import CompliancePanel from "@/components/compliance/CompliancePanel";
import RoomLightingPanel from "@/components/lighting/RoomLightingPanel";
import {
  PanelDirectoryList,
  PanelScheduleTable,
} from "@/components/panel-schedule/ScheduleTables";

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const store = useEditorStore();
  const { projectId, projectName, view, isLoading, error, result } = store;
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (params.id) void store.openProject(params.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function exportPdf() {
    if (!projectId) return;
    setExporting(true);
    toast.info("Generating permit-ready PDF…");
    try {
      const blob = await api.projects.exportPdf(projectId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `${projectName || "solence"}-permit.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("PDF exported — check your downloads");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      toast.error(`Export failed: ${message}`);
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

  const violationCount = result?.violations.length ?? 0;
  const statusChip = result && (
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${
        violationCount > 0
          ? "bg-danger-100 text-danger"
          : "bg-success-100 text-success"
      }`}
    >
      {violationCount > 0
        ? `${violationCount} finding${violationCount === 1 ? "" : "s"}`
        : "PEC checks pass"}
    </span>
  );

  const resultsTabs = (
    <Tabs
      aria-label="Results"
      classNames={{ panel: "pt-0" }}
      variant="underlined"
    >
      <Tab
        key="compliance"
        title={
          <span>
            Compliance
            {violationCount > 0 && (
              <span className="ml-1.5 text-danger">({violationCount})</span>
            )}
          </span>
        }
      >
        <CompliancePanel />
      </Tab>
      <Tab key="schedule" title="Panel Schedule">
        <PanelScheduleTable />
      </Tab>
      <Tab key="lighting" title="Lighting">
        <RoomLightingPanel />
      </Tab>
      <Tab key="directory" title="Directory">
        <PanelDirectoryList />
      </Tab>
    </Tabs>
  );

  return (
    <div className="w-full max-w-[1500px] mx-auto px-4 pb-8 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button
          as={Link}
          href="/projects"
          size="sm"
          startContent={<ArrowLeft size={14} />}
          variant="light"
        >
          Projects
        </Button>
        <h1 className="text-lg font-semibold truncate">{projectName}</h1>
        {statusChip}
      </div>

      {error && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-danger-50 text-danger text-sm">
          <span>{error}</span>
          <Button
            isIconOnly
            aria-label="Dismiss error"
            size="sm"
            variant="light"
            onPress={() => store.clearError()}
          >
            <X size={14} />
          </Button>
        </div>
      )}

      {/* ---- Mobile (<sm): review-only summary, no drafting canvas ---- */}
      <div className="sm:hidden flex flex-col gap-3">
        <div className="rounded-lg bg-content1/60 backdrop-blur-md p-4 text-sm">
          <p className="font-medium mb-1">Project status</p>
          <p className="text-default-500">
            {result
              ? `${result.circuits.length} circuits · main breaker ${result.schedule.mainBreakerAmps} A · ${violationCount} finding${violationCount === 1 ? "" : "s"}`
              : "Not simulated yet — open this project on a larger screen to draft."}
          </p>
          <Button
            className="mt-3"
            isDisabled={!result}
            isLoading={exporting}
            size="sm"
            startContent={!exporting && <FileDown size={14} />}
            variant="flat"
            onPress={() => void exportPdf()}
          >
            Export PDF
          </Button>
        </div>
        <div className="rounded-lg bg-content1/60 backdrop-blur-md">
          {resultsTabs}
        </div>
      </div>

      {/* ---- Tablet and up: the drafting surface ---- */}
      <div className="hidden sm:flex flex-col gap-3">
        <EditorToolbar
          exporting={exporting}
          onExport={() => void exportPdf()}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_270px] gap-3">
          {/* Left: palette + layers (lg and up) */}
          <aside className="hidden lg:block rounded-lg bg-content1/60 backdrop-blur-md p-3 overflow-y-auto max-h-[600px] space-y-5">
            <ComponentPalette />
            <LayersPanel />
            <OutlinerPanel />
          </aside>

          <main className="h-[480px] lg:h-[600px]">
            {view === "2d" ? <FloorPlanCanvas /> : <WiringOverlay3D />}
          </main>

          {/* Right: inspector (xl and up) */}
          <aside className="hidden xl:block rounded-lg bg-content1/60 backdrop-blur-md p-3 overflow-y-auto max-h-[600px]">
            <InspectorPanel />
          </aside>
        </div>

        <StatusBar />

        {/* Panels that didn't fit beside the canvas collapse into tabs. */}
        <div className="rounded-lg bg-content1/60 backdrop-blur-md xl:hidden">
          <Tabs
            aria-label="Editor panels"
            classNames={{ panel: "p-3" }}
            variant="underlined"
          >
            <Tab key="inspector" title="Inspector">
              <InspectorPanel />
            </Tab>
            <Tab key="library" className="lg:hidden" title="Library">
              <ComponentPalette />
            </Tab>
            <Tab key="layers" className="lg:hidden" title="Layers">
              <LayersPanel />
            </Tab>
            <Tab key="outliner" className="lg:hidden" title="Outliner">
              <OutlinerPanel />
            </Tab>
          </Tabs>
        </div>

        <div className="rounded-lg bg-content1/60 backdrop-blur-md">
          {resultsTabs}
        </div>
      </div>
    </div>
  );
}
