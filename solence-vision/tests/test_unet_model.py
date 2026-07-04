"""Trained-U-Net regression tests.

Skipped until models/unet/best.pt exists. Catches a wall model that
collapsed to all-background or all-wall after a retrain.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from app.models import UNET_WEIGHTS

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.mark.skipif(
    not UNET_WEIGHTS.exists(),
    reason="No trained U-Net weights — run scripts/train_unet.py first (see HOW-TO.md)",
)
def test_unet_mask_shape_and_coverage():
    from PIL import Image

    from app.pipeline import default_wall_predictor

    samples = sorted(FIXTURES.glob("*.png")) + sorted(FIXTURES.glob("*.jpg"))
    if not samples:
        pytest.skip("No fixture images — add a handful of real plans to tests/fixtures/")

    for sample in samples:
        rgb = np.asarray(Image.open(sample).convert("RGB"))
        mask = default_wall_predictor(rgb)

        assert mask.shape[:2] == rgb.shape[:2], f"{sample.name}: mask/input shape mismatch"
        coverage = float(mask.mean())
        assert 0.005 <= coverage <= 0.6, (
            f"{sample.name}: wall coverage {coverage:.1%} outside sane range — "
            "model may have collapsed"
        )
