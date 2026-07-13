"use client";

/**
 * Live PEC compliance panel: violations from the last simulation run,
 * red-flagged per the deck, with the PEC reference each rule implements.
 */
import { Chip } from "@heroui/chip";
import { CheckCircle2, AlertTriangle, OctagonAlert } from "lucide-react";

import { useEditorStore } from "@/lib/editor-store";

export default function CompliancePanel() {
  const result = useEditorStore((state) => state.result);
  const isSimulating = useEditorStore((state) => state.isSimulating);

  if (!result) {
    return (
      <p className="text-sm text-default-500 p-4">
        {isSimulating
          ? "Checking…"
          : "Place a panel and at least one load, then run a check."}
      </p>
    );
  }

  const { violations, routingErrors } = result;

  if (violations.length === 0 && routingErrors.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 text-success">
        <CheckCircle2 size={18} />
        <span className="text-sm font-medium">
          No PEC violations found across {result.circuits.length} circuit
          {result.circuits.length === 1 ? "" : "s"}.
        </span>
        <span className="text-xs text-default-400 ml-2">
          Rule values pending licensed-EE verification (PEC-VERIFY).
        </span>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
      {violations.map((violation, index) => (
        <div
          key={`${violation.ruleId}-${violation.circuitId}-${index}`}
          className="flex items-start gap-3 p-3 rounded-lg bg-danger-50/60 border border-danger-200"
        >
          {violation.severity === "error" ? (
            <OctagonAlert className="text-danger shrink-0 mt-0.5" size={16} />
          ) : (
            <AlertTriangle className="text-warning shrink-0 mt-0.5" size={16} />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Chip
                color={violation.severity === "error" ? "danger" : "warning"}
                size="sm"
                variant="flat"
              >
                {violation.ruleId}
              </Chip>
              {violation.circuitId && (
                <span className="text-xs text-default-500">
                  {violation.circuitId}
                </span>
              )}
            </div>
            <p className="text-sm mt-1">{violation.message}</p>
            <p className="text-xs text-default-400 mt-0.5">
              {violation.pecReference}
            </p>
          </div>
        </div>
      ))}

      {routingErrors.map((error) => (
        <div
          key={error.loadId}
          className="flex items-start gap-3 p-3 rounded-lg bg-warning-50/60 border border-warning-200"
        >
          <AlertTriangle className="text-warning shrink-0 mt-0.5" size={16} />
          <div>
            <Chip color="warning" size="sm" variant="flat">
              routing
            </Chip>
            <p className="text-sm mt-1">
              {error.loadId}: {error.message}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
