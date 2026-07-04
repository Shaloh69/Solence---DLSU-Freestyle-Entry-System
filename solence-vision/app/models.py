"""Model loading for the fused pipeline.

Weights live in models/unet/ and models/yolo/ (gitignored). Loading is
lazy and failures are loud: every missing prerequisite tells you which
script to run, per the section 8.3 ground rules.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent.parent
UNET_WEIGHTS = BASE_DIR / "models" / "unet" / "best.pt"
YOLO_WEIGHTS = BASE_DIR / "models" / "yolo" / "best.pt"


class ModelsNotAvailable(RuntimeError):
    """Raised when trained weights (or ML deps) are missing."""


def models_status() -> dict[str, bool]:
    return {
        "unet": UNET_WEIGHTS.exists(),
        "yolo": YOLO_WEIGHTS.exists(),
    }


_unet: Any = None
_yolo: Any = None


def load_unet() -> Any:
    global _unet
    if _unet is not None:
        return _unet
    if not UNET_WEIGHTS.exists():
        raise ModelsNotAvailable(
            f"U-Net weights not found at {UNET_WEIGHTS}. "
            "Train them first: python scripts/train_unet.py --dataset cubicasa5k "
            "(see HOW-TO.md)."
        )
    try:
        import torch
    except ImportError as error:  # pragma: no cover - env dependent
        raise ModelsNotAvailable(
            "PyTorch is not installed. pip install -r requirements.txt (see HOW-TO.md)."
        ) from error
    _unet = torch.load(UNET_WEIGHTS, map_location="cpu", weights_only=False)
    _unet.eval()
    return _unet


def load_yolo() -> Any:
    global _yolo
    if _yolo is not None:
        return _yolo
    if not YOLO_WEIGHTS.exists():
        raise ModelsNotAvailable(
            f"YOLO weights not found at {YOLO_WEIGHTS}. "
            "Train them first: python scripts/train_yolo.py --dataset cubicasa5k "
            "(see HOW-TO.md)."
        )
    try:
        from ultralytics import YOLO
    except ImportError as error:  # pragma: no cover - env dependent
        raise ModelsNotAvailable(
            "ultralytics is not installed. pip install -r requirements.txt (see HOW-TO.md)."
        ) from error
    _yolo = YOLO(str(YOLO_WEIGHTS))
    return _yolo
