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

    assert set(result) == {"imageSize", "walls", "openings", "rooms"}
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
    for polygon in result["walls"]:
        for point in polygon:
            assert all(math.isfinite(v) for v in point)


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
