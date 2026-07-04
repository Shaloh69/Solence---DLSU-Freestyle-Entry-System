"""Run the fused pipeline on a single image for manual sanity-checking.

Usage:
    python scripts/run_inference.py --image path/to/floorplan.png [--out result.json]

Requires trained weights in models/unet/ and models/yolo/ — the error
message tells you which training script to run if they're missing.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from _common import die  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", required=True)
    parser.add_argument("--out", default="inference-result.json")
    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        die(f"{image_path} does not exist.")

    try:
        import numpy as np
        from PIL import Image

        from app.models import ModelsNotAvailable
        from app.pipeline import run_pipeline
    except ImportError as error:
        die(f"Dependencies missing ({error}) — pip install -r requirements.txt first.")
        return

    rgb = np.asarray(Image.open(image_path).convert("RGB"))
    try:
        result = run_pipeline(rgb, lambda stage, message: print(f"[{stage}] {message}"))
    except ModelsNotAvailable as error:
        die(str(error))
        return

    Path(args.out).write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(
        f"Wrote {args.out}: {len(result['walls'])} wall polygons, "
        f"{len(result['openings'])} openings, {len(result['rooms'])} rooms."
    )


if __name__ == "__main__":
    main()
