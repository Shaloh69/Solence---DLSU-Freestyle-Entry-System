"""The staged recognition pipeline (section 7.4).

Stages: queued -> running_wall_segmentation -> running_detection ->
fusing -> done (or error). Each stage change is reported through a
callback so the API layer can stream progress over WebSocket.

The real model inference lives behind models.py; the pipeline itself is
model-agnostic so tests can substitute stub predictors.
"""

from __future__ import annotations

from typing import Any, Callable, Protocol

import numpy as np

from .fusion import Detection, fuse

ProgressCallback = Callable[[str, str], None]  # (stage, message)


class WallPredictor(Protocol):
    def __call__(self, image: np.ndarray) -> np.ndarray: ...


class OpeningPredictor(Protocol):
    def __call__(self, image: np.ndarray) -> list[Detection]: ...


def default_wall_predictor(image: np.ndarray) -> np.ndarray:
    """U-Net wall segmentation over an RGB image -> boolean mask."""
    import torch  # deferred: heavy import

    from .models import load_unet

    model = load_unet()
    tensor = (
        torch.from_numpy(image.astype(np.float32) / 255.0)
        .permute(2, 0, 1)
        .unsqueeze(0)
    )
    with torch.no_grad():
        logits = model(tensor)
    return (logits.squeeze().sigmoid().numpy() > 0.5)


def default_opening_predictor(image: np.ndarray) -> list[Detection]:
    """YOLO doors/windows/rooms over an RGB image."""
    from .models import load_yolo

    model = load_yolo()
    results = model.predict(image, verbose=False)
    detections: list[Detection] = []
    for result in results:
        names = result.names
        for box in result.boxes:
            detections.append(
                Detection(
                    cls=names[int(box.cls)],
                    confidence=float(box.conf),
                    box=tuple(float(v) for v in box.xyxy[0].tolist()),
                )
            )
    return detections


def run_pipeline(
    image: np.ndarray,
    on_progress: ProgressCallback,
    wall_predictor: WallPredictor | None = None,
    opening_predictor: OpeningPredictor | None = None,
) -> dict[str, Any]:
    """Run the full fused pipeline over an RGB image array."""
    wall_predictor = wall_predictor or default_wall_predictor
    opening_predictor = opening_predictor or default_opening_predictor

    on_progress("running_wall_segmentation", "Segmenting walls (U-Net)")
    wall_mask = wall_predictor(image)

    on_progress("running_detection", "Detecting doors/windows/rooms (YOLO)")
    detections = opening_predictor(image)

    on_progress("fusing", "Fusing wall mask with detections")
    result = fuse(wall_mask, detections)

    on_progress("done", "Recognition complete")
    return result
