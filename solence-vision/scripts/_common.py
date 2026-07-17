"""Shared paths, dataset registry, and guard rails for the scripts.

Every script imports from here so prerequisite checks and output
versioning behave identically across the pipeline.
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_RAW = BASE_DIR / "data" / "raw"
DATA_YOLO = BASE_DIR / "data" / "yolo"
DATA_UNET = BASE_DIR / "data" / "unet"
DATA_PREVIEWS = BASE_DIR / "data" / "_previews"
MODELS_YOLO = BASE_DIR / "models" / "yolo"
MODELS_UNET = BASE_DIR / "models" / "unet"

# Registered datasets. Add new entries here (RPLAN, PH fine-tuning sets)
# rather than hardcoding names inside individual scripts.
DATASETS: dict[str, dict[str, str]] = {
    "cubicasa5k": {
        "kaggle": "qmarva/cubicasa5k",
        "notes": (
            "Primary dataset. COCO-converted mirror with pretrained weights: "
            "https://github.com/xmarva/floorplan-detection"
        ),
    },
    "resplan": {
        "kaggle": "",
        "notes": "17k plans (2025). Data pointers: https://arxiv.org/html/2508.14006v1",
    },
    "rplan": {
        "kaggle": "",
        "notes": "80k plans; access by request from the original authors.",
    },
    "floorplancad": {
        "kaggle": "",
        "notes": (
            "Phase 3 furniture-symbol source: real CAD plans with movable-"
            "furniture classes. https://huggingface.co/datasets/Voxel51/"
            "FloorPlanCAD — CHECK LICENSE TERMS before training (research "
            "dataset; commercial-use status must be confirmed)."
        ),
    },
    "sfpi": {
        "kaggle": "",
        "notes": (
            "SESYD/SFPI synthetic plans (~10k images, ~300k furniture "
            "instances, 16 classes). Bulk pretraining volume only — "
            "sim-to-real gap applies."
        ),
    },
}


def die(message: str) -> None:
    """Fail loudly with a clear next step (section 8.3 ground rule)."""
    print(f"\nERROR: {message}\n", file=sys.stderr)
    sys.exit(1)


def require_dataset_name(name: str) -> None:
    if name not in DATASETS:
        die(
            f"Unknown dataset '{name}'. Registered: {', '.join(DATASETS)}. "
            "Add new datasets to scripts/_common.py DATASETS."
        )


def require_raw(name: str) -> Path:
    path = DATA_RAW / name
    if not path.exists() or not any(path.iterdir()):
        die(
            f"data/raw/{name} is empty — run "
            f"'python scripts/download_datasets.py --dataset {name}' first."
        )
    return path


def versioned_output(base: Path, name: str, force: bool) -> Path:
    """Never silently overwrite a previous run (section 8.3)."""
    out = base / name
    if out.exists() and any(out.iterdir()):
        if force:
            print(f"--force given: reusing/overwriting {out}")
            return out
        stamped = base / f"{name}-{datetime.now():%Y%m%d-%H%M%S}"
        print(f"{out} already exists; writing to {stamped} instead (use --force to overwrite)")
        return stamped
    return out
