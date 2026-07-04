"""Mask + detection fusion (brief section 7.2).

Combines the U-Net wall mask with YOLO door/window/room detections:
where an opening box intersects wall pixels, the wall is cut and an
opening is emitted. Pure numpy/cv2 — no models required — so this is
fully unit-testable before any training has happened.

Output follows the contract in section 7.4 (and server/docs/api.md):
walls/openings/rooms as polygons in pixel coordinates.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np

# YOLO class names the fusion step understands. Room classes carry a
# room-type suffix, e.g. "room_kitchen".
DOOR_CLASS = "door"
WINDOW_CLASS = "window"
ROOM_CLASS_PREFIX = "room_"


@dataclass
class Detection:
    """One YOLO detection in pixel coordinates."""

    cls: str
    confidence: float
    box: tuple[float, float, float, float]  # x1, y1, x2, y2


def _polygons_from_mask(mask: np.ndarray, min_area: float = 25.0) -> list[list[list[float]]]:
    """Contour polygons ([[x, y], ...]) from a boolean mask."""
    contours, _ = cv2.findContours(
        mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    polygons = []
    for contour in contours:
        if cv2.contourArea(contour) < min_area:
            continue
        approx = cv2.approxPolyDP(contour, epsilon=2.0, closed=True)
        polygons.append([[float(x), float(y)] for [[x, y]] in approx])
    return polygons


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
        x1, y1, x2, y2 = det.box
        rooms.append(
            {
                "type": det.cls[len(ROOM_CLASS_PREFIX):],
                "confidence": round(float(det.confidence), 4),
                "boundary": [
                    [float(x1), float(y1)],
                    [float(x2), float(y1)],
                    [float(x2), float(y2)],
                    [float(x1), float(y2)],
                ],
            }
        )

    return {
        "imageSize": {"width": int(width), "height": int(height)},
        "walls": _polygons_from_mask(mask),
        "openings": openings,
        "rooms": rooms,
    }
