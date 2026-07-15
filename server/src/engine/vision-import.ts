/**
 * Converts a solence-vision `/recognize` result (brief §7.1/§7.4 —
 * wall line segments, opening boxes, room boxes in PIXEL coordinates)
 * into a FloorPlan the rasterizer/router already understands (line-
 * segment walls, offset-based openings, room polygons in METERS).
 *
 * Wall geometry is already resolved on the Python side (solence-vision's
 * `fusion.py` skeletonizes the wall mask and runs a Hough line transform
 * to get real straight wall runs) — this file's job is just the unit
 * conversion (px -> m), not geometry reconstruction. An earlier version
 * of this file did the geometry work here instead, reducing each raw
 * wall-mask contour to a line between its two farthest-apart points;
 * that only works for an isolated single-run blob, and produced one
 * huge nonsense diagonal per real floor plan (whose wall mask is one
 * large connected network, not one contour per wall) — see fusion.py's
 * module docstring for the full explanation.
 *
 * VISION-VERIFY: there is no real-world scale calibration from the
 * uploaded image (no reference dimension, no DPI metadata), so pixels
 * are converted to meters via an assumed constant below. Treat every
 * recognized dimension as approximate until a calibration step exists;
 * this mirrors how PEC-VERIFY flags unverified code figures.
 */
import { FloorPlan, Opening, Point, Room, RoomType, Wall } from "./types.js";

/** VISION-VERIFY: assumed scale until real calibration exists. */
export const ASSUMED_PX_PER_METER = 50;

const ROOM_TYPES: RoomType[] = [
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
];

export interface VisionOpening {
  kind: "door" | "window";
  confidence: number;
  box: [number, number, number, number];
}

export interface VisionRoom {
  type: string;
  confidence: number;
  boundary: [number, number][];
}

export interface VisionWallSegment {
  start: [number, number];
  end: [number, number];
  thickness: number;
}

export interface VisionResult {
  imageSize: { width: number; height: number };
  walls: VisionWallSegment[];
  openings: VisionOpening[];
  rooms: VisionRoom[];
}

/** Scale an already-resolved wall segment from pixels to meters. */
function wallSegmentToWall(
  segment: VisionWallSegment,
  index: number,
  pxPerMeter: number
): Wall | null {
  const lengthPx = Math.hypot(
    segment.end[0] - segment.start[0],
    segment.end[1] - segment.start[1]
  );

  if (lengthPx < 4) return null; // too small to be a real wall

  return {
    id: `vw-${index}`,
    start: { x: segment.start[0] / pxPerMeter, y: segment.start[1] / pxPerMeter },
    end: { x: segment.end[0] / pxPerMeter, y: segment.end[1] / pxPerMeter },
    thickness: Math.max(0.08, Math.min(0.3, segment.thickness / pxPerMeter)),
  };
}

/** Nearest wall to a point, reused from the same logic as the editor. */
function nearestWall(
  point: Point,
  walls: Wall[],
  maxDistance: number
): { wall: Wall; distance: number; t: number } | null {
  let best: { wall: Wall; distance: number; t: number } | null = null;

  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) continue;
    const t = Math.min(
      1,
      Math.max(
        0,
        ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) /
          lengthSq
      )
    );
    const proj = { x: wall.start.x + t * dx, y: wall.start.y + t * dy };
    const distance = Math.hypot(point.x - proj.x, point.y - proj.y);

    if (distance <= maxDistance && (!best || distance < best.distance)) {
      best = { wall, distance, t };
    }
  }

  return best;
}

/**
 * Vision classes with no exact RoomType twin. `utility` maps to
 * `laundry` deliberately — a PH utility area is where the washing
 * machine lives, and `laundry` is a GFCI room type, so the wet-area
 * compliance rule keeps firing on recognized utility rooms.
 */
const ROOM_TYPE_ALIASES: Record<string, RoomType> = {
  utility: "laundry",
  storage: "other",
};

function mapRoomType(raw: string): RoomType {
  if ((ROOM_TYPES as string[]).includes(raw)) return raw as RoomType;

  return ROOM_TYPE_ALIASES[raw] ?? "other";
}

export function visionResultToFloorPlan(
  result: VisionResult,
  previous: FloorPlan | null,
  pxPerMeter: number = ASSUMED_PX_PER_METER
): FloorPlan {
  const walls = result.walls
    .map((segment, index) => wallSegmentToWall(segment, index, pxPerMeter))
    .filter((wall): wall is Wall => Boolean(wall));

  const openings: Opening[] = [];

  result.openings.forEach((opening, index) => {
    const [x1, y1, x2, y2] = opening.box;
    const center: Point = {
      x: (x1 + x2) / 2 / pxPerMeter,
      y: (y1 + y2) / 2 / pxPerMeter,
    };
    const width = Math.hypot(x2 - x1, y2 - y1) / pxPerMeter;
    const hit = nearestWall(center, walls, 0.6);

    if (!hit) return; // not on a wall — drop, matches fusion.py's own filter
    const wallLength = Math.hypot(
      hit.wall.end.x - hit.wall.start.x,
      hit.wall.end.y - hit.wall.start.y
    );
    const offset = Math.min(
      Math.max(hit.t * wallLength - width / 2, 0),
      Math.max(wallLength - width, 0)
    );

    openings.push({
      id: `vo-${index}`,
      wallId: hit.wall.id,
      offset,
      width: Math.max(0.5, width),
      kind: opening.kind,
    });
  });

  const rooms: Room[] = result.rooms.map((room, index) => ({
    id: `vr-${index}`,
    name: `Room ${index + 1}`,
    type: mapRoomType(room.type),
    boundary: room.boundary.map(([x, y]) => ({
      x: x / pxPerMeter,
      y: y / pxPerMeter,
    })),
  }));

  const width = Math.max(1, result.imageSize.width / pxPerMeter);
  const height = Math.max(1, result.imageSize.height / pxPerMeter);

  return {
    width,
    height,
    walls,
    rooms,
    openings,
    furniture: previous?.furniture,
    backgroundImage: previous?.backgroundImage,
  };
}
