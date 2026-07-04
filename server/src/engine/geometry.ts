/**
 * Shared 2D polygon/segment helpers used by the lighting engine,
 * rasterizer, and compliance rules. Plan coordinates in meters.
 */
import { Point, Wall } from "./types.js";

/** Shoelace polygon area (absolute), m². */
export function polygonArea(boundary: Point[]): number {
  if (boundary.length < 3) return 0;
  let sum = 0;

  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i];
    const b = boundary[(i + 1) % boundary.length];

    sum += a.x * b.y - b.x * a.y;
  }

  return Math.abs(sum) / 2;
}

export function polygonBounds(boundary: Point[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of boundary) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

export function polygonCentroid(boundary: Point[]): Point {
  const n = boundary.length || 1;

  return {
    x: boundary.reduce((sum, point) => sum + point.x, 0) / n,
    y: boundary.reduce((sum, point) => sum + point.y, 0) / n,
  };
}

/** Ray-cast point-in-polygon test. */
export function pointInPolygon(point: Point, boundary: Point[]): boolean {
  let inside = false;

  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const a = boundary[i];
    const b = boundary[j];

    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/** Distance from a point to a line segment. */
export function distanceToSegment(
  point: Point,
  start: Point,
  end: Point
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.min(
    1,
    Math.max(
      0,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq
    )
  );

  return Math.hypot(
    point.x - (start.x + t * dx),
    point.y - (start.y + t * dy)
  );
}

/** Length of a wall segment. */
export function wallLength(wall: Wall): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

/** Point at a given distance from the wall's start, along the wall. */
export function pointAlongWall(wall: Wall, distance: number): Point {
  const length = wallLength(wall);

  if (length === 0) return { ...wall.start };
  const t = distance / length;

  return {
    x: wall.start.x + t * (wall.end.x - wall.start.x),
    y: wall.start.y + t * (wall.end.y - wall.start.y),
  };
}
