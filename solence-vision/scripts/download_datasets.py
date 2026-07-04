"""Download raw datasets into data/raw/<dataset>/ (idempotent).

Usage:
    python scripts/download_datasets.py --dataset cubicasa5k

Kaggle-hosted datasets need Kaggle credentials (~/.kaggle/kaggle.json or
KAGGLE_USERNAME/KAGGLE_KEY env vars). Gated datasets (RPLAN) cannot be
scripted — the script tells you how to request access instead.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from _common import DATA_RAW, DATASETS, die, require_dataset_name


def download(name: str) -> None:
    require_dataset_name(name)
    target = DATA_RAW / name
    if target.exists() and any(target.iterdir()):
        print(f"data/raw/{name} already present — skipping download (delete it to re-pull).")
        return

    spec = DATASETS[name]
    if not spec["kaggle"]:
        die(
            f"'{name}' has no automated source. {spec['notes']} "
            f"Place the files manually under {target}."
        )

    try:
        import kagglehub
    except ImportError:
        die("kagglehub is not installed — pip install -r requirements.txt first.")

    print(f"Downloading {spec['kaggle']} from Kaggle (this can take a while)…")
    try:
        cache_path = kagglehub.dataset_download(spec["kaggle"])
    except Exception as error:  # noqa: BLE001
        die(
            f"Kaggle download failed: {error}. "
            "Check your Kaggle credentials (~/.kaggle/kaggle.json) and network."
        )
        return

    target.mkdir(parents=True, exist_ok=True)
    shutil.copytree(cache_path, target, dirs_exist_ok=True)
    print(f"Done. Files in {target}")
    print(f"Next: python scripts/convert_to_yolo.py --dataset {name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True, choices=sorted(DATASETS))
    args = parser.parse_args()
    DATA_RAW.mkdir(parents=True, exist_ok=True)
    download(args.dataset)
