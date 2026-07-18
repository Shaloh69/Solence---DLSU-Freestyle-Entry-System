"""Convert the FloorPlanCAD HF mirror to YOLO instance-seg format.

Source: huggingface.co/datasets/Voxel51/FloorPlanCAD — 5,308 real CAD
plans (the original paper's test split), FiftyOne-format annotations:
per-detection normalized [x, y, w, h] boxes + zlib'd .npy instance
masks cropped to the box. License: CC BY-SA 4.0 (commercial use OK with
attribution + share-alike; recorded in scripts/_common.py DATASETS).

Emits data/yolo/floorplancad/ with the dataset's NATIVE class names in
data.yaml — merge_datasets.py's SOURCE_CLASS_MAPS routes them onto the
unified taxonomy (furniture_* / door / window) and drops the rest, so
this converter stays a faithful transcription, not a remapper.

Usage:
    python scripts/convert_floorplancad.py [--force]
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import shutil
import sys
import zlib
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _common import DATA_RAW, DATA_YOLO, die, versioned_output

# Native labels worth transcribing: everything merge_datasets.py maps
# onto the unified taxonomy. Walls are skipped (the U-Net owns walls);
# fixed plumbing/circulation symbols are skipped as non-furniture.
KEEP = [
    "single_door",
    "double_door",
    "sliding_door",
    "window",
    "bay_window",
    "blind_window",
    "chair",
    "table",
    "sofa",
    "bed",
    "wardrobe",
    "half_height_cabinet",
    "high_cabinet",
    "tv_cabinet",
    "bedside_cupboard",
]

VAL_EVERY = 10  # every 10th sample -> val split (deterministic)


def mask_to_polygon(
    mask: np.ndarray,
    box: list[float],
    image_w: int,
    image_h: int,
) -> list[tuple[float, float]] | None:
    """Largest-contour polygon in normalized image coords."""
    contours, _ = cv2.findContours(
        (mask > 0).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return None
    contour = max(contours, key=cv2.contourArea)
    if cv2.contourArea(contour) < 4:
        return None
    approx = cv2.approxPolyDP(contour, epsilon=1.5, closed=True)
    if len(approx) < 3:
        return None

    # Mask pixels are bbox-local; box is normalized [x, y, w, h].
    box_x = box[0] * image_w
    box_y = box[1] * image_h
    scale_x = (box[2] * image_w) / mask.shape[1]
    scale_y = (box[3] * image_h) / mask.shape[0]

    points = []
    for [[px, py]] in approx:
        x = (box_x + px * scale_x) / image_w
        y = (box_y + py * scale_y) / image_h
        points.append((min(1, max(0, x)), min(1, max(0, y))))

    return points


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        die("huggingface_hub missing — pip install huggingface_hub first.")
        return

    raw_dir = DATA_RAW / "floorplancad"
    print("Downloading/refreshing FloorPlanCAD snapshot (first run is ~GBs)…")
    snapshot_download(
        "Voxel51/FloorPlanCAD",
        repo_type="dataset",
        local_dir=raw_dir,
        allow_patterns=["data/*.png", "samples.json"],
    )

    samples = json.load(open(raw_dir / "samples.json", encoding="utf-8"))[
        "samples"
    ]
    out_dir = versioned_output(DATA_YOLO, "floorplancad", args.force)
    for split in ("train", "val"):
        (out_dir / "images" / split).mkdir(parents=True, exist_ok=True)
        (out_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

    converted = 0
    skipped = 0

    for index, sample in enumerate(samples):
        image_path = raw_dir / "data" / Path(sample["filepath"]).name
        if not image_path.exists():
            skipped += 1
            continue

        metadata = sample.get("metadata") or {}
        image_w = metadata.get("width")
        image_h = metadata.get("height")
        if not image_w or not image_h:
            shape = cv2.imread(str(image_path)).shape
            image_h, image_w = shape[0], shape[1]

        lines: list[str] = []
        for det in sample["ground_truth"]["detections"]:
            label = det["label"]
            if label not in KEEP:
                continue
            try:
                raw = zlib.decompress(
                    base64.b64decode(det["mask"]["$binary"]["base64"])
                )
                mask = np.load(io.BytesIO(raw))
            except Exception:
                continue
            polygon = mask_to_polygon(
                mask, det["bounding_box"], image_w, image_h
            )
            if not polygon:
                continue
            coords = " ".join(f"{x:.5f} {y:.5f}" for x, y in polygon)
            lines.append(f"{KEEP.index(label)} {coords}")

        if not lines:
            skipped += 1
            continue

        split = "val" if index % VAL_EVERY == 0 else "train"
        shutil.copy2(image_path, out_dir / "images" / split / image_path.name)
        (out_dir / "labels" / split / f"{image_path.stem}.txt").write_text(
            "\n".join(lines) + "\n", encoding="utf-8"
        )
        converted += 1
        if converted % 500 == 0:
            print(f"  {converted} converted…")

    root = out_dir.resolve().as_posix()
    (out_dir / "data.yaml").write_text(
        f"path: {root}\ntrain: images/train\nval: images/val\nnames:\n"
        + "\n".join(f"  {i}: {name}" for i, name in enumerate(KEEP)),
        encoding="utf-8",
    )
    print(f"Converted {converted} plans ({skipped} skipped) -> {out_dir}")
    print(
        "Next: python scripts/merge_datasets.py --sources cubicasa5k floorplancad"
    )


if __name__ == "__main__":
    main()
