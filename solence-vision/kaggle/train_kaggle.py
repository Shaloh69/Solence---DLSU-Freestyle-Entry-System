"""solence-vision training on a Kaggle GPU (item V0c).

Runs as a private Kaggle script kernel (kernel-metadata.json, pushed with
`kaggle kernels push -p solence-vision/kaggle`). It:

1. clones the `revamp` branch of the public repo,
2. converts CubiCasa5K (attached Kaggle dataset qmarva/cubicasa5k) with
   the repo's own scripts — same capped images and labels as the laptop,
3. resumes the laptop YOLO run from its last.pt (attached private dataset
   solence-yolo-resume), rewriting the checkpoint's Windows paths and
   using a Linux-sized batch and dataloader workers,
4. trains the U-Net walls model,
5. writes best.pt / last.pt to /kaggle/working/out (the kernel's output),
   mirroring checkpoints there every few minutes so a session timeout
   keeps the latest epoch.

CubiCasa5K is CC BY-NC-SA 4.0: these weights are research/demo-only (V5).
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

REPO = "https://github.com/Shaloh69/Solence---DLSU-Freestyle-Entry-System.git"
BRANCH = "revamp"
INPUT = Path("/kaggle/input")
OUT = Path("/kaggle/working/out")
DATA = Path("/tmp/solence-data")  # big intermediate data stays out of the saved output
SRC = Path("/tmp/Solence")
YOLO_BATCH = 16
YOLO_WORKERS = 4  # Linux forks workers cheaply; the laptop's 0 was a Windows commit-limit workaround
UNET_BATCH = 16
MIRROR_SECONDS = 300


def run(cmd: list[str], **kwargs) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, **kwargs)


def find(name: str) -> Path:
    hit = next(INPUT.rglob(name), None)
    if hit is None:
        raise SystemExit(f"{name} not found under {INPUT} — is the dataset attached?")
    return hit


def mirror_now() -> None:
    """Copy the newest checkpoints + results into the kernel output."""
    for kind in ("yolo", "unet"):
        for f in (DATA / "runs" / kind).rglob("*"):
            if f.name in {"last.pt", "best.pt", "results.csv"} and f.is_file():
                target = OUT / "checkpoints" / kind / f.name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, target)


def mirror(stop: threading.Event) -> None:
    while not stop.wait(MIRROR_SECONDS):
        mirror_now()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    run(["git", "clone", "--depth", "1", "--branch", BRANCH, REPO, str(SRC)])
    vision = SRC / "solence-vision"
    py = sys.executable
    run([py, "-m", "pip", "install", "-q", "ultralytics==8.4.183",
         "segmentation-models-pytorch>=0.3.4", "albumentations>=1.4", "scikit-image>=0.24"])

    env = {**os.environ, "SOLENCE_VISION_DATA": str(DATA)}
    raw = DATA / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    # Our converters look for the CubiCasa layout (train.txt + model.svg) under raw/cubicasa5k.
    os.symlink(find("train.txt").parent, raw / "cubicasa5k", target_is_directory=True)

    run([py, "scripts/convert_to_yolo.py", "--dataset", "cubicasa5k"], cwd=vision, env=env)
    run([py, "scripts/convert_to_unet_masks.py", "--dataset", "cubicasa5k"], cwd=vision, env=env)
    run([py, "scripts/verify_dataset.py", "--dataset", "cubicasa5k", "--format", "yolo"], cwd=vision, env=env)

    # Resume the laptop run: same checkpoint, Kaggle paths, Linux batch/workers.
    import torch

    run_dir = DATA / "runs" / "yolo" / "cubicasa5k"
    (run_dir / "weights").mkdir(parents=True, exist_ok=True)
    ckpt = torch.load(find("last.pt"), map_location="cpu", weights_only=False)  # our own checkpoint
    ckpt["train_args"].update(
        data=str(DATA / "yolo" / "cubicasa5k" / "data.yaml"),
        project=str(DATA / "runs" / "yolo"),
        name="cubicasa5k",
        save_dir=str(run_dir),
        model=str(run_dir / "weights" / "last.pt"),
        exist_ok=True,
        batch=YOLO_BATCH,
        workers=YOLO_WORKERS,
        device=0,
    )
    torch.save(ckpt, run_dir / "weights" / "last.pt")
    resumed_csv = next(INPUT.rglob("results.csv"), None)
    if resumed_csv:
        shutil.copy2(resumed_csv, run_dir / "results.csv")
    print(f"Resuming after epoch {ckpt.get('epoch')} (0-based)", flush=True)

    stop = threading.Event()
    threading.Thread(target=mirror, args=(stop,), daemon=True).start()
    try:
        run([py, "scripts/train_yolo.py", "--dataset", "cubicasa5k",
             "--resume", str(run_dir / "weights" / "last.pt")], cwd=vision, env=env)
        (OUT / "yolo").mkdir(parents=True, exist_ok=True)
        shutil.copy2(vision / "models" / "yolo" / "best.pt", OUT / "yolo" / "best.pt")

        run([py, "scripts/train_unet.py", "--dataset", "cubicasa5k", "--imgsz", "512",
             "--batch", str(UNET_BATCH), "--epochs", "40"], cwd=vision, env=env)
        (OUT / "unet").mkdir(parents=True, exist_ok=True)
        shutil.copy2(vision / "models" / "unet" / "best.pt", OUT / "unet" / "best.pt")
    finally:
        stop.set()
        mirror_now()
    print("DONE — weights in /kaggle/working/out", flush=True)


if __name__ == "__main__":
    main()
