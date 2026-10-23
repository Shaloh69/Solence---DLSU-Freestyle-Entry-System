/**
 * Zod request schemas — the runtime half of the API contract in
 * docs/api.md. Shapes mirror src/engine/types.ts.
 */
import { z } from "zod";
import { AMBIENT_TEMP_MAX_C, AMBIENT_TEMP_MIN_C } from "./engine/sizing/pec-derating.js";

export const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const wallSchema = z.object({
  id: z.string().min(1),
  start: pointSchema,
  end: pointSchema,
  thickness: z.number().positive().max(2).optional(),
});

export const roomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum([
    "bathroom",
    "kitchen",
    "garage",
    "laundry",
    "bedroom",
    "living",
    "dining",
    "office",
    "hallway",
    "outdoor",
    "other",
  ]),
  boundary: z.array(pointSchema).min(3),
});

export const openingSchema = z.object({
  id: z.string().min(1),
  wallId: z.string().min(1),
  offset: z.number().nonnegative(),
  width: z.number().positive().max(10),
  kind: z.enum(["door", "window"]),
});

export const furnitureSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  meshKey: z.string().min(1),
  position: pointSchema,
  rotation: z.number().finite(),
  width: z.number().positive().max(20),
  depth: z.number().positive().max(20),
  height: z.number().positive().max(10),
});

export const floorPlanSchema = z.object({
  width: z.number().positive().max(1000),
  height: z.number().positive().max(1000),
  ceilingHeight: z.number().min(2).max(10).optional(),
  /** W6: conduit-run ambient, °C (default 35; range = sizing/pec-derating.ts). */
  ambientTempC: z.number().min(AMBIENT_TEMP_MIN_C).max(AMBIENT_TEMP_MAX_C).optional(),
  walls: z.array(wallSchema),
  rooms: z.array(roomSchema),
  openings: z.array(openingSchema).optional(),
  furniture: z.array(furnitureSchema).optional(),
  backgroundImage: z
    .string()
    .regex(/^data:image\//, "backgroundImage must be an image data URL")
    .max(8_000_000)
    .optional(),
});

export const panelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  position: pointSchema,
  system: z.enum(["1P2W-230", "1P2W-120", "1P3W-120/240", "3P4W-230/400"]),
  mainBreakerAmps: z.number().nonnegative(),
});

export const loadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum([
    "lighting",
    "outlet",
    "appliance",
    "laundry",
    "hvac",
    "heating",
    "motor",
    "equipment",
  ]),
  va: z.number().positive(),
  voltage: z.number().positive(),
  continuous: z.boolean(),
  position: pointSchema,
  roomId: z.string().optional(),
  lumens: z.number().positive().optional(),
  cct: z.number().min(1000).max(10000).optional(),
  gfci: z.boolean().optional(),
  egress: z.boolean().optional(),
});

export const bulkLoadsSchema = z.array(loadSchema).max(500);

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

export const simulateOptionsSchema = z
  .object({
    cellSize: z.number().positive().max(1).optional(),
    clearance: z.number().positive().max(5).optional(),
  })
  .optional();

export const autoLightingSchema = z.object({
  /** Rooms to generate for; omit for all rooms. */
  roomIds: z.array(z.string()).optional(),
  targetLux: z.number().positive().max(2000).optional(),
  fixture: z
    .object({
      label: z.string().min(1),
      lumens: z.number().positive(),
      va: z.number().positive(),
      voltage: z.number().positive(),
    })
    .optional(),
  /** Replace previously auto-generated fixtures in those rooms. */
  replaceExisting: z.boolean().optional(),
});

/** W12: DXF drawing units (engine/dxf/layers.ts DXF_UNITS). */
export const dxfUnitsSchema = z.enum(["m", "cm", "mm", "in", "ft"]);

export const dxfExportSchema = z.object({
  units: dxfUnitsSchema.optional(),
});

export const dxfImportSchema = z.object({
  /** ASCII DXF text (the 10 MB JSON body limit caps it further). */
  dxf: z.string().min(1).max(9_500_000),
  /** Overrides the file's $INSUNITS (needed for unitless drawings not in meters). */
  units: dxfUnitsSchema.optional(),
  /** Exact layer names to read walls from; default SOLENCE-WALLS, else WALL-named layers. */
  wallLayers: z.array(z.string().min(1).max(255)).max(50).optional(),
});
