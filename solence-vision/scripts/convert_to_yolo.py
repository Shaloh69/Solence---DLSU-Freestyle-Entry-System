"""Convert a raw dataset into YOLO instance-segmentation format.

Usage:
    python scripts/convert_to_yolo.py --dataset cubicasa5k [--force]

Output: data/yolo/<dataset>/ with images/, labels/, data.yaml.

CubiCasa5K ships SVG polygon annotations; the COCO-converted mirror
(https://github.com/xmarva/floorplan-detection) already did most of this
work — prefer downloading that and converting COCO -> YOLO here rather
than parsing SVGs from scratch.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from _common import DATA_YOLO, die, require_dataset_name, require_raw, versioned_output

CLASSES = ["door", "window", "room_kitchen", "room_bathroom", "room_bedroom",
           "room_living", "room_garage", "room_other"]


def convert_coco_to_yolo(coco_json: Path, images_dir: Path, out_dir: Path) -> int:
    """COCO instance-seg JSON -> YOLO labels. Returns image count."""
    with open(coco_json, encoding="utf-8") as handle:
        coco = json.load(handle)

    categories = {c["id"]: c["name"] for c in coco["categories"]}
    images = {i["id"]: i for i in coco["images"]}
    (out_dir / "labels").mkdir(parents=True, exist_ok=True)
    (out_dir / "images").mkdir(parents=True, exist_ok=True)

    per_image: dict[int, list[str]] = {}
    for annotation in coco["annotations"]:
        image = images.get(annotation["image_id"])
        name = categories.get(annotation["category_id"], "")
        if not image or name not in CLASSES or not annotation.get("segmentation"):
            continue
        width, height = image["width"], image["height"]
        cls_index = CLASSES.index(name)
        for polygon in annotation["segmentation"]:
            normalized = []
            for i in range(0, len(polygon), 2):
                normalized.append(f"{polygon[i] / width:.6f}")
                normalized.append(f"{polygon[i + 1] / height:.6f}")
            per_image.setdefault(image["id"], []).append(
                f"{cls_index} " + " ".join(normalized)
            )

    import shutil

    count = 0
    for image_id, lines in per_image.items():
        image = images[image_id]
        source = images_dir / image["file_name"]
        if not source.exists():
            continue
        shutil.copy2(source, out_dir / "images" / source.name)
        label = out_dir / "labels" / (source.stem + ".txt")
        label.write_text("\n".join(lines), encoding="utf-8")
        count += 1
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    require_dataset_name(args.dataset)
    raw = require_raw(args.dataset)
    out_dir = versioned_output(DATA_YOLO, args.dataset, args.force)

    coco_files = list(raw.rglob("*.json"))
    coco_json = next(
        (f for f in coco_files if "coco" in f.name.lower() or "annotations" in f.name.lower()),
        None,
    )
    if not coco_json:
        die(
            f"No COCO annotation JSON found under {raw}. For CubiCasa5K, "
            "download the COCO-converted mirror (see scripts/_common.py notes) "
            "or write an SVG parser for the official release."
        )
        return

    images_dir = coco_json.parent
    count = convert_coco_to_yolo(coco_json, images_dir, out_dir)
    if count == 0:
        die(
            "Converted 0 images — the annotation categories may not match "
            f"the expected classes {CLASSES}. Inspect {coco_json} and adjust CLASSES."
        )

    (out_dir / "data.yaml").write_text(
        "path: .\ntrain: images\nval: images\nnames:\n"
        + "\n".join(f"  {i}: {name}" for i, name in enumerate(CLASSES)),
        encoding="utf-8",
    )
    print(f"Converted {count} images -> {out_dir}")
    print(f"Next: python scripts/verify_dataset.py --dataset {args.dataset} --format yolo")


if __name__ == "__main__":
    main()
