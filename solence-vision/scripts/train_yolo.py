"""Train the YOLO26 door/window/room head.

YOLO26 is end-to-end NMS-free by default; the training/predict API is
unchanged from earlier Ultralytics models. Pick the scale with --model
(n/s/m/l/x-seg): m is the default target per Phase 2 §6.4 — nano only
for smoke tests, l/x once label coverage stops being the bottleneck.

Usage:
    python scripts/train_yolo.py --dataset cubicasa5k \
        [--model yolo26m-seg.pt] [--epochs 100] [--imgsz 1024] [--batch 8]
    python scripts/train_yolo.py --dataset cubicasa5k --resume <run>/weights/last.pt

Runs are written under <SOLENCE_VISION_DATA>/runs/yolo/ (see _common.py).

Augmentation is configured for line-drawing floor plans, not photos
(Phase 2 §7.2) — see FLOORPLAN_AUGMENTATION below and HOW-TO.md for the
reasoning. Saves best weights to models/yolo/best.pt (previous weights
are kept as best-<timestamp>.pt, never silently overwritten). Needs a
GPU for realistic training times; see HOW-TO.md for cloud options.
"""

from __future__ import annotations

import argparse
import shutil
from datetime import datetime

from _common import DATA_YOLO, MODELS_YOLO, RUNS, die, require_dataset_name

# Floor plans are near-monochrome line drawings — several Ultralytics
# defaults are tuned for natural photos and are wrong here (§7.2):
#  - hsv_h/hsv_s off: hue/saturation jitter optimizes for variation that
#    barely exists in the input distribution and hurts thin-line contrast.
#  - hsv_v kept tiny: mild brightness variation ~= scan/print exposure.
#  - mixup off: alpha-blending two floor plans is not a meaningful sample.
#  - flips + rotation kept: plans have no fixed "up" and arbitrary
#    drafting orientations, so these are legitimate cheap variety.
FLOORPLAN_AUGMENTATION = {
    "fliplr": 0.5,
    "flipud": 0.5,
    "degrees": 90.0,
    "hsv_h": 0.0,
    "hsv_s": 0.0,
    "hsv_v": 0.1,
    "mixup": 0.0,
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=1024)
    parser.add_argument(
        "--model",
        "--base",
        dest="model",
        default="yolo26m-seg.pt",
        help="model scale: yolo26{n,s,m,l,x}-seg.pt (default m per §6.4)",
    )
    parser.add_argument(
        "--batch",
        type=int,
        default=-1,
        help="batch size (-1 = Ultralytics auto-batch from available VRAM)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=0,
        # On Windows every worker is a new process that loads torch + CUDA
        # (GBs of commit each), and validation adds more: the default 8,
        # then 2, both exhausted the 16 GB laptop's commit limit.
        help="dataloader worker processes (0 = load in the training process)",
    )
    parser.add_argument(
        "--resume",
        default="",
        help="continue an interrupted run from its weights/last.pt (keeps that run's settings)",
    )
    args = parser.parse_args()

    require_dataset_name(args.dataset)
    data_yaml = DATA_YOLO / args.dataset / "data.yaml"
    if not data_yaml.exists():
        die(
            f"{data_yaml} not found — run "
            f"'python scripts/convert_to_yolo.py --dataset {args.dataset}' first."
        )

    try:
        from ultralytics import YOLO
    except ImportError:
        die("ultralytics missing — pip install -r requirements.txt first.")
        return

    if args.resume:
        model = YOLO(args.resume)
        results = model.train(resume=True)
    else:
        model = YOLO(args.model)
        results = model.train(
            data=str(data_yaml),
            epochs=args.epochs,
            imgsz=args.imgsz,
            batch=args.batch,
            workers=args.workers,
            task="segment",
            project=str(RUNS / "yolo"),
            name=args.dataset,
            **FLOORPLAN_AUGMENTATION,
        )

    MODELS_YOLO.mkdir(parents=True, exist_ok=True)
    target = MODELS_YOLO / "best.pt"
    if target.exists():
        backup = MODELS_YOLO / f"best-{datetime.now():%Y%m%d-%H%M%S}.pt"
        shutil.move(target, backup)
        print(f"Previous weights kept as {backup}")
    shutil.copy2(results.save_dir / "weights" / "best.pt", target)
    print(f"Saved {target}")
    print("Next: pytest tests/ — validate the model before wiring it into the API.")


if __name__ == "__main__":
    main()
