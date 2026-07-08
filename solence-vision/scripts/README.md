# scripts/

Standalone, idempotent automation for the data → training pipeline.
Nothing here requires clicking through a website or running steps from
memory; each script checks its prerequisites and prints the next step.

Run order:

1. `download_datasets.py --dataset <name>` — raw files into `data/raw/<name>/`
2. `convert_to_yolo.py --dataset <name>` — YOLO instance-seg labels + `data.yaml`
3. `convert_to_unet_masks.py --dataset <name>` — raster wall masks
4. `verify_dataset.py --dataset <name> --format yolo|unet` — parity checks + human-review overlays in `data/_previews/`
5. `train_yolo.py` / `train_unet.py` — weights into `models/`
6. `run_inference.py --image <file>` — fused pipeline on one image

## `cubicasa_svg.py`

Shared parser for CubiCasa5K's original layout (not a runnable script
itself — imported by the converters). The Kaggle mirror's bundled
`cubicasa5k_coco` JSONs are bbox-only for wall/room (no doors, no
windows, no room types), which isn't enough for the YOLO opening/room
head, so `convert_to_yolo.py`/`convert_to_unet_masks.py` auto-detect
and parse each sample's `model.svg` directly instead when a
`train.txt`/`val.txt` split file is present alongside it. Both
converters fall back to generic COCO-with-polygon-segmentation for
other datasets. Verified against real samples: door/window boxes and
room polygons align correctly across multiple drafting styles — see
the rendered previews from `verify_dataset.py` before trusting a new
dataset's conversion.

Conventions (keep these when adding scripts):

- `--dataset` argument, never a hardcoded dataset; register new ones in
  `_common.py` `DATASETS`.
- Fail loudly with the exact command to run when a prerequisite is
  missing (`_common.die`), never a bare traceback.
- Never silently overwrite previous output — `_common.versioned_output`
  timestamps instead, `--force` opts in.
- Datasets and weights stay gitignored; scripts are the artifact.
