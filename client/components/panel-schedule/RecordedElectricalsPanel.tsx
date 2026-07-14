"use client";

/**
 * Recorded Electricals (brief §2.5) — the engineer's working reference
 * while designing: every circuit's calculated load, breaker, conductor,
 * voltage drop, and live compliance status, sortable/filterable,
 * distinct from the permit-formatted panel schedule (ScheduleTables.tsx)
 * even though both read the same underlying SimulationResult — this view
 * exists to be looked at while iterating, the PDF is the deliverable.
 *
 * Clicking a row expands a per-circuit drill-down: which loads are on
 * it, the connected-vs-continuous demand basis, and any PEC findings
 * for that circuit specifically.
 */
import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from "lucide-react";

import { useEditorStore } from "@/lib/editor-store";
import { circuitColor, VIOLATION_COLOR } from "@/lib/circuit-colors";
import { Violation } from "@/lib/api-client";

type SortKey =
  | "circuitNumber"
  | "connectedVa"
  | "breakerAmps"
  | "voltageDropPercent"
  | "status";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "circuitNumber", label: "CKT" },
  { key: "connectedVa", label: "Load (VA)" },
  { key: "breakerAmps", label: "Breaker" },
  { key: "voltageDropPercent", label: "V-Drop %" },
  { key: "status", label: "Status" },
];

