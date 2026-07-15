"""Room-taxonomy regression tests (Phase 2 §6.1).

Locks the unified class list's order (label indices bake into every
converted dataset — reordering silently corrupts old labels) and the
raw-SVG-label routing, including the diningroom move out of room_living.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from cubicasa_svg import CLASSES, ROOM_TYPE_MAP


def test_classes_order_is_append_only():
    # The original 8 must keep their indices forever.
    assert CLASSES[:8] == [
        "door",
        "window",
        "room_kitchen",
        "room_bathroom",
        "room_bedroom",
        "room_living",
        "room_garage",
        "room_other",
    ]
    # Phase 2 additions appended, never inserted.
    assert CLASSES[8:] == [
        "room_outdoor",
        "room_hallway",
        "room_storage",
        "room_utility",
        "room_dining",
    ]


def test_new_raw_labels_route_to_new_classes():
    assert ROOM_TYPE_MAP["outdoor"] == "room_outdoor"
    assert ROOM_TYPE_MAP["balcony"] == "room_outdoor"
    assert ROOM_TYPE_MAP["entry"] == "room_hallway"
    assert ROOM_TYPE_MAP["draughtlobby"] == "room_hallway"
    assert ROOM_TYPE_MAP["storage"] == "room_storage"
    assert ROOM_TYPE_MAP["closet"] == "room_storage"
    assert ROOM_TYPE_MAP["utility"] == "room_utility"
    assert ROOM_TYPE_MAP["technicalroom"] == "room_utility"
    assert ROOM_TYPE_MAP["dining"] == "room_dining"


def test_diningroom_moved_out_of_living():
    assert ROOM_TYPE_MAP["diningroom"] == "room_dining"


def test_every_mapped_class_exists():
    for target in ROOM_TYPE_MAP.values():
        assert target in CLASSES, f"{target} missing from CLASSES"
