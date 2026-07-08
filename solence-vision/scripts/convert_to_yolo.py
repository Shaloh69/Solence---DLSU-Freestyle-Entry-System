"""Convert a raw dataset into YOLO instance-segmentation format.

Usage:
    python scripts/convert_to_yolo.py --dataset cubicasa5k [--force]

Output: data/yolo/<dataset>/ with images/{train,val}/, labels/{train,val}/,
and data.yaml (classes: door, window, room_* — see cubicasa_svg.CLASSES).

Two source layouts are supported, detected automatically:
1. CubiCasa5K original (model.svg per sample + train/val/test.txt) —
   the SVG polygons are parsed directly (brief §7.3). Images are
   hardlinked when possible to avoid duplicating ~5 GB.
2. Generic COCO instance-seg JSON (any dataset providing polygon
   segmentation with matching category names).

Note: the Kaggle mirror's bundled cubicasa5k_coco JSONs are bbox-only
(wall/room, no doors/windows/room-types) and are deliberately ignored.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
from pathlib import Path

from _common import DATA_YOLO, die, require_dataset_name, require_raw, versioned_output
from cubicasa_svg import (
    CLASSES,
    Polygon,
    cubicasa_root,
    parse_model_svg,
    read_split,
)


def link_or_copy(source: Path, target: Path) -> None:
    """Hardlink (same-volume, instant, no extra space) or fall back to copy."""
    if target.exists():
        return
    try:
        os.link(source, target)
    except OSError:
        shutil.copy2(source, target)


def normalize(polygon: Polygon, width: int, height: int) -> list[str] | None:
    if width <= 0 or height <= 0:
        return None
    values: list[str] = []
    for x, y in polygon:
        values.append(f"{min(1, max(0, x / width)):.6f}")
        values.append(f"{min(1, max(0, y / height)):.6f}")
    return values if len(values) >= 6 else None


def write_data_yaml(out_dir: Path) -> None:
    # Ultralytics resolves a relative "path:" against its OWN cwd/global
    # datasets_dir, not against the yaml file's directory — "path: ." only
    # works if you happen to run training from inside out_dir. Write the
    # absolute path so training works from any cwd, on any machine.
    root = out_dir.resolve().as_posix()

    (out_dir / "data.yaml").write_text(
        f"path: {root}\ntrain: images/train\nval: images/val\nnames:\n"
        + "\n".join(f"  {i}: {name}" for i, name in enumerate(CLASSES)),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# CubiCasa5K SVG layout
# ---------------------------------------------------------------------------

def convert_cubicasa(root: Path, out_dir: Path) -> int:
    from PIL import Image

    total = 0
    for split in ("train", "val"):
        images_dir = out_dir / "images" / split
        labels_dir = out_dir / "labels" / split
        images_dir.mkdir(parents=True, exist_ok=True)
        labels_dir.mkdir(parents=True, exist_ok=True)

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

            lines: list[str] = []
            labelled: list[tuple[str, Polygon]] = [
                *(("door", polygon) for polygon in parsed.doors),
                *(("window", polygon) for polygon in parsed.windows),
                *parsed.rooms,
            ]
            for class_name, polygon in labelled:
                values = normalize(polygon, width, height)
                if values:
                    lines.append(f"{CLASSES.index(class_name)} " + " ".join(values))

            if not lines:
                skipped += 1
                continue

            stem = sample_rel.replace("/", "_").replace("\\", "_")
            link_or_copy(png, images_dir / f"{stem}.png")
            (labels_dir / f"{stem}.txt").write_text(
                "\n".join(lines), encoding="utf-8"
            )
            total += 1
            if (index + 1) % 500 == 0:
                print(f"  {split}: {index + 1}/{len(samples)} processed…")

        print(f"{split}: {len(samples) - skipped} converted, {skipped} skipped")

    return total


# ---------------------------------------------------------------------------
# Generic COCO layout (polygon segmentation required)
# ---------------------------------------------------------------------------

def convert_coco(coco_json: Path, images_dir: Path, out_dir: Path) -> int:
    with open(coco_json, encoding="utf-8") as handle:
        coco = json.load(handle)

    categories = {c["id"]: c["name"] for c in coco["categories"]}
    images = {i["id"]: i for i in coco["images"]}
    (out_dir / "labels" / "train").mkdir(parents=True, exist_ok=True)
    (out_dir / "images" / "train").mkdir(parents=True, exist_ok=True)
    # Single-split fallback: point val at train in data.yaml consumers.
    (out_dir / "labels" / "val").mkdir(parents=True, exist_ok=True)
    (out_dir / "images" / "val").mkdir(parents=True, exist_ok=True)

    per_image: dict[int, list[str]] = {}
    for annotation in coco["annotations"]:
        image = images.get(annotation["image_id"])
        name = categories.get(annotation["category_id"], "")
        segmentation = annotation.get("segmentation")
        if not image or name not in CLASSES or not segmentation:
            continue
        width, height = image["width"], image["height"]
        cls_index = CLASSES.index(name)
        for polygon in segmentation:
            values = normalize(
                list(zip(polygon[0::2], polygon[1::2])), width, height
            )
            if values:
                per_image.setdefault(image["id"], []).append(
                    f"{cls_index} " + " ".join(values)
                )

    count = 0
    for image_id, lines in per_image.items():
        source = images_dir / Path(images[image_id]["file_name"]).name
        if not source.exists():
            continue
        link_or_copy(source, out_dir / "images" / "train" / source.name)
        (out_dir / "labels" / "train" / (source.stem + ".txt")).write_text(
            "\n".join(lines), encoding="utf-8"
        )
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
        coco_json = coco_files[0] if coco_files else None
        if not coco_json:
            die(
                f"Neither a CubiCasa SVG layout (train.txt + model.svg) nor a "
                f"COCO annotation JSON was found under {raw}."
            )
            return
        count = convert_coco(coco_json, coco_json.parent, out_dir)

    if count == 0:
        die(
            "Converted 0 images — annotations may be bbox-only (no polygon "
            f"segmentation) or category names may not match {CLASSES}."
        )

    write_data_yaml(out_dir)
    print(f"Converted {count} images -> {out_dir}")
    print(f"Next: python scripts/verify_dataset.py --dataset {args.dataset} --format yolo")


if __name__ == "__main__":
    main()
