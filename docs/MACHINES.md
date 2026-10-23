# Machine — the pitch laptop

Everything runs on one laptop (decided 2026-10-22; the FormLabs3B server
and its tailnet were dropped — the pitch only needs the full system on
this machine).

| | |
|---|---|
| Hardware | i7-12650H, 16 GB RAM, RTX 3050 Laptop GPU (4 GB VRAM) |
| Repo | `D:\Projects-Shem\Websites\2026-2027\Solence` (D: is small — big data goes to C:) |
| Runs | Claude Code, dev, gate, web (:3000) + API (:4000), vision service (:8000), model training, GPU perf checks, and in Phase D the Cloudflare tunnel |
| Public link | Phase D: Cloudflare tunnel → `localhost:3000` while the laptop is on (docs/HOSTING.md) |

## 1. Keep it ready

- Plugged in, never sleeping while training or demoing (Settings →
  System → Power). Claude Code asks before changing power settings.
- Vision service, API and web bind to `127.0.0.1`; only the Cloudflare
  tunnel (Phase D) is public. No inbound firewall rules are needed.

## 2. Vision service + training

The vision service and model training run here (item V0):

- venv with the CUDA torch build: `solence-vision/requirements.txt` header.
- Datasets and training runs live under `SOLENCE_VISION_DATA`
  (user env var, `C:\SolenceData\vision`); final weights in
  `solence-vision/models/` (gitignored).
- 4 GB VRAM limits: `yolo26s-seg --imgsz 640 --batch 2`, U-Net
  `--imgsz 512 --batch 2` (`m`-seg does not fit).
  `solence-vision/scripts/train-laptop.ps1` runs both and resumes after a
  sleep/reboot — just run it again. Run it in a normal or minimized
  window, never a hidden one: Windows power-throttles windowless
  processes and the single-threaded data loading drops from ~4.9 to
  ~1.1 it/s. Don't run GPU work (Playwright 3D tests, perf checks) while
  it trains — the 4 GB of VRAM spills into shared memory.
- Serve on `127.0.0.1:8000`; `server/.env` has
  `VISION_URL=http://localhost:8000`.
- CubiCasa5K is CC BY-NC-SA: weights trained on it are research/demo-only.
  V5 retrains on ResPlan (CC BY 4.0) before the public pitch link serves
  vision.

## 3. GPU perf checks

`check:motion` / `check:render` budgets are measured on this RTX 3050 —
the machine the pitch runs on. Don't run them while a training job holds
the GPU; the numbers would be wrong.
