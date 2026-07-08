"""Train the U-Net wall-segmentation head.

Usage:
    python scripts/train_unet.py --dataset cubicasa5k [--epochs 40] [--encoder resnet34]

Saves the full model to models/unet/best.pt (previous weights kept as
best-<timestamp>.pt). Needs a GPU for realistic training times.
"""

from __future__ import annotations

import argparse
import shutil
from datetime import datetime
from pathlib import Path

from _common import DATA_UNET, MODELS_UNET, die, require_dataset_name


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--encoder", default="resnet34")
    parser.add_argument("--imgsz", type=int, default=512)
    parser.add_argument("--batch", type=int, default=8)
    args = parser.parse_args()

    require_dataset_name(args.dataset)
    root = DATA_UNET / args.dataset
    if not (root / "images" / "train").exists():
        die(
            f"{root}/images/train not found — run "
            f"'python scripts/convert_to_unet_masks.py --dataset {args.dataset}' first."
        )

    try:
        import cv2
        import numpy as np
        import segmentation_models_pytorch as smp
        import torch
        from torch.utils.data import DataLoader, Dataset
    except ImportError:
        die("torch/smp missing — pip install -r requirements.txt first.")
        return

    class WallDataset(Dataset):
        def __init__(self, root: Path, split: str, imgsz: int):
            self.images = sorted((root / "images" / split).glob("*"))
            self.masks_dir = root / "masks" / split
            self.imgsz = imgsz

        def __len__(self) -> int:
            return len(self.images)

        def __getitem__(self, index: int):
            image_path = self.images[index]
            image = cv2.cvtColor(cv2.imread(str(image_path)), cv2.COLOR_BGR2RGB)
            mask = cv2.imread(
                str(self.masks_dir / (image_path.stem + ".png")),
                cv2.IMREAD_GRAYSCALE,
            )
            image = cv2.resize(image, (self.imgsz, self.imgsz))
            mask = cv2.resize(mask, (self.imgsz, self.imgsz))
            x = torch.from_numpy(image.astype(np.float32) / 255).permute(2, 0, 1)
            y = torch.from_numpy((mask > 127).astype(np.float32)).unsqueeze(0)
            return x, y

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        print("WARNING: no CUDA device — training on CPU will be very slow.")

    model = smp.Unet(args.encoder, encoder_weights="imagenet", classes=1).to(device)
    train_loader = DataLoader(
        WallDataset(root, "train", args.imgsz),
        batch_size=args.batch,
        shuffle=True,
    )
    val_dataset = WallDataset(root, "val", args.imgsz)
    val_loader = (
        DataLoader(val_dataset, batch_size=args.batch, shuffle=False)
        if len(val_dataset) > 0
        else None
    )
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
    loss_fn = smp.losses.DiceLoss(mode="binary")

    for epoch in range(args.epochs):
        model.train()
        total = 0.0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            loss = loss_fn(model(x), y)
            loss.backward()
            optimizer.step()
            total += loss.item()
        train_loss = total / max(1, len(train_loader))

        val_msg = ""
        if val_loader is not None:
            model.eval()
            val_total = 0.0
            with torch.no_grad():
                for x, y in val_loader:
                    x, y = x.to(device), y.to(device)
                    val_total += loss_fn(model(x), y).item()
            val_msg = f" val_loss {val_total / max(1, len(val_loader)):.4f}"

        print(f"epoch {epoch + 1}/{args.epochs} loss {train_loss:.4f}{val_msg}")

    MODELS_UNET.mkdir(parents=True, exist_ok=True)
    target = MODELS_UNET / "best.pt"
    if target.exists():
        backup = MODELS_UNET / f"best-{datetime.now():%Y%m%d-%H%M%S}.pt"
        shutil.move(target, backup)
        print(f"Previous weights kept as {backup}")
    torch.save(model.cpu(), target)
    print(f"Saved {target}")
    print("Next: pytest tests/ — validate the model before wiring it into the API.")


if __name__ == "__main__":
    main()
