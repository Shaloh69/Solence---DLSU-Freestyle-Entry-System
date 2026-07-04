/**
 * Auto-generated panel directory: a human-readable circuit description
 * per breaker position, derived from the loads and rooms on each circuit.
 */
import { Circuit, ElectricalLoad, Room } from "../types.js";

export interface PanelDirectoryEntry {
  circuitNumber: number;
  circuitId: string;
  description: string;
}

export function generatePanelDirectory(
  circuits: Circuit[],
  loads: ElectricalLoad[],
  rooms: Room[]
): PanelDirectoryEntry[] {
  const loadById = new Map(loads.map((load) => [load.id, load]));
  const roomById = new Map(rooms.map((room) => [room.id, room]));

  return circuits.map((circuit, index) => {
    const circuitLoads = circuit.loadIds
      .map((id) => loadById.get(id))
      .filter((load): load is ElectricalLoad => Boolean(load));

    const roomNames = [
      ...new Set(
        circuitLoads
          .map((load) => (load.roomId ? roomById.get(load.roomId)?.name : null))
          .filter((name): name is string => Boolean(name))
      ),
    ];

    const loadTypes = [...new Set(circuitLoads.map((load) => load.type))];
    const typeLabel =
      loadTypes.length === 1 ? labelForType(loadTypes[0]) : "Mixed loads";
    const where = roomNames.length > 0 ? ` — ${roomNames.join(", ")}` : "";

    return {
      circuitNumber: index + 1,
      circuitId: circuit.id,
      description: `${typeLabel}${where} (${circuitLoads.length} load${circuitLoads.length === 1 ? "" : "s"}, ${circuit.connectedVa} VA)`,
    };
  });
}

function labelForType(type: ElectricalLoad["type"]): string {
  switch (type) {
    case "lighting":
      return "Lighting";
    case "outlet":
      return "Convenience outlets";
    case "appliance":
      return "Appliance";
    case "laundry":
      return "Laundry";
    case "hvac":
      return "HVAC";
    case "motor":
      return "Motor";
    case "equipment":
      return "Equipment";
  }
}
