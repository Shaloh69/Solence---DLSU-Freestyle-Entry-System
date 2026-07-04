/**
 * Zod request schemas — the runtime half of the API contract in
 * docs/api.md. Shapes mirror src/engine/types.ts.
 */
import { z } from "zod";

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

export const floorPlanSchema = z.object({
  width: z.number().positive().max(1000),
  height: z.number().positive().max(1000),
  walls: z.array(wallSchema),
  rooms: z.array(roomSchema),
  openings: z.array(openingSchema).optional(),
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
  system: z.enum(["1P2W-120", "1P3W-120/240", "3P4W-230/400"]),
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
    "motor",
    "equipment",
  ]),
  va: z.number().positive(),
  voltage: z.number().positive(),
  continuous: z.boolean(),
  position: pointSchema,
  roomId: z.string().optional(),
  lumens: z.number().positive().optional(),
  gfci: z.boolean().optional(),
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
