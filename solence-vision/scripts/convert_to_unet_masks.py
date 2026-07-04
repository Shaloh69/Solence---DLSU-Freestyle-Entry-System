"""Convert wall annotations into raster segmentation masks for the U-Net.

Usage:
    python scripts/convert_to_unet_masks.py --dataset cubicasa5k [--force]

Output: data/unet/<dataset>/ with images/ and masks/ (PNG, 255 = wall).
Expects the same COCO annotations used by convert_to_yolo.py, rendering
wall-category polygons into masks.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from _common import DATA_UNET, die, require_dataset_name, require_raw, versioned_output

WALL_CATEGORY_NAMES = {"wall", "walls"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    require_dataset_name(args.dataset)
    raw = require_raw(args.dataset)
    out_dir = versioned_output(DATA_UNET, args.dataset, args.force)

    try:
        import cv2
        import numpy as np
    except ImportError:
        die("opencv/numpy missing — pip install -r requirements.txt first.")
        return

    coco_files = list(raw.rglob("*.json"))
    coco_json = next(
        (f for f in coco_files if "coco" in f.name.lower() or "annotations" in f.name.lower()),
        None,
    )
    if not coco_json:
        die(f"No COCO annotation JSON found under {raw} — see convert_to_yolo.py notes.")
        return

    with open(coco_json, encoding="utf-8") as handle:
        coco = json.load(handle)
    wall_ids = {
        c["id"] for c in coco["categories"] if c["name"].lower() in WALL_CATEGORY_NAMES
    }
    if not wall_ids:
        die(
            "No wall category in the annotations. Categories present: "
            + ", ".join(sorted(c["name"] for c in coco["categories"]))
        )

    images = {i["id"]: i for i in coco["images"]}
    (out_dir / "images").mkdir(parents=True, exist_ok=True)
    (out_dir / "masks").mkdir(parents=True, exist_ok=True)

    import shutil

    masks: dict[int, "np.ndarray"] = {}
    for annotation in coco["annotations"]:
        if annotation["category_id"] not in wall_ids:
            continue
        image = images.get(annotation["image_id"])
        if not image:
            continue
        mask = masks.setdefault(
            image["id"], np.zeros((image["height"], image["width"]), dtype=np.uint8)
        )
        for polygon in annotation.get("segmentation", []):
            points = np.array(polygon, dtype=np.int32).reshape(-1, 2)
            cv2.fillPoly(mask, [points], color=255)

    count = 0
    for image_id, mask in masks.items():
        image = images[image_id]
        source = coco_json.parent / image["file_name"]
        if not source.exists():
            continue
        shutil.copy2(source, out_dir / "images" / source.name)
        cv2.imwrite(str(out_dir / "masks" / (source.stem + ".png")), mask)
        count += 1

    if count == 0:
        die("Rendered 0 masks — check that image files sit next to the annotation JSON.")
    print(f"Rendered {count} wall masks -> {out_dir}")
    print(f"Next: python scripts/verify_dataset.py --dataset {args.dataset} --format unet")


if __name__ == "__main__":
    main()
