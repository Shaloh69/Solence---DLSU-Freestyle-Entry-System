"""Fusion + pipeline contract tests — run without any trained models."""

from __future__ import annotations

import math

import numpy as np

from app.fusion import Detection, fuse
from app.pipeline import run_pipeline


def test_fuse_output_matches_contract(synthetic_wall_mask):
    detections = [
        Detection(cls="door", confidence=0.91, box=(90.0, 18.0, 112.0, 28.0)),
        Detection(cls="room_kitchen", confidence=0.85, box=(30.0, 30.0, 170.0, 170.0)),
    ]
    result = fuse(synthetic_wall_mask, detections)

    assert set(result) == {"imageSize", "walls", "openings", "rooms", "furniture"}
    assert result["imageSize"] == {"width": 200, "height": 200}

    assert len(result["openings"]) == 1
    opening = result["openings"][0]
    assert opening["kind"] == "door"
    assert all(math.isfinite(v) for v in opening["box"])

    assert len(result["rooms"]) == 1
    room = result["rooms"][0]
    assert room["type"] == "kitchen"
    assert len(room["boundary"]) == 4

    assert len(result["walls"]) >= 1
    for wall in result["walls"]:
        assert all(math.isfinite(v) for v in wall["start"])
        assert all(math.isfinite(v) for v in wall["end"])
        assert math.isfinite(wall["thickness"])


def test_fuse_cuts_wall_at_door(synthetic_wall_mask):
    door_box = (90.0, 18.0, 112.0, 28.0)
    result = fuse(
        synthetic_wall_mask,
        [Detection(cls="door", confidence=0.9, box=door_box)],
    )
    assert len(result["openings"]) == 1
    # The original solid ring yields one outer contour; cutting the top
    # wall must change the wall geometry (more polygons or shorter wall).
    uncut = fuse(synthetic_wall_mask, [])
    assert result["walls"] != uncut["walls"]


def test_fuse_drops_openings_not_on_walls(synthetic_wall_mask):
    result = fuse(
        synthetic_wall_mask,
        [Detection(cls="window", confidence=0.9, box=(90.0, 90.0, 110.0, 110.0))],
    )
    assert result["openings"] == []


def test_fuse_furniture_orientation_from_polygon(synthetic_wall_mask):
    # A 40x20 rectangle rotated 45 degrees around (100, 100).
    import math as m

    cx, cy, half_w, half_h, angle = 100.0, 100.0, 20.0, 10.0, m.radians(45)
    corners = []
    for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
        x = sx * half_w
        y = sy * half_h
        corners.append(
            [
                cx + x * m.cos(angle) - y * m.sin(angle),
                cy + x * m.sin(angle) + y * m.cos(angle),
            ]
        )

    result = fuse(
        synthetic_wall_mask,
        [
            Detection(
                cls="furniture_bed",
                confidence=0.9,
                box=(70.0, 70.0, 130.0, 130.0),
                polygon=corners,
            )
        ],
    )

    assert len(result["furniture"]) == 1
    item = result["furniture"][0]
    assert item["category"] == "bed"
    assert abs(item["center"][0] - cx) < 2 and abs(item["center"][1] - cy) < 2
    # Long side first, rotation recovered (45 degrees, mod 180).
    assert abs(item["size"][0] - 40.0) < 2.5
    assert abs(item["size"][1] - 20.0) < 2.5
    assert abs(item["rotationDeg"] - 45.0) < 3.0


def test_fuse_furniture_without_polygon_falls_back_axis_aligned(
    synthetic_wall_mask,
):
    result = fuse(
        synthetic_wall_mask,
        [
            Detection(
                cls="furniture_table",
                confidence=0.6,
                box=(50.0, 60.0, 90.0, 80.0),
            )
        ],
    )

    item = result["furniture"][0]
    assert item["category"] == "table"
    assert item["rotationDeg"] == 0.0
    assert item["size"] == [40.0, 20.0]


def test_pipeline_stages_in_order(synthetic_image, synthetic_wall_mask):
    stages: list[str] = []

    result = run_pipeline(
        synthetic_image,
        on_progress=lambda stage, _msg: stages.append(stage),
        wall_predictor=lambda _img: synthetic_wall_mask,
        opening_predictor=lambda _img: [
            Detection(cls="door", confidence=0.9, box=(90.0, 18.0, 112.0, 28.0))
        ],
    )

    assert stages == [
        "running_wall_segmentation",
        "running_detection",
        "fusing",
        "done",
    ]
    assert len(result["openings"]) == 1
