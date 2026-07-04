"""Sanity-check a converted dataset before training on it.

Usage:
    python scripts/verify_dataset.py --dataset cubicasa5k --format yolo
    python scripts/verify_dataset.py --dataset cubicasa5k --format unet

Checks label/image count parity, prints class distribution (YOLO) or
wall-pixel coverage stats (U-Net), and renders a handful of overlays to
data/_previews/ for a human to eyeball.
"""

from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

from _common import DATA_PREVIEWS, DATA_UNET, DATA_YOLO, die, require_dataset_name


def verify_yolo(root: Path) -> None:
    images = sorted((root / "images").glob("*"))
    labels = sorted((root / "labels").glob("*.txt"))
    if not images:
        die(f"No images in {root}/images — run convert_to_yolo.py first.")
    if len(images) != len(labels):
        die(f"Image/label mismatch: {len(images)} images vs {len(labels)} labels.")

    counts: Counter[str] = Counter()
    for label in labels:
        for line in label.read_text(encoding="utf-8").splitlines():
            if line.strip():
                counts[line.split()[0]] += 1
    print(f"{len(images)} images, class distribution (by class index): {dict(counts)}")
    render_previews(root / "images", None, "yolo")


def verify_unet(root: Path) -> None:
    try:
        import cv2
        import numpy as np
    except ImportError:
        die("opencv/numpy missing — pip install -r requirements.txt first.")
        return

    images = sorted((root / "images").glob("*"))
    masks = sorted((root / "masks").glob("*.png"))
    if not images:
        die(f"No images in {root}/images — run convert_to_unet_masks.py first.")
    if len(images) != len(masks):
        die(f"Image/mask mismatch: {len(images)} vs {len(masks)}.")

    coverages = []
    for mask_path in masks[:200]:
        mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
        coverages.append(float((mask > 0).mean()))
    mean = sum(coverages) / len(coverages)
    print(f"{len(images)} image/mask pairs; mean wall coverage {mean:.1%}")
    if mean < 0.005 or mean > 0.6:
        die(
            f"Wall coverage {mean:.1%} looks wrong (expected roughly 1-30%) — "
            "the conversion likely mislabeled the wall category."
        )
    render_previews(root / "images", root / "masks", "unet")


def render_previews(images_dir: Path, masks_dir: Path | None, tag: str) -> None:
    try:
        import cv2
    except ImportError:
        return
    DATA_PREVIEWS.mkdir(parents=True, exist_ok=True)
    for image_path in sorted(images_dir.glob("*"))[:5]:
        image = cv2.imread(str(image_path))
        if image is None:
            continue
        if masks_dir:
            mask_path = masks_dir / (image_path.stem + ".png")
            if mask_path.exists():
                mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
                image[mask > 0] = (0.5 * image[mask > 0] + [0, 0, 127]).astype("uint8")
        out = DATA_PREVIEWS / f"{tag}-{image_path.stem}.png"
        cv2.imwrite(str(out), image)
    print(f"Previews written to {DATA_PREVIEWS} — eyeball them before training.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--format", required=True, choices=["yolo", "unet"])
    args = parser.parse_args()
    require_dataset_name(args.dataset)
    root = (DATA_YOLO if args.format == "yolo" else DATA_UNET) / args.dataset
    if not root.exists():
        die(f"{root} does not exist — run the matching convert script first.")
    (verify_yolo if args.format == "yolo" else verify_unet)(root)
