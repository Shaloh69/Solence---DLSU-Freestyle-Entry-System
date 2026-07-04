"""solence-vision FastAPI service.

Endpoints (section 7.4):
  GET  /health              — service + model-weight status
  POST /recognize           — upload a floor plan image, get a job id
  GET  /jobs/{job_id}       — job status + result when done
  WS   /ws/jobs/{job_id}    — staged progress events for a job

Only the Express API calls this service; the frontend never connects
directly (section 2.4). Jobs run in-process — replace the in-memory
store with a queue if volume ever demands it.
"""

from __future__ import annotations

import asyncio
import io
import uuid
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from PIL import Image

from .models import ModelsNotAvailable, models_status
from .pipeline import run_pipeline

app = FastAPI(title="solence-vision", version="0.1.0")

STAGES = [
    "queued",
    "running_wall_segmentation",
    "running_detection",
    "fusing",
    "done",
]


@dataclass
class Job:
    id: str
    status: str = "queued"
    message: str = ""
    result: dict[str, Any] | None = None
    error: str | None = None
    events: asyncio.Queue = field(default_factory=asyncio.Queue)


JOBS: dict[str, Job] = {}


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "solence-vision", "models": models_status()}


@app.post("/recognize")
async def recognize(image: UploadFile) -> dict[str, str]:
    status = models_status()
    if not all(status.values()):
        missing = [name for name, present in status.items() if not present]
        raise HTTPException(
            status_code=503,
            detail=(
                f"Model weights missing: {', '.join(missing)}. "
                "Train them first (scripts/train_unet.py, scripts/train_yolo.py) "
                "— see HOW-TO.md."
            ),
        )

    raw = await image.read()
    try:
        rgb = np.asarray(Image.open(io.BytesIO(raw)).convert("RGB"))
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Not a readable image: {error}")

    job = Job(id=uuid.uuid4().hex)
    JOBS[job.id] = job
    asyncio.get_running_loop().run_in_executor(None, _run_job, job, rgb)
    return {"jobId": job.id}


def _run_job(job: Job, image: np.ndarray) -> None:
    loop = asyncio.new_event_loop()

    def on_progress(stage: str, message: str) -> None:
        job.status = stage
        job.message = message
        job.events.put_nowait({"stage": stage, "message": message})

    try:
        result = run_pipeline(image, on_progress)
        job.result = result
        job.events.put_nowait({"stage": "done", "message": "complete", "final": True})
    except ModelsNotAvailable as error:
        job.status = "error"
        job.error = str(error)
        job.events.put_nowait({"stage": "error", "message": str(error), "final": True})
    except Exception as error:  # noqa: BLE001 — surface anything to the caller
        job.status = "error"
        job.error = f"{type(error).__name__}: {error}"
        job.events.put_nowait({"stage": "error", "message": job.error, "final": True})
    finally:
        loop.close()


@app.get("/jobs/{job_id}")
def job_status(job_id: str) -> dict[str, Any]:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Unknown job")
    return {
        "jobId": job.id,
        "status": job.status,
        "message": job.message,
        "result": job.result,
        "error": job.error,
    }


@app.websocket("/ws/jobs/{job_id}")
async def job_events(websocket: WebSocket, job_id: str) -> None:
    await websocket.accept()
    job = JOBS.get(job_id)
    if not job:
        await websocket.send_json({"stage": "error", "message": "Unknown job"})
        await websocket.close()
        return
    try:
        while True:
            event = await job.events.get()
            await websocket.send_json(event)
            if event.get("final"):
                break
    except WebSocketDisconnect:
        return
    await websocket.close()
