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

export const floorPlanSchema = z.object({
  width: z.number().positive().max(1000),
  height: z.number().positive().max(1000),
  walls: z.array(wallSchema),
  rooms: z.array(roomSchema),
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
});

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
