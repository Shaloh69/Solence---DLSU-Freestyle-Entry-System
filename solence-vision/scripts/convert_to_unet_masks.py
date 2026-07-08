"""Convert wall annotations into raster segmentation masks for the U-Net.

Usage:
    python scripts/convert_to_unet_masks.py --dataset cubicasa5k [--force]

Output: data/unet/<dataset>/ with images/{train,val}/ and
masks/{train,val}/ (PNG, 255 = wall pixel).

Layouts (auto-detected, same as convert_to_yolo.py):
1. CubiCasa5K original — wall polygons parsed from each model.svg and
   rasterized at F1_scaled.png size; images hardlinked when possible.
2. Generic COCO JSON with a wall category carrying polygon segmentation.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from _common import DATA_UNET, die, require_dataset_name, require_raw, versioned_output
from cubicasa_svg import cubicasa_root, parse_model_svg, read_split
from convert_to_yolo import link_or_copy

WALL_CATEGORY_NAMES = {"wall", "walls"}


def convert_cubicasa(root: Path, out_dir: Path) -> int:
    import cv2
    import numpy as np
    from PIL import Image

    total = 0
    for split in ("train", "val"):
        images_dir = out_dir / "images" / split
        masks_dir = out_dir / "masks" / split
        images_dir.mkdir(parents=True, exist_ok=True)
        masks_dir.mkdir(parents=True, exist_ok=True)

        samples = read_split(root, split)
        skipped = 0
        for index, sample_rel in enumerate(samples):
            folder = root / sample_rel
            svg = folder / "model.svg"
            png = folder / "F1_scaled.png"
            if not svg.exists() or not png.exists():
                skipped += 1
                continue

            try:
                parsed = parse_model_svg(svg)
                width, height = Image.open(png).size
            except Exception:
                skipped += 1
                continue
            if not parsed.walls:
                skipped += 1
                continue

            mask = np.zeros((height, width), dtype=np.uint8)
            for polygon in parsed.walls:
                points = np.array(polygon, dtype=np.int32).reshape(-1, 2)
                cv2.fillPoly(mask, [points], color=255)

            stem = sample_rel.replace("/", "_").replace("\\", "_")
            link_or_copy(png, images_dir / f"{stem}.png")
            cv2.imwrite(str(masks_dir / f"{stem}.png"), mask)
            total += 1
            if (index + 1) % 500 == 0:
                print(f"  {split}: {index + 1}/{len(samples)} processed…")

        print(f"{split}: {len(samples) - skipped} converted, {skipped} skipped")

    return total


def convert_coco(coco_json: Path, out_dir: Path) -> int:
    import cv2
    import numpy as np

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
    (out_dir / "images" / "train").mkdir(parents=True, exist_ok=True)
    (out_dir / "masks" / "train").mkdir(parents=True, exist_ok=True)

    masks: dict[int, "np.ndarray"] = {}
    for annotation in coco["annotations"]:
        if annotation["category_id"] not in wall_ids:
            continue
        segmentation = annotation.get("segmentation")
        image = images.get(annotation["image_id"])
        if not image or not segmentation:
            continue
        mask = masks.setdefault(
            image["id"], np.zeros((image["height"], image["width"]), dtype=np.uint8)
        )
        for polygon in segmentation:
            points = np.array(polygon, dtype=np.int32).reshape(-1, 2)
            cv2.fillPoly(mask, [points], color=255)

    count = 0
    for image_id, mask in masks.items():
        source = coco_json.parent / Path(images[image_id]["file_name"]).name
        if not source.exists():
            continue
        link_or_copy(source, out_dir / "images" / "train" / source.name)
        cv2.imwrite(str(out_dir / "masks" / "train" / (source.stem + ".png")), mask)
        count += 1
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    require_dataset_name(args.dataset)
    raw = require_raw(args.dataset)
    out_dir = versioned_output(DATA_UNET, args.dataset, args.force)

    svg_root = cubicasa_root(raw)
    if svg_root:
        print(f"CubiCasa SVG layout detected at {svg_root}")
        count = convert_cubicasa(svg_root, out_dir)
    else:
        coco_files = [
            f
            for f in raw.rglob("*.json")
            if "coco" in f.name.lower() or "annotations" in f.name.lower()
        ]
        if not coco_files:
            die(f"No CubiCasa SVG layout or COCO annotation JSON under {raw}.")
            return
        count = convert_coco(coco_files[0], out_dir)

    if count == 0:
        die("Rendered 0 masks — check the wall annotations in the source data.")
    print(f"Rendered {count} wall masks -> {out_dir}")
    print(f"Next: python scripts/verify_dataset.py --dataset {args.dataset} --format unet")


if __name__ == "__main__":
    main()
