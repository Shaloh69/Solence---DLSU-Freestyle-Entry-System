"""API contract tests via FastAPI's TestClient (HTTP + WebSocket)."""

from __future__ import annotations

import io

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import main as app_main
from app.fusion import Detection
from app.main import app
from app.models import models_status


client = TestClient(app)


def _png_bytes(image: np.ndarray) -> bytes:
    buffer = io.BytesIO()
    Image.fromarray(image).save(buffer, format="PNG")
    return buffer.getvalue()


def test_health_reports_model_status():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert set(body["models"]) == {"unet", "yolo"}


def test_recognize_503_when_models_missing(synthetic_image):
    if all(models_status().values()):
        pytest.skip("trained weights present — the 503 path does not apply")
    response = client.post(
        "/recognize",
        files={"image": ("plan.png", _png_bytes(synthetic_image), "image/png")},
    )
    assert response.status_code == 503
    assert "train" in response.json()["detail"].lower()


def test_job_flow_with_stubbed_models(
    monkeypatch, synthetic_image, synthetic_wall_mask
):
    """Full job flow (upload -> WS progress -> result) with stub predictors."""
    monkeypatch.setattr(
        app_main, "models_status", lambda: {"unet": True, "yolo": True}
    )
    monkeypatch.setattr(
        "app.pipeline.default_wall_predictor", lambda _img: synthetic_wall_mask
    )
    monkeypatch.setattr(
        "app.pipeline.default_opening_predictor",
        lambda _img: [
            Detection(cls="door", confidence=0.9, box=(90.0, 18.0, 112.0, 28.0))
        ],
    )

    response = client.post(
        "/recognize",
        files={"image": ("plan.png", _png_bytes(synthetic_image), "image/png")},
    )
    assert response.status_code == 200
    job_id = response.json()["jobId"]

    stages: list[str] = []
    with client.websocket_connect(f"/ws/jobs/{job_id}") as websocket:
        while True:
            event = websocket.receive_json()
            stages.append(event["stage"])
            if event.get("final"):
                break

    # Progress events arrive in pipeline order (the socket may attach
    # after early stages already fired, so assert relative order).
    order = [s for s in stages if s != "error"]
    expected = ["running_wall_segmentation", "running_detection", "fusing", "done"]
    filtered = [s for s in expected if s in order]
    assert filtered == sorted(filtered, key=expected.index)
    assert stages[-1] in ("done", "error")
    assert "error" not in stages

    status = client.get(f"/jobs/{job_id}").json()
    assert status["status"] == "done"
    assert status["result"]["openings"]


def test_unknown_job_404():
    assert client.get("/jobs/nope").status_code == 404
