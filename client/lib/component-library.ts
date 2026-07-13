/**
 * Electrical component library for drag-and-drop load placement.
 * VA ratings are typical values the user can edit after placing;
 * they are design inputs, not PEC data.
 */
import { LoadType, VoltageSystem } from "./api-client";

export interface LibraryItem {
  key: string;
  label: string;
  type: LoadType;
  va: number;
  continuous: boolean;
  /** Icon name rendered by the palette (lucide-react). */
  icon: string;
  /** Heavy items ride the 240 V legs on a 1P3W system. */
  heavy?: boolean;
}

export const COMPONENT_LIBRARY: LibraryItem[] = [
  {
    key: "led-downlight",
    label: "LED Downlight",
    type: "lighting",
    va: 12,
    continuous: true,
    icon: "lightbulb",
  },
  {
    key: "led-tube",
    label: "LED Tube Light",
    type: "lighting",
    va: 20,
    continuous: true,
    icon: "lightbulb",
  },
  {
    key: "outlet-duplex",
    label: "Duplex Outlet",
    type: "outlet",
    va: 180,
    continuous: false,
    icon: "plug",
  },
  {
    key: "outlet-counter",
    label: "Counter Outlet",
    type: "outlet",
    va: 360,
    continuous: false,
    icon: "plug",
  },
  {
    key: "refrigerator",
    label: "Refrigerator",
    type: "appliance",
    va: 1200,
    continuous: false,
    icon: "refrigerator",
  },
  {
    key: "microwave",
    label: "Microwave",
    type: "appliance",
    va: 1100,
    continuous: false,
    icon: "microwave",
  },
  {
    key: "washing-machine",
    label: "Washing Machine",
    type: "laundry",
    va: 1500,
    continuous: false,
    icon: "washing-machine",
  },
  {
    key: "aircon-window",
    label: "A/C Window Unit",
    type: "hvac",
    va: 1100,
    continuous: true,
    icon: "air-vent",
    heavy: true,
  },
  {
    key: "aircon-split",
    label: "A/C Split Type",
    type: "hvac",
    va: 1800,
    continuous: true,
    icon: "air-vent",
    heavy: true,
  },
  {
    key: "water-heater",
    label: "Water Heater",
    type: "equipment",
    va: 3500,
    continuous: false,
    icon: "flame",
    heavy: true,
  },
  {
    key: "water-pump",
    label: "Water Pump",
    type: "motor",
    va: 750,
    continuous: false,
    icon: "cog",
    heavy: true,
  },
  {
    key: "range",
    label: "Electric Range",
    type: "equipment",
    va: 8000,
    continuous: false,
    icon: "cooking-pot",
    heavy: true,
  },
];

/** Default operating voltage for a library item under a panel system. */
export function defaultVoltage(
  system: VoltageSystem,
  item: LibraryItem,
): number {
  switch (system) {
    case "1P2W-120":
      return 120;
    case "1P3W-120/240":
      return item.heavy ? 240 : 120;
    case "3P4W-230/400":
      return 230;
  }
}
