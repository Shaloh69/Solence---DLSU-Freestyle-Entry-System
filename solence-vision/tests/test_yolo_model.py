"""Trained-YOLO regression tests.

Skipped until models/yolo/best.pt exists — the point is to catch a
retrain that silently stops detecting doors/windows before it reaches
the live product. Add real sample plans to tests/fixtures/ for stronger
assertions than the synthetic image allows.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.models import YOLO_WEIGHTS

FIXTURES = Path(__file__).parent / "fixtures"
MIN_CONFIDENCE = 0.25


@pytest.mark.skipif(
    not YOLO_WEIGHTS.exists(),
    reason="No trained YOLO weights — run scripts/train_yolo.py first (see HOW-TO.md)",
)
def test_yolo_detects_expected_classes_on_fixtures():
    from app.models import load_yolo

    model = load_yolo()
    samples = sorted(FIXTURES.glob("*.png")) + sorted(FIXTURES.glob("*.jpg"))
    if not samples:
        pytest.skip("No fixture images — add a handful of real plans to tests/fixtures/")

    for sample in samples:
        results = model.predict(str(sample), verbose=False)
        detections = [
            (results[0].names[int(box.cls)], float(box.conf))
            for result in results
            for box in result.boxes
        ]
        assert detections, f"{sample.name}: no detections at all"
        classes = {name for name, _ in detections}
        assert classes & {"door", "window"}, (
            f"{sample.name}: expected doors/windows, got {classes}"
        )
        assert max(conf for _, conf in detections) >= MIN_CONFIDENCE
