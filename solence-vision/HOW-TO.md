# HOW-TO: solence-vision (AI floor plan recognition)

The most unfamiliar part of the stack for a web engineer — this walks
through everything in order, assuming you have not trained a computer
vision model before. Every step is a literal command.

## 0. Environment setup

Python 3.11+ required.

```bash
cd solence-vision
python -m venv .venv
.venv\Scripts\activate            # Windows (source .venv/bin/activate on mac/linux)
pip install -r requirements.txt
```

PyTorch note: the plain `pip install` gets the CPU build. For GPU
training install the matching CUDA build first — pick the command for
your CUDA version at https://pytorch.org/get-started/locally/ — then
re-run `pip install -r requirements.txt` for the rest.

**No GPU?** Training on CPU is impractically slow. Rent a cloud GPU or
use Google Colab: clone the repo there, run the same scripts.
(Provisioning paid GPU time is a team decision — don't burn budget
without clearing it.)

## 1. Download a dataset

```bash
python scripts/download_datasets.py --dataset cubicasa5k
```

Needs Kaggle credentials (`~/.kaggle/kaggle.json`, from your Kaggle
account settings). Files land in `data/raw/cubicasa5k/`. Re-running
skips if already present.

Shortcut worth taking: the COCO-converted CubiCasa5K mirror with
pretrained weights at https://github.com/xmarva/floorplan-detection
skips most conversion work — place its files under `data/raw/cubicasa5k/`.

## 2. Convert to training formats

```bash
python scripts/convert_to_yolo.py --dataset cubicasa5k        # door/window/room head
python scripts/convert_to_unet_masks.py --dataset cubicasa5k  # wall head
```

Each script tells you the next step and refuses to silently overwrite a
previous conversion (timestamped output instead; `--force` to overwrite).

## 3. Verify before training

```bash
python scripts/verify_dataset.py --dataset cubicasa5k --format yolo
python scripts/verify_dataset.py --dataset cubicasa5k --format unet
```

Checks image/label parity and class distribution, and renders overlay
previews to `data/_previews/` — **look at them** before spending GPU
hours on a mislabeled conversion.

## 4. Train

```bash
python scripts/train_yolo.py --dataset cubicasa5k --epochs 100
python scripts/train_unet.py --dataset cubicasa5k --epochs 40
```

Weights land in `models/yolo/best.pt` and `models/unet/best.pt`
(previous weights are kept timestamped, never overwritten).

## 5. Validate the trained models — before trusting them

```bash
pytest tests/
```

Without weights, the model tests skip and only the fusion/API tests run.
With weights, the suite catches a model that silently regressed (stopped
detecting doors, collapsed to all-background walls). Add a handful of
real PH floor plan images to `tests/fixtures/` per its README — that's
what makes these tests meaningful.

## 6. Run fused inference on one image

```bash
python scripts/run_inference.py --image path/to/floorplan.png
```

Writes `inference-result.json` matching the API contract (walls,
openings, rooms).

## 7. Serve

```bash
uvicorn app.main:app --port 8000
```

- `GET /health` — model-weight status
- `POST /recognize` (multipart `image`) — returns `{jobId}`; 503 with
  instructions while weights are missing
- `WS /ws/jobs/{jobId}` — staged progress:
  `queued → running_wall_segmentation → running_detection → fusing → done`
- `GET /jobs/{jobId}` — status + result JSON

Only the Express API calls this service; it relays progress to the
frontend over its own `/ws` (section 2.4 of the brief).

Docker: `docker build -t solence-vision . && docker run -p 8000:8000 -v ./models:/srv/solence-vision/models solence-vision`

## 8. Fine-tuning for PH plans

CubiCasa5K is Finnish real-estate data; expect degraded accuracy on
Philippine AutoCAD/hand-drawn submissions. Once the pipeline works end
to end, fine-tune on team-labeled PH plans: register the dataset in
`scripts/_common.py` (`DATASETS`), place files under `data/raw/<name>/`,
and re-run steps 2–5 with `--dataset <name>`.

## Common failure modes

- `Kaggle download failed` — missing/invalid `~/.kaggle/kaggle.json`.
- `No COCO annotation JSON found` — you downloaded the official SVG
  release; use the COCO mirror (step 1) or write an SVG parser.
- `Converted 0 images` — category names don't match; adjust `CLASSES`
  in `convert_to_yolo.py`.
- 503 from `/recognize` — no trained weights yet; finish steps 4–5.
- CPU-only torch during training — reinstall the CUDA build (step 0).
