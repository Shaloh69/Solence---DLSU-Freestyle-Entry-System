"""Shared fixtures: a tiny synthetic floor-plan-like image and wall mask.

Real sample floor plans belong in tests/fixtures/ (see its README);
synthetic ones keep the checked-in footprint tiny while still exercising
the fusion pipeline and API contract.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture()
def synthetic_wall_mask() -> np.ndarray:
    """200x200 mask with a rectangular wall ring, 6 px thick."""
    mask = np.zeros((200, 200), dtype=bool)
    mask[20:26, 20:180] = True   # top
    mask[174:180, 20:180] = True  # bottom
    mask[20:180, 20:26] = True   # left
    mask[20:180, 174:180] = True  # right
    return mask


@pytest.fixture()
def synthetic_image(synthetic_wall_mask: np.ndarray) -> np.ndarray:
    """RGB rendering of the synthetic plan (white floor, black walls)."""
    image = np.full((200, 200, 3), 255, dtype=np.uint8)
    image[synthetic_wall_mask] = 0
    return image
