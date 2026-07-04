"""Train the YOLO door/window/room head.

Usage:
    python scripts/train_yolo.py --dataset cubicasa5k [--epochs 100] [--base yolo11n-seg.pt]

Saves best weights to models/yolo/best.pt (previous weights are kept as
best-<timestamp>.pt, never silently overwritten). Needs a GPU for
realistic training times; see HOW-TO.md for cloud options.
"""

from __future__ import annotations

import argparse
import shutil
from datetime import datetime

from _common import DATA_YOLO, MODELS_YOLO, die, require_dataset_name


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=1024)
    parser.add_argument("--base", default="yolo11n-seg.pt")
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

    model = YOLO(args.base)
    results = model.train(
        data=str(data_yaml), epochs=args.epochs, imgsz=args.imgsz, task="segment"
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
