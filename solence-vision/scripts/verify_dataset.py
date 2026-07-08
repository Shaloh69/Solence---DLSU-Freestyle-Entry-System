"""Sanity-check a converted dataset before training on it.

Usage:
    python scripts/verify_dataset.py --dataset cubicasa5k --format yolo
    python scripts/verify_dataset.py --dataset cubicasa5k --format unet

Checks label/image parity per split, prints class distribution (YOLO)
or wall-pixel coverage stats (U-Net), and renders overlay previews to
data/_previews/ — label polygons drawn over the actual image — for a
human to eyeball before any GPU time is spent.
"""

from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

from _common import DATA_PREVIEWS, DATA_UNET, DATA_YOLO, die, require_dataset_name
from cubicasa_svg import CLASSES

PREVIEW_COLORS = [
    (66, 133, 244),   # door — blue
    (52, 168, 83),    # window — green
    (244, 180, 0),    # room_kitchen — yellow
    (219, 68, 55),    # room_bathroom — red
    (171, 71, 188),   # room_bedroom — purple
    (0, 172, 193),    # room_living — cyan
    (255, 112, 67),   # room_garage — orange
    (120, 144, 156),  # room_other — grey
]


def splits_of(root: Path, kind: str) -> list[str]:
    base = root / kind
    if not base.exists():
        return []
    return [d.name for d in base.iterdir() if d.is_dir()] or []


def verify_yolo(root: Path) -> None:
    splits = splits_of(root, "images")
    if not splits:
        die(f"No images/<split>/ under {root} — run convert_to_yolo.py first.")

    counts: Counter[str] = Counter()
    total_images = 0
    for split in splits:
        images = sorted((root / "images" / split).glob("*"))
        labels = sorted((root / "labels" / split).glob("*.txt"))
        if len(images) != len(labels):
            die(
                f"{split}: image/label mismatch — {len(images)} images vs "
                f"{len(labels)} labels."
            )
        total_images += len(images)
        for label in labels:
            for line in label.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    index = int(line.split()[0])
                    counts[CLASSES[index] if index < len(CLASSES) else str(index)] += 1
        print(f"{split}: {len(images)} image/label pairs")

    print(f"total: {total_images} images")
    print("class distribution:")
    for name in CLASSES:
        print(f"  {name:16s} {counts.get(name, 0)}")

    missing = [name for name in ("door", "window") if counts.get(name, 0) == 0]
    if missing:
        die(f"No instances at all for: {', '.join(missing)} — conversion is broken.")

    render_yolo_previews(root, splits[0])


def render_yolo_previews(root: Path, split: str) -> None:
    try:
        import cv2
        import numpy as np
    except ImportError:
        die("opencv/numpy missing — pip install -r requirements.txt first.")
        return

    DATA_PREVIEWS.mkdir(parents=True, exist_ok=True)
    images = sorted((root / "images" / split).glob("*"))[:6]
    for image_path in images:
        image = cv2.imread(str(image_path))
        if image is None:
            continue
        label_path = root / "labels" / split / (image_path.stem + ".txt")
        height, width = image.shape[:2]
        for line in label_path.read_text(encoding="utf-8").splitlines():
            parts = line.split()
            if len(parts) < 7:
                continue
            cls_index = int(parts[0])
            values = [float(v) for v in parts[1:]]
            points = np.array(
                [
                    (values[i] * width, values[i + 1] * height)
                    for i in range(0, len(values) - 1, 2)
                ],
                dtype=np.int32,
            )
            color = PREVIEW_COLORS[cls_index % len(PREVIEW_COLORS)]
            cv2.polylines(image, [points], True, color, 2)
            cv2.putText(
                image,
                CLASSES[cls_index],
                tuple(points[0]),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2,
            )
        out = DATA_PREVIEWS / f"yolo-{image_path.stem}.png"
        cv2.imwrite(str(out), image)
    print(f"Previews with drawn labels -> {DATA_PREVIEWS} — eyeball them before training.")


def verify_unet(root: Path) -> None:
    try:
        import cv2
    except ImportError:
        die("opencv/numpy missing — pip install -r requirements.txt first.")
        return

    splits = splits_of(root, "images")
    if not splits:
        die(f"No images/<split>/ under {root} — run convert_to_unet_masks.py first.")

    coverages: list[float] = []
    for split in splits:
        images = sorted((root / "images" / split).glob("*"))
        masks = sorted((root / "masks" / split).glob("*.png"))
        if len(images) != len(masks):
            die(f"{split}: image/mask mismatch — {len(images)} vs {len(masks)}.")
        print(f"{split}: {len(images)} image/mask pairs")
        for mask_path in masks[:150]:
            mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
            if mask is not None:
                coverages.append(float((mask > 0).mean()))

    mean = sum(coverages) / max(1, len(coverages))
    print(f"mean wall coverage {mean:.1%} (sampled {len(coverages)})")
    if mean < 0.005 or mean > 0.6:
        die(
            f"Wall coverage {mean:.1%} looks wrong (expected roughly 1-30%) — "
            "the conversion likely mislabeled the wall class."
        )

    # Overlay previews: mask tinted red over the image.
    DATA_PREVIEWS.mkdir(parents=True, exist_ok=True)
    split = splits[0]
    for image_path in sorted((root / "images" / split).glob("*"))[:6]:
        image = cv2.imread(str(image_path))
        mask_path = root / "masks" / split / (image_path.stem + ".png")
        if image is None or not mask_path.exists():
            continue
        mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
        image[mask > 0] = (0.4 * image[mask > 0] + [0, 0, 153]).astype("uint8")
        cv2.imwrite(str(DATA_PREVIEWS / f"unet-{image_path.stem}.png"), image)
    print(f"Previews with tinted wall masks -> {DATA_PREVIEWS}")


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
