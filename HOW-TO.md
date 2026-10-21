# HOW-TO: run the full Solence stack locally

Three services: the Next.js client, the Express API, and (optional,
v2) the Python vision service. The client and API are enough for the
whole core product.

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+ (only for `solence-vision`; normally on FormLabs3B)
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
uvicorn app.main:app --port 8000          # local only
uvicorn app.main:app --host 0.0.0.0 --port 8000   # on FormLabs3B, reachable over the tailnet
```

Normally the vision service runs on **FormLabs3B** (GPU) and the laptop
points at it: `VISION_URL=http://formlabs3b:8000` in `server/.env`
(docs/MACHINES.md §5). Recognition endpoints return 503 until models are trained — see
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

FormLabs3B is the host (Tailscale + Windows OpenSSH; vision service
and training live there): [docs/MACHINES.md](docs/MACHINES.md).
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
- **Vision calls time out from the laptop**: the service on FormLabs3B
  must run with `--host 0.0.0.0`, and Windows Firewall must allow 8000
  from 100.64.0.0/10 (docs/MACHINES.md §4).
- **Export returns 403**: tier gating — set `DEFAULT_TIER=pro` in
  `server/.env` (dev default) or send `x-solence-tier: pro`.
