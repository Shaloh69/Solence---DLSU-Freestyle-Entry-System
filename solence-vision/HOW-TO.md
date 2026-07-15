# HOW-TO: solence-vision (AI floor plan recognition)

The most unfamiliar part of the stack for a web engineer — this walks
through everything in order, assuming you have not trained a computer
vision model before. Every step is a literal command.

## 0. Environment setup

Python 3.11 or 3.12 recommended (`py -0` lists what's installed; 3.12
is the most battle-tested for the torch/ultralytics stack).

```powershell
cd C:\Projects\Solence\solence-vision
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

PowerShell activation gotchas:

- It must be `.\.venv\Scripts\Activate.ps1` — the leading `.\` and the
  `.ps1` matter. Bare `.venv\Scripts\activate` is cmd.exe syntax and
  fails in PowerShell with "The module '.venv' could not be loaded".
- If you get "running scripts is disabled on this system", allow local
  scripts once:
  `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- **No-activation alternative (always works):** skip activation and
  call the venv's interpreter directly —
  `.venv\Scripts\python.exe scripts\train_yolo.py --dataset cubicasa5k`
  (same for pip: `.venv\Scripts\python.exe -m pip install -r requirements.txt`).

On macOS/Linux: `python3 -m venv .venv && source .venv/bin/activate`.

PyTorch note: the plain `pip install` gets the **CPU** build — fine for
serving, useless for training. The full GPU walkthrough (detecting your
GPU with `nvidia-smi`, picking the right cuXXX wheel, the
`+cpu`-already-installed gotcha that requires uninstall-first, and VRAM
-based training flags) lives at the top of `requirements.txt` — read it
before training.

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
python scripts/train_yolo.py --dataset cubicasa5k --epochs 100   # yolo26m-seg default
python scripts/train_unet.py --dataset cubicasa5k --epochs 40
```

Weights land in `models/yolo/best.pt` and `models/unet/best.pt`
(previous weights are kept timestamped, never overwritten).

Pick the YOLO26 scale with `--model` (`yolo26n-seg.pt` … `yolo26x-seg.pt`;
default `yolo26m-seg.pt`) and the batch size with `--batch` (default `-1`
= auto-fit to VRAM). Verified limits: a 4 GB RTX 3050 Laptop **cannot**
train `m`-seg even at `--imgsz 640 --batch 2` (cuDNN
EXECUTION_FAILED_CUDART in the backward pass = out of VRAM) — use
`--model yolo26s-seg.pt --imgsz 640 --batch 2` there, and save `m`+ for
a bigger GPU (formlab3b trained nano at 1024 using ~14 GB).

**Augmentation is preconfigured for floor plans — don't revert it to
Ultralytics defaults.** Those defaults are tuned for natural photos;
floor plans are near-monochrome line drawings, so `train_yolo.py` sets:

- `hsv_h=0, hsv_s=0` — hue/saturation jitter optimizes for color
  variation that barely exists in scanned/CAD plans, and hurts thin-line
  contrast. `hsv_v=0.1` stays on as a mild stand-in for scan/print
  exposure differences.
- `mixup=0` — alpha-blending two floor plans doesn't produce a
  meaningful training sample the way it does for photo classification.
- `fliplr=0.5, flipud=0.5, degrees=90` — kept/raised: plans have no
  fixed "up" and get drafted at arbitrary orientations, so flips and
  rotations are legitimate, cheap variety.
- `mosaic`, `translate`, `scale` — left at Ultralytics defaults; more
  room-boundary contexts per step and framing variety are fine here.

If a retrain gets *worse* after someone "fixes" these back to defaults,
this section is why.

### Merging multiple datasets

Once a second converted source exists (ResPlan, RPLAN, a Roboflow set):

```bash
python scripts/merge_datasets.py --sources cubicasa5k resplan --oversample resplan=4
python scripts/verify_dataset.py --dataset merged --format yolo
python scripts/train_yolo.py --dataset merged
```

`merge_datasets.py` remaps every source's classes onto the unified
13-class taxonomy (`scripts/cubicasa_svg.py` `CLASSES`), stratifies the
val split across sources, prefixes filenames with their source (so
per-source validation metrics stay computable), and oversamples small
sources via repeated `train.txt` entries — add a `SOURCE_CLASS_MAPS`
table in the script when a new source with its own class names lands.

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
