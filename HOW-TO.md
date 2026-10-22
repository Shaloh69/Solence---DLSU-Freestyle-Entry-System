# HOW-TO: run the full Solence stack locally

Three services: the Next.js client, the Express API, and (optional,
v2) the Python vision service. The client and API are enough for the
whole core product.

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+ (only for `solence-vision`, which runs and trains on the laptop)
- A Supabase project (optional — the API falls back to in-memory
  storage when unconfigured; data then resets on API restart)

## 1. Install

```bash
npm install            # root tooling (concurrently)
npm run install:all    # client + server dependencies
```

## 2. Environment

```bash
cp client/.env.example client/.env.local
cp server/.env.example server/.env
```

Defaults work out of the box for local dev (API on :4000, in-memory
storage, `pro` tier). To use Supabase, run
[server/supabase/schema.sql](server/supabase/schema.sql) in the
Supabase SQL editor and fill `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

## 3. Run

```bash
npm run dev            # client http://localhost:3000 + API http://localhost:4000
```

Or individually: `npm run dev:client` / `npm run dev:server`.

Expected output: the server logs `solence-api listening on
http://localhost:4000 (ws on /ws)`; the client logs `Ready` and serves
`/projects`.

## 4. Vision service (optional, v2 — not required for the core loop)

```bash
cd solence-vision
python -m venv .venv && .venv\Scripts\activate    # Windows
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000   # laptop, local only
```

The vision service runs and trains on the **laptop** (RTX 3050, 4 GB):
`VISION_URL=http://localhost:8000` in `server/.env`
(docs/MACHINES.md §6). Recognition endpoints return 503 until models are trained — see
[solence-vision/HOW-TO.md](solence-vision/HOW-TO.md) for the full
dataset → training → serving walkthrough.

## 5. The gate (before every commit)

```bash
npm run gate        # full: hygiene, progress, typechecks, server tests, design refs, client build
npm run gate:fast   # what the Claude Code Stop hook runs
npm run progress    # where the revamp stands
```

`npm install` at the root points git at `.githooks/`, so every commit
runs the full gate. Summary: `.artifacts/gate-summary.md`.

## 6. Hosting / remote access

FormLabs3B is the app host (Tailscale + Windows OpenSSH); the vision
service and training live on the laptop: [docs/MACHINES.md](docs/MACHINES.md).
Public exposure via Cloudflare: [docs/HOSTING.md](docs/HOSTING.md).

## Common failure modes

- **Client 500s with a doubled path (`C:\Projects\...\D:\Projects-Shem\...`)**:
  you launched through the `C:\Projects` NTFS junction with a stale
  build. The npm scripts route through `client/scripts/next-real.js`
  which resolves the real path — if it recurs, delete `client/.next`.
- **`EADDRINUSE :4000`**: a previous API instance is still running —
  kill the process listening on 4000.
- **Everything saves but nothing simulates**: place a panel and at
  least one load; simulation requires floor plan + panel + loads.
- **A commit is refused**: the pre-commit gate failed — read
  `.artifacts/gate-summary.md`; fix the cause, never the check.
- **Vision calls fail**: the service must be running on the laptop at
  `127.0.0.1:8000` and `server/.env` must have
  `VISION_URL=http://localhost:8000` (docs/MACHINES.md §6).
- **Export returns 403**: tier gating — set `DEFAULT_TIER=pro` in
  `server/.env` (dev default) or send `x-solence-tier: pro`.
