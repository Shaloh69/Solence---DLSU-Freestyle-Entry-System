"""CubiCasa5K model.svg parser (brief §7.3's "SVG → labels" conversion).

The original dataset annotates each sample folder with a model.svg whose
elements carry class attributes: groups starting with "Wall", "Door",
"Window", and "Space <Type>". The group's FIRST direct <polygon> child
is the shape; nested groups (Glass/Panel/Threshold/…) are decoration and
must not be picked up. Coordinates are in F1_scaled.png pixel space —
the PNG canvas is usually larger than the SVG extents (margins), so
polygons are used as-is against the PNG size. Alignment is verified
visually via verify_dataset.py previews before training.

Room-type mapping targets the classes the Solence compliance engine
keys GFCI rules on; everything unmapped becomes room_other.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

# YOLO class list — order defines class indices in labels/data.yaml.
# Append-only: adding classes at the end keeps old label files' indices
# valid; reordering or inserting invalidates every previous conversion.
CLASSES = [
    "door",
    "window",
    "room_kitchen",
    "room_bathroom",
    "room_bedroom",
    "room_living",
    "room_garage",
    "room_other",
    # Phase 2 §6.1 additions — raw-label instance counts across all
    # 5,000 plans (verified 2026-07-15): outdoor 7852, entry 4211 +
    # draughtlobby 1667 + hall 172, storage 1809 + closet 2695,
    # utility 1015 + technicalroom 474, dining 954. All trainable.
    "room_outdoor",
    "room_hallway",
    "room_storage",
    "room_utility",
    "room_dining",
]

# CubiCasa "Space <Type>" -> Solence room class.
ROOM_TYPE_MAP = {
    "kitchen": "room_kitchen",
    "bath": "room_bathroom",
    "bathroom": "room_bathroom",
    "sauna": "room_bathroom",
    "toilet": "room_bathroom",
    "bedroom": "room_bedroom",
    "livingroom": "room_living",
    "living": "room_living",
    "den": "room_living",
    "garage": "room_garage",
    "carport": "room_garage",
    "outdoor": "room_outdoor",
    "balcony": "room_outdoor",
    "terrace": "room_outdoor",
    "patio": "room_outdoor",
    "porch": "room_outdoor",
    "entry": "room_hallway",
    "draughtlobby": "room_hallway",
    "hall": "room_hallway",
    "hallway": "room_hallway",
    "storage": "room_storage",
    "closet": "room_storage",
    "utility": "room_utility",
    "technicalroom": "room_utility",
    "dining": "room_dining",
    # Was room_living before Phase 2 §6.1 — dining is its own class now.
    "diningroom": "room_dining",
}

Polygon = list[tuple[float, float]]


@dataclass
class SvgSample:
    walls: list[Polygon] = field(default_factory=list)
    doors: list[Polygon] = field(default_factory=list)
    windows: list[Polygon] = field(default_factory=list)
    # (class name from CLASSES, polygon)
    rooms: list[tuple[str, Polygon]] = field(default_factory=list)


def _parse_points(raw: str) -> Polygon:
    points: Polygon = []
    for token in raw.replace("\n", " ").split():
        if "," not in token:
            continue
        x, _, y = token.partition(",")
        try:
            points.append((float(x), float(y)))
        except ValueError:
            continue
    return points


def _first_polygon(group: ET.Element) -> Polygon | None:
    """First DIRECT <polygon> child — nested decoration is skipped."""
    for child in group:
        if child.tag.split("}")[-1] == "polygon":
            raw = child.get("points")
            if raw:
                points = _parse_points(raw)
                if len(points) >= 3:
                    return points
    return None


def parse_model_svg(svg_path: Path) -> SvgSample:
    sample = SvgSample()
    root = ET.parse(svg_path).getroot()

    for element in root.iter():
        cls = (element.get("class") or "").strip()
        if not cls:
            continue
        head, *rest = cls.split()

        if head == "Wall":
            polygon = _first_polygon(element)
            if polygon:
                sample.walls.append(polygon)
        elif head == "Door":
            polygon = _first_polygon(element)
            if polygon:
                sample.doors.append(polygon)
        elif head == "Window":
            polygon = _first_polygon(element)
            if polygon:
                sample.windows.append(polygon)
        elif head == "Space":
            polygon = _first_polygon(element)
            if polygon:
                space_type = rest[0].lower() if rest else ""
                sample.rooms.append(
                    (ROOM_TYPE_MAP.get(space_type, "room_other"), polygon)
                )

    return sample


def cubicasa_root(raw_dir: Path) -> Path | None:
    """Locate the original-dataset root (the folder holding train.txt)."""
    for candidate in [raw_dir, *raw_dir.rglob("train.txt")]:
        folder = candidate if candidate.is_dir() else candidate.parent
        if (folder / "train.txt").exists() and (folder / "val.txt").exists():
            return folder
    return None


def read_split(root: Path, name: str) -> list[str]:
    """Sample folder paths (relative) from train.txt / val.txt / test.txt."""
    return [
        line.strip().strip("/")
        for line in (root / f"{name}.txt").read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
