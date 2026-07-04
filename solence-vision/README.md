# solence-vision

Python + FastAPI microservice for AI floor-plan recognition (brief
section 7): given an uploaded floor plan image, return wall polygons,
door/window openings, and typed room instances — the same JSON shape the
Express API's rasterizer consumes from manually drawn plans, so the
routing/compliance engine never knows the plan came from a model.

**Status: scaffolded, not trained.** The service, fusion logic, scripts,
and tests are real and runnable; recognition returns 503 until models
are trained per [HOW-TO.md](HOW-TO.md). The core simulator does not
depend on this service existing.

## What lives here

- `app/` — the FastAPI service. `main.py` (HTTP + WebSocket job
  endpoints), `pipeline.py` (staged U-Net → YOLO → fusion run),
  `fusion.py` (pure-numpy mask+detection fusion — unit-testable without
  any model), `models.py` (lazy weight loading with loud failures).
- `scripts/` — idempotent dataset/training automation; see its README.
- `tests/` — pytest suite: fusion + API contract tests run with no
  models; model regression tests skip until weights exist.
- `data/`, `models/` — gitignored payloads (datasets, weights); the
  scripts are what's checked in.
- `Dockerfile` — CPU-inference container; mount `models/` in.

## Architecture (7.2)

U-Net (ResNet encoder, `segmentation_models_pytorch`) segments walls;
YOLO-seg (`ultralytics`) detects doors/windows/room instances; the
fusion step cuts wall segments where opening boxes intersect them.
Room-type labels feed the GFCI/AFCI compliance rules in the Express
engine.

## Extending

- New dataset: register it in `scripts/_common.py` `DATASETS`, then the
  whole `download → convert → verify → train` chain works with
  `--dataset <name>`.
- New detection class: add it to `CLASSES` in `scripts/convert_to_yolo.py`
  and (if it's an opening/room) teach `app/fusion.py` about it.
- Retrained a model? Run `pytest tests/` before deploying — that's the
  regression gate.
