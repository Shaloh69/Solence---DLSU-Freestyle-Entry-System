"""Mask + detection fusion (brief section 7.2).

Combines the U-Net wall mask with YOLO door/window/room detections:
where an opening box intersects wall pixels, the wall is cut and an
opening is emitted. Pure numpy/cv2 — no models required — so this is
fully unit-testable before any training has happened.

Output follows the contract in section 7.4 (and server/docs/api.md):
walls as straight line segments (`{"start", "end", "thickness"}`) in
pixel coordinates, openings/rooms as before.

Walls are extracted via Hough Line Transform, not contour-polygon
reduction. A real wall mask is one large connected network — every wall
touches another at a corner or T-junction — so `cv2.findContours`
returns one big branching contour per connected cluster of rooms, not
one contour per individual wall run. An earlier version of this file
reduced each contour to a line between its two farthest-apart points,
which is correct only for an isolated straight blob; on a real
multi-room mask it instead draws one huge diagonal across whichever two
corners of the whole cluster happen to be farthest apart, which is
wrong. Hough Line Transform finds actual straight runs in the raster
directly, which is the appropriate tool for this.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np

# YOLO class names the fusion step understands. Room classes carry a
# room-type suffix ("room_kitchen"); furniture classes a category
# suffix ("furniture_sofa", Phase 3 §1).
DOOR_CLASS = "door"
WINDOW_CLASS = "window"
ROOM_CLASS_PREFIX = "room_"
FURNITURE_CLASS_PREFIX = "furniture_"


@dataclass
class Detection:
    """One YOLO detection in pixel coordinates."""

    cls: str
    confidence: float
    box: tuple[float, float, float, float]  # x1, y1, x2, y2
    # Segmentation polygon ([[x, y], ...]) when the model produced a
    # mask. Furniture placement derives its ORIENTATION from this via
    # cv2.minAreaRect (Phase 3 §1.1): the spec wants oriented boxes,
    # and the same seg head already carries the shape — a dedicated
    # YOLO-OBB head is the upgrade path if mask-derived rotation ever
    # proves too noisy, since Ultralytics can't mix obb+segment tasks
    # in one model.
    polygon: list[list[float]] | None = None


def _line_orientation(x1: float, y1: float, x2: float, y2: float) -> float:
    """Undirected line angle in [0, 180) degrees — atan2 mod 180 so a
    segment and the same segment with its endpoints swapped always agree
    (whereas a directional angle would come out 180 degrees apart)."""
    return math.degrees(math.atan2(y2 - y1, x2 - x1)) % 180


def _merge_collinear_segments(
    segments: list[tuple[float, float, float, float]],
    angle_tolerance_deg: float = 6.0,
    offset_tolerance_px: float = 8.0,
    gap_tolerance_px: float = 22.0,
) -> list[tuple[float, float, float, float]]:
    """Merge Hough segments into one run per real wall.

    HoughLinesP typically returns several short, overlapping segments
    per real wall edge, plus a near-parallel pair for each side of a
    thick wall. Rather than snapping each segment to a fixed angle/offset
    grid (which splits near-duplicates that straddle a grid boundary),
    pairwise-compare every segment and union ones within tolerance via
    union-find, then merge each resulting group's overlapping/adjacent
    spans into a single continuous run.

    Angle and offset are both computed from the *undirected* line
    orientation (mod 180) so a segment and the same physical segment
    with its two endpoints swapped by Hough always land in the same
    bucket — using a directional angle/normal here previously let
    near-vertical or near-horizontal duplicates flip ~180 degrees apart
    and fail to merge.
    """
    n = len(segments)

    if n == 0:
        return []

    angles: list[float] = []
    offsets: list[float] = []

    for x1, y1, x2, y2 in segments:
        theta = math.radians(_line_orientation(x1, y1, x2, y2))
        nx, ny = -math.sin(theta), math.cos(theta)
        angles.append(math.degrees(theta))
        # Perpendicular distance from the origin to this line, using the
        # single normal implied by the undirected orientation — invariant
        # regardless of which endpoint order Hough returned.
        offsets.append(x1 * nx + y1 * ny)

    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]

        return i

    def union(i: int, j: int) -> None:
        ri, rj = find(i), find(j)

        if ri != rj:
            parent[ri] = rj

    for i in range(n):
        for j in range(i + 1, n):
            if (
                abs(angles[i] - angles[j]) <= angle_tolerance_deg
                and abs(offsets[i] - offsets[j]) <= offset_tolerance_px
            ):
                union(i, j)

    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)

    merged: list[tuple[float, float, float, float]] = []

    for indices in groups.values():
        ox, oy, rx, ry = segments[indices[0]]
        theta = math.radians(_line_orientation(ox, oy, rx, ry))
        ux, uy = math.cos(theta), math.sin(theta)

        spans = []
        for i in indices:
            x1, y1, x2, y2 = segments[i]
            t1 = (x1 - ox) * ux + (y1 - oy) * uy
            t2 = (x2 - ox) * ux + (y2 - oy) * uy
            spans.append((min(t1, t2), max(t1, t2)))
        spans.sort()

        current_start, current_end = spans[0]
        for start, end in spans[1:]:
            if start <= current_end + gap_tolerance_px:
                current_end = max(current_end, end)
            else:
                merged.append(
                    (
                        ox + ux * current_start,
                        oy + uy * current_start,
                        ox + ux * current_end,
                        oy + uy * current_end,
                    )
                )
                current_start, current_end = start, end
        merged.append(
            (
                ox + ux * current_start,
                oy + uy * current_start,
                ox + ux * current_end,
                oy + uy * current_end,
            )
        )

    return merged


def _wall_segments_from_mask(
    mask: np.ndarray, min_length: float = 22.0
) -> list[dict[str, Any]]:
    """Straight wall-run line segments from a wall mask (see module docstring).

    Skeletonize to a 1px centerline before Hough: a real wall band is
    several pixels thick, and running Hough directly on the filled band
    finds many near-duplicate lines at slightly different sub-pixel
    angles/offsets across that thickness (edges, near-diagonal fits
    through the band, etc). Thinning to a single-pixel-wide ridge first
    means Hough only ever sees one line per physical wall.
    """
    from skimage.morphology import skeletonize

    mask_u8 = mask.astype(np.uint8) * 255
    total_area = float((mask_u8 > 0).sum())
    skeleton = (skeletonize(mask) * 255).astype(np.uint8)

    lines = cv2.HoughLinesP(
        skeleton,
        rho=1,
        theta=np.pi / 180,
        threshold=20,
        minLineLength=min_length,
        maxLineGap=10,
    )
    if lines is None:
        return []

    raw = [
        (float(x1), float(y1), float(x2), float(y2))
        for x1, y1, x2, y2 in lines.reshape(-1, 4)
    ]
    merged = _merge_collinear_segments(raw)
    total_run_length = sum(
        math.hypot(x2 - x1, y2 - y1) for x1, y1, x2, y2 in merged
    ) or 1.0
    # A single global thickness estimate (mask area / total run length) —
    # a deliberate simplification, not a per-wall measurement.
    avg_thickness = max(2.0, total_area / total_run_length)

    return [
        {
            "start": [x1, y1],
            "end": [x2, y2],
            "thickness": avg_thickness,
        }
        for x1, y1, x2, y2 in merged
        if math.hypot(x2 - x1, y2 - y1) >= min_length
    ]


def fuse(wall_mask: np.ndarray, detections: list[Detection]) -> dict[str, Any]:
    """Fuse a wall mask with detections into the 7.4 JSON contract.

    Args:
        wall_mask: HxW boolean (or 0/1) array, True where wall.
        detections: YOLO detections (doors, windows, room instances).
    """
    if wall_mask.ndim != 2:
        raise ValueError("wall_mask must be a 2-D array")
    mask = wall_mask.astype(bool).copy()
    height, width = mask.shape

    openings = []
    for det in detections:
        if det.cls not in (DOOR_CLASS, WINDOW_CLASS):
            continue
        x1, y1, x2, y2 = (
            max(0, int(det.box[0])),
            max(0, int(det.box[1])),
            min(width, int(det.box[2])),
            min(height, int(det.box[3])),
        )
        if x2 <= x1 or y2 <= y1:
            continue
        region = mask[y1:y2, x1:x2]
        wall_pixels = int(region.sum())
        if wall_pixels == 0:
            # An opening not on a wall is a false positive — drop it.
            continue
        # Cut the wall where the opening sits.
        mask[y1:y2, x1:x2] = False
        openings.append(
            {
                "kind": det.cls,
                "confidence": round(float(det.confidence), 4),
                "box": [float(x1), float(y1), float(x2), float(y2)],
            }
        )

    rooms = []
    for det in detections:
        if not det.cls.startswith(ROOM_CLASS_PREFIX):
            continue
        # Prefer the segmentation polygon — the box is an axis-aligned
        # rectangle that misaligns with real (L-shaped, angled) rooms.
        boundary = None
        if det.polygon and len(det.polygon) >= 3:
            points = np.array(det.polygon, dtype=np.float32).reshape(-1, 1, 2)
            approx = cv2.approxPolyDP(points, epsilon=4.0, closed=True)
            if len(approx) >= 3:
                boundary = [[float(x), float(y)] for [[x, y]] in approx]
        if boundary is None:
            x1, y1, x2, y2 = det.box
            boundary = [
                [float(x1), float(y1)],
                [float(x2), float(y1)],
                [float(x2), float(y2)],
                [float(x1), float(y2)],
            ]
        rooms.append(
            {
                "type": det.cls[len(ROOM_CLASS_PREFIX):],
                "confidence": round(float(det.confidence), 4),
                "boundary": boundary,
            }
        )

    furniture = []
    for det in detections:
        if not det.cls.startswith(FURNITURE_CLASS_PREFIX):
            continue
        furniture.append(_oriented_furniture(det))

    return {
        "imageSize": {"width": int(width), "height": int(height)},
        "walls": _wall_segments_from_mask(mask),
        "openings": openings,
        "rooms": rooms,
        "furniture": furniture,
    }


def _oriented_furniture(det: Detection) -> dict[str, Any]:
    """Oriented placement box for a furniture detection (Phase 3 §1.3).

    Orientation comes from the segmentation polygon via minAreaRect when
    a mask exists; an axis-aligned fallback (rotation 0) covers
    detections without one. rotationDeg is normalized to [0, 180) — a
    furniture symbol's footprint is 180°-symmetric as a rectangle.
    """
    x1, y1, x2, y2 = det.box
    center = [(x1 + x2) / 2, (y1 + y2) / 2]
    size = [abs(x2 - x1), abs(y2 - y1)]
    rotation = 0.0

    if det.polygon and len(det.polygon) >= 3:
        points = np.array(det.polygon, dtype=np.float32)
        (cx, cy), (w, h), angle = cv2.minAreaRect(points)

        if w > 0 and h > 0:
            # Normalize: long side first, angle follows the long side.
            if w < h:
                w, h = h, w
                angle += 90.0
            center = [float(cx), float(cy)]
            size = [float(w), float(h)]
            rotation = float(angle % 180.0)

    return {
        "category": det.cls[len(FURNITURE_CLASS_PREFIX):],
        "confidence": round(float(det.confidence), 4),
        "center": [round(center[0], 2), round(center[1], 2)],
        "size": [round(size[0], 2), round(size[1], 2)],
        "rotationDeg": round(rotation, 2),
    }
