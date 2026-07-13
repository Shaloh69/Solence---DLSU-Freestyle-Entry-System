/**
 * Converts a solence-vision `/recognize` result (brief §7.1/§7.4 —
 * wall-mask contours, opening boxes, room boxes in PIXEL coordinates)
 * into a FloorPlan the rasterizer/router already understands (line-
 * segment walls, offset-based openings, room polygons in METERS).
 *
 * This is intentionally NOT full CAD vectorization (brief §7.1 explicitly
 * rules that out as research-grade scope creep) — each wall contour is
 * reduced to its single longest-axis line segment, which is "a good
 * segmentation mask" per the brief's own bar for routing purposes, not a
 * precise polygon reconstruction.
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

export interface VisionResult {
  imageSize: { width: number; height: number };
  walls: [number, number][][];
  openings: VisionOpening[];
  rooms: VisionRoom[];
}

function shoelaceArea(polygon: [number, number][]): number {
  let sum = 0;

  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];

    sum += x1 * y2 - x2 * y1;
  }

  return Math.abs(sum) / 2;
}

/** Reduce a wall-blob contour to its longest-axis line segment. */
function polygonToWall(
  polygonPx: [number, number][],
  index: number,
  pxPerMeter: number
): Wall | null {
  if (polygonPx.length < 2) return null;

  let maxDistSq = 0;
  let a = polygonPx[0];
  let b = polygonPx[0];

  for (let i = 0; i < polygonPx.length; i++) {
    for (let j = i + 1; j < polygonPx.length; j++) {
      const dx = polygonPx[i][0] - polygonPx[j][0];
      const dy = polygonPx[i][1] - polygonPx[j][1];
      const distSq = dx * dx + dy * dy;

      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        a = polygonPx[i];
        b = polygonPx[j];
      }
    }
  }

  const lengthPx = Math.sqrt(maxDistSq);

  if (lengthPx < 4) return null; // too small to be a real wall

  const area = shoelaceArea(polygonPx);
  const thicknessPx = lengthPx > 0 ? area / lengthPx : 4;

  return {
    id: `vw-${index}`,
    start: { x: a[0] / pxPerMeter, y: a[1] / pxPerMeter },
    end: { x: b[0] / pxPerMeter, y: b[1] / pxPerMeter },
    thickness: Math.max(0.08, Math.min(0.3, thicknessPx / pxPerMeter)),
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

function mapRoomType(raw: string): RoomType {
  return (ROOM_TYPES as string[]).includes(raw) ? (raw as RoomType) : "other";
}

export function visionResultToFloorPlan(
  result: VisionResult,
  previous: FloorPlan | null,
  pxPerMeter: number = ASSUMED_PX_PER_METER
): FloorPlan {
  const walls = result.walls
    .map((polygon, index) => polygonToWall(polygon, index, pxPerMeter))
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