export default function RecordedElectricalsPanel() {
  const result = useEditorStore((state) => state.result);
  const loads = useEditorStore((state) => state.loads);
  const floorPlan = useEditorStore((state) => state.floorPlan);

  const [sortKey, setSortKey] = useState<SortKey>("circuitNumber");
  const [sortDesc, setSortDesc] = useState(false);
  const [findingsOnly, setFindingsOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const circuitNumberById = useMemo(() => {
    const map = new Map<string, number>();

    for (const entry of result?.directory ?? []) {
      map.set(entry.circuitId, entry.circuitNumber);
    }

    return map;
  }, [result]);

  const violationsByCircuit = useMemo(() => {
    const map = new Map<string, Violation[]>();

    for (const violation of result?.violations ?? []) {
      if (!violation.circuitId) continue;
      const list = map.get(violation.circuitId) ?? [];

      list.push(violation);
      map.set(violation.circuitId, list);
    }

    return map;
  }, [result]);

  const rows = useMemo(() => {
    if (!result) return [];
    const circuitIds = result.circuits.map((circuit) => circuit.id);

    let list = result.circuits.map((circuit) => ({
      circuit,
      circuitNumber: circuitNumberById.get(circuit.id) ?? 0,
      findings: violationsByCircuit.get(circuit.id) ?? [],
      color: violationsByCircuit.has(circuit.id)
        ? VIOLATION_COLOR
        : circuitColor(circuit.id, circuitIds),
    }));

    if (findingsOnly) list = list.filter((row) => row.findings.length > 0);

    const dir = sortDesc ? -1 : 1;

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "circuitNumber":
          return dir * (a.circuitNumber - b.circuitNumber);
        case "connectedVa":
          return dir * (a.circuit.connectedVa - b.circuit.connectedVa);
        case "breakerAmps":
          return dir * (a.circuit.breakerAmps - b.circuit.breakerAmps);
        case "voltageDropPercent":
          return (
            dir * (a.circuit.voltageDropPercent - b.circuit.voltageDropPercent)
          );
        case "status":
          return dir * (a.findings.length - b.findings.length);
        default:
          return 0;
      }
    });

    return list;
  }, [
    result,
    circuitNumberById,
    violationsByCircuit,
    findingsOnly,
    sortKey,
    sortDesc,
  ]);

  if (!result) {
    return (
      <p className="text-sm text-default-500 p-4">
        Run a check to populate the Recorded Electricals log.
      </p>
    );
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDesc((desc) => !desc);
    else {
      setSortKey(key);
      setSortDesc(false);
    }
  }

  function sortIcon(key: SortKey) {
    if (key !== sortKey) return null;

    return sortDesc ? <ArrowDown size={11} /> : <ArrowUp size={11} />;
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-default-400">
          Click a column to sort · click a row for the calculation trail.
        </p>
        <Button
          color={findingsOnly ? "danger" : "default"}
          size="sm"
          variant={findingsOnly ? "solid" : "flat"}
          onPress={() => setFindingsOnly((v) => !v)}
        >
          {findingsOnly ? "Showing findings only" : "All circuits"}
        </Button>
      </div>

      <Table
        removeWrapper
        aria-label="Recorded electricals"
        classNames={{
          th: "font-mono text-[11px] uppercase tracking-wider",
          td: "text-xs py-1.5 font-mono",
        }}
      >
        <TableHeader>
          {COLUMNS.map((column) => (
            <TableColumn key={column.key}>
              <button
                className="flex items-center gap-1 cursor-pointer select-none"
                type="button"
                onClick={() => toggleSort(column.key)}
              >
                {column.label}
                {sortIcon(column.key)}
              </button>
            </TableColumn>
          ))}
        </TableHeader>
        <TableBody>
          {rows.flatMap(({ circuit, circuitNumber, findings, color }) => {
            const isOpen = expanded === circuit.id;
            const mainRow = (
              <TableRow
                key={circuit.id}
                className="cursor-pointer hover:bg-default-100/60"
                onClick={() => setExpanded(isOpen ? null : circuit.id)}
              >
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    {isOpen ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronRight size={12} />
                    )}
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {circuitNumber || circuit.id}
                  </span>
                </TableCell>
                <TableCell>{circuit.connectedVa.toLocaleString()}</TableCell>
                <TableCell>{circuit.breakerAmps} A</TableCell>
                <TableCell>
                  {(circuit.voltageDropPercent * 100).toFixed(2)}%
                </TableCell>
                <TableCell>
                  {findings.length > 0 ? (
                    <Chip color="danger" size="sm" variant="flat">
                      {findings.length} finding
                      {findings.length === 1 ? "" : "s"}
                    </Chip>
                  ) : (
                    <Chip color="success" size="sm" variant="flat">
                      compliant
                    </Chip>
                  )}
                </TableCell>
              </TableRow>
            );

            if (!isOpen) return [mainRow];

            const circuitLoads = loads.filter((load) =>
              circuit.loadIds.includes(load.id),
            );

            const detailRow = (
              <TableRow key={`${circuit.id}-detail`}>
                <TableCell className="!font-sans" colSpan={COLUMNS.length}>
                  <div className="p-2 space-y-3 bg-content2/40 rounded-lg -m-1">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-wider text-default-500 mb-1">
                        Loads on this circuit
                      </p>
                      <ul className="space-y-0.5">
                        {circuitLoads.map((load) => (
                          <li key={load.id} className="text-xs flex gap-2">
                            <span className="text-default-400 w-16 shrink-0">
                              {load.type}
                            </span>
                            <span className="flex-1">{load.name}</span>
                            <span className="font-mono">{load.va} VA</span>
                            {load.continuous && (
                              <span className="text-default-400">
                                continuous
                              </span>
                            )}
                            {load.roomId && (
                              <span className="text-default-400">
                                {
                                  floorPlan.rooms.find(
                                    (room) => room.id === load.roomId,
                                  )?.name
                                }
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-xs flex gap-4 font-mono">
                      <span>Connected: {circuit.connectedVa} VA</span>
                      <span>Continuous: {circuit.continuousVa} VA</span>
                      <span>Run: {circuit.lengthM.toFixed(1)} m</span>
                      <span>
                        Conductor: {circuit.conductor.awg} AWG (
                        {circuit.conductor.insulation})
                      </span>
                    </div>
                    {findings.length > 0 && (
                      <div>
                        <p className="text-[11px] font-mono uppercase tracking-wider text-danger mb-1">
                          Findings
                        </p>
                        <ul className="space-y-1">
                          {findings.map((violation, index) => (
                            <li key={index} className="text-xs">
                              <span className="text-danger">
                                {violation.ruleId}
                              </span>
                              {" — "}
                              {violation.message}
                              <span className="text-default-400">
                                {" "}
                                ({violation.pecReference})
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );

            return [mainRow, detailRow];
          })}
        </TableBody>
      </Table>

      <p className="text-xs text-default-400">
        ⚠ PEC-VERIFY: breaker/conductor/voltage-drop figures use placeholder
        code tables pending verification by a licensed electrical engineer.
      </p>
    </div>
  );
}
