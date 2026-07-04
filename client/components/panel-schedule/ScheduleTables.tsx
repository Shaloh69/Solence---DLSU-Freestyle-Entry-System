"use client";

/**
 * Panel schedule + conductor schedule + panel directory, driven entirely
 * by the backend engine output.
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
import { circuitColor, PHASE_COLORS, VIOLATION_COLOR } from "@/lib/circuit-colors";

export function PanelScheduleTable() {
  const result = useEditorStore((state) => state.result);

  if (!result) {
    return (
      <p className="text-sm text-default-500 p-4">
        Run a check to generate the panel schedule.
      </p>
    );
  }

  const { schedule } = result;
  const circuitIds = result.circuits.map((circuit) => circuit.id);
  const violating = new Set(
    result.violations.map((violation) => violation.circuitId)
  );

  return (
    <div className="p-3 space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Chip size="sm" variant="flat">
          System: {schedule.system}
        </Chip>
        <Chip size="sm" variant="flat">
          Connected: {schedule.totalConnectedVa.toLocaleString()} VA
        </Chip>
        <Chip size="sm" variant="flat">
          Demand: {schedule.totalDemandVa.toLocaleString()} VA
        </Chip>
        <Chip size="sm" variant="flat">
          Feeder: {schedule.feederAmps} A
        </Chip>
        <Chip size="sm" color="primary" variant="flat">
          Main breaker: {schedule.mainBreakerAmps} A
        </Chip>
        {(["A", "B", "C"] as const).map((phase) =>
          schedule.phaseVa[phase] > 0 ? (
            <Chip
              key={phase}
              size="sm"
              variant="dot"
              style={{ borderColor: PHASE_COLORS[phase] }}
            >
              Phase {phase}: {schedule.phaseVa[phase].toLocaleString()} VA
            </Chip>
          ) : null
        )}
      </div>

      <Table
        removeWrapper
        aria-label="Panel schedule"
        classNames={{ th: "text-xs", td: "text-xs py-1.5 font-mono" }}
      >
        <TableHeader>
          <TableColumn>CKT</TableColumn>
          <TableColumn>DESCRIPTION</TableColumn>
          <TableColumn>PHASE</TableColumn>
          <TableColumn>CONNECTED (VA)</TableColumn>
          <TableColumn>DEMAND (VA)</TableColumn>
          <TableColumn>BREAKER</TableColumn>
          <TableColumn>CONDUCTOR</TableColumn>
          <TableColumn>RUN (m)</TableColumn>
        </TableHeader>
        <TableBody>
          {schedule.rows.map((row) => {
            const color = violating.has(row.circuitId)
              ? VIOLATION_COLOR
              : circuitColor(row.circuitId, circuitIds);

            return (
              <TableRow key={row.circuitId}>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {row.circuitNumber}
                  </span>
                </TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell>{row.phase}</TableCell>
                <TableCell>{row.connectedVa.toLocaleString()}</TableCell>
                <TableCell>{row.demandVa.toLocaleString()}</TableCell>
                <TableCell>{row.breakerAmps} A</TableCell>
                <TableCell>{row.conductor}</TableCell>
                <TableCell>{row.wireLengthM}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <p className="text-xs text-default-400">
        ⚠ PEC-VERIFY: breaker/conductor figures use placeholder code tables
        pending verification by a licensed electrical engineer.
      </p>
    </div>
  );
}

export function PanelDirectoryList() {
  const result = useEditorStore((state) => state.result);

  if (!result) {
    return (
      <p className="text-sm text-default-500 p-4">
        Run a check to generate the panel directory.
      </p>
    );
  }

  return (
    <div className="p-3">
      <ol className="space-y-1.5">
        {result.directory.map((entry) => (
          <li key={entry.circuitId} className="text-sm flex gap-3">
            <span className="font-mono text-default-400 w-8 shrink-0">
              {entry.circuitNumber}.
            </span>
            {entry.description}
          </li>
        ))}
      </ol>
    </div>
  );
}
