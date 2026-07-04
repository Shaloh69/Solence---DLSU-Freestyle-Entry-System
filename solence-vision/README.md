# solence-vision (v2 — not started)

Planned Python + FastAPI microservice for AI floor-plan recognition. **Do not build until the core simulator (Phases 0–7) works end-to-end with the manual draw/upload-and-trace flow.**

## Scope (from the Solence brief, section 7)

Given an uploaded floor plan image, return JSON with:

- **Wall masks/polygons** — feeds the rasterizer that builds the routing walkability grid
- **Door/window openings** — cut wall segments; needed for room transitions
- **Room instances with type labels** (bath, kitchen, garage, …) — drives GFCI/AFCI compliance rules

## Planned architecture

- **U-Net** (ResNet or SegFormer encoder, via `segmentation_models_pytorch`) for wall/room-boundary semantic segmentation
- **YOLOv8-seg / YOLO11-seg** (via `ultralytics`) for doors, windows, and room instances
- **Fusion step**: cut U-Net wall segments where YOLO opening boxes intersect
- Served over internal HTTP to the Express API (`/server`), which feeds the output into the same rasterizer used for manually drawn plans
- Containerized (Docker), deployed and scaled independently

## Datasets (priority order)

1. **CubiCasa5K** — primary. COCO-converted mirror with pretrained weights: https://github.com/xmarva/floorplan-detection
2. **ResPlan** (17k plans, 2025) — https://arxiv.org/html/2508.14006v1
3. **RPLAN** (80k plans, by request) — fine-tuning target, stylistically closest to PH submissions
4. **Modified Swiss Dwellings** — multi-unit, for commercial scope later

Plan a fine-tuning pass on real, team-labeled PH floor plans before trusting the model on client submissions.

## Layout (planned)

```
solence-vision/
  api/            # FastAPI app
  models/         # model definitions + weights (gitignored)
  training/       # training / fine-tuning scripts
  conversion/     # dataset label conversion (SVG/COCO -> masks/YOLO)
  Dockerfile
```
