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

Conventions (keep these when adding scripts):

- `--dataset` argument, never a hardcoded dataset; register new ones in
  `_common.py` `DATASETS`.
- Fail loudly with the exact command to run when a prerequisite is
  missing (`_common.die`), never a bare traceback.
- Never silently overwrite previous output — `_common.versioned_output`
  timestamps instead, `--force` opts in.
- Datasets and weights stay gitignored; scripts are the artifact.
