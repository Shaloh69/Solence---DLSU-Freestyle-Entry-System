"use client";

/**
 * Per-room photometric results from the backend lighting engine:
 * average lux vs target, fixture count, and lighting VA.
 */
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { Chip } from "@heroui/chip";

import { useEditorStore } from "@/lib/editor-store";

export default function RoomLightingPanel() {
  const result = useEditorStore((state) => state.result);

  if (!result || result.roomLighting.length === 0) {
    return (
      <p className="text-sm text-default-500 p-4">
        Draw rooms and run a check (or use Auto-light) to see photometric
        results.
      </p>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <Table
        removeWrapper
        aria-label="Room lighting analysis"
        classNames={{
          th: "font-mono text-[11px] uppercase tracking-wider",
          td: "text-xs py-1.5 font-mono",
        }}
      >
        <TableHeader>
          <TableColumn>ROOM</TableColumn>
          <TableColumn>FIXTURES</TableColumn>
          <TableColumn>LIGHTING VA</TableColumn>
          <TableColumn>AVG LUX</TableColumn>
          <TableColumn>TARGET</TableColumn>
          <TableColumn>STATUS</TableColumn>
        </TableHeader>
        <TableBody>
          {result.roomLighting.map((analysis) => {
            const ratio =
              analysis.targetLux > 0
                ? analysis.averageLux / analysis.targetLux
                : 0;
            const status =
              analysis.fixtureCount === 0
                ? { label: "No fixtures", color: "warning" as const }
                : ratio < 0.8
                  ? { label: "Under-lit", color: "warning" as const }
                  : ratio > 2.5
                    ? { label: "Over-lit", color: "warning" as const }
                    : { label: "OK", color: "success" as const };

            return (
              <TableRow key={analysis.roomId}>
                <TableCell>{analysis.roomName}</TableCell>
                <TableCell>{analysis.fixtureCount}</TableCell>
                <TableCell>{analysis.totalLightingVa}</TableCell>
                <TableCell>
                  {analysis.averageLux}
                  {analysis.fluxEstimated ? " *" : ""}
                </TableCell>
                <TableCell>{analysis.targetLux}</TableCell>
                <TableCell>
                  <Chip color={status.color} size="sm" variant="flat">
                    {status.label}
                  </Chip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-xs text-default-400">
        * flux estimated from VA. ⚠ LIGHTING-VERIFY: illuminance targets are
        placeholders pending verification against IES/PEC lighting practice.
      </p>
    </div>
  );
}
