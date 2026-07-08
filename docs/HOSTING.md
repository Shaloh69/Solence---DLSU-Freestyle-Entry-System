# Remote access to Solence — $0, no domain required

Two different needs, two different free tools. Don't reach for a
Cloudflare named Tunnel + real domain unless you actually get one later
(§4) — everything below costs nothing and needs no domain at all.

| Need | Tool | Why |
|---|---|---|
| Run commands on your own PC from another device (`git pull`, manage the venv, kick off training) | **Tailscale** (§1) | Free forever, unlimited devices, a *stable* private address, real SSH — not a public-facing tunnel at all. |
| Hand someone else (thesis panel, teammate) a browser link to the running app | **Cloudflare Quick Tunnel** (§2) | Zero setup, but temporary — see the hard limits below before relying on it for anything but a short demo. |

> **Why not just Cloudflare Tunnel for both?** A persistent named Tunnel
> (the kind that supports SSH ingress, custom subdomains, multiple
> services) requires a domain bound to a Cloudflare zone — the Tunnel
> itself is free, but a domain name isn't, anywhere. Cloudflare's own
> **Quick Tunnel** (no domain needed) is explicitly documented as
> "testing and development only," carries **no SLA/uptime guarantee**,
> caps out at **200 concurrent requests**, and — the part that actually
> matters here — **only proxies one HTTP service per invocation**.
> There's no ingress-rules mechanism, no SSH/TCP support. That's not a
> risk you can absorb by never restarting the PC; it's a hard capability
> wall regardless of uptime. Use it only for what it's actually for:
> a temporary public link to one web page.

## 1. Tailscale — remote terminal access, free forever

Install on **both** the host PC and whatever device you'll connect
from (phone, laptop, another PC) — same account on both.

```powershell
# On the host PC (Windows): download and install
winget install tailscale.tailscale
tailscale up
# Opens a browser to sign in (Google/Microsoft/GitHub/email) —
# do this on every device you want on the same private network.
```

Enable Windows' OpenSSH server on the host (same as any local SSH
setup — Tailscale just gets you there privately instead of over the
public internet):

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
```

Find the host's stable Tailscale address:

```powershell
tailscale status
# or check the "Machines" list at https://login.tailscale.com/admin/machines
```

From **any other device on the same tailnet**, connect exactly like
local SSH — the address just happens to route over Tailscale's private
network instead of your LAN:

```powershell
ssh you@your-pc-name.your-tailnet.ts.net
```

That's it — no domain, no port forwarding, no public exposure at all
(the host is never reachable from the open internet, only from devices
you've explicitly signed into the same tailnet). See §3 below for the
full command reference to run once connected.

*(Newer Tailscale versions also offer built-in Tailscale SSH —
`tailscale up --ssh` — which skips the separate OpenSSH setup entirely
and authenticates via your Tailscale identity instead of SSH keys. Try
it if your client supports it; the OpenSSH method above works
regardless of version and is what's assumed in the rest of this doc.)*

## 2. Cloudflare Quick Tunnel — public demo link (app only, temporary)

For letting someone else open the **client** (Next.js app) in a
browser without installing anything:

```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3000
```

Prints a random `https://<random-words>.trycloudflare.com` — share that
link. Notes:

- **New random URL every time you run this command** — send the fresh
  link each session, don't bookmark it as permanent.
- **Testing/demo only** — Cloudflare's own docs say so explicitly; no
  uptime guarantee, capped at 200 concurrent requests.
- **This exposes the client only.** The API (`localhost:4000`) isn't
  reachable through it — if the demo needs live data, keep the API
  running locally and pointed at by the client as usual
  (`NEXT_PUBLIC_API_URL=http://localhost:4000` still works for a local
  demo; only change it if you also tunnel the API the same way with a
  second `cloudflared tunnel --url http://localhost:4000` in another
  window — each gets its own unrelated random URL).
- **No SSH, no relation to your Tailscale setup** — these are two
  independent tools solving two different problems; running one
  doesn't affect the other.

## 3. Command reference — everything you'd normally run locally

Once connected over Tailscale SSH (`ssh you@your-pc-name.your-tailnet.ts.net`),
it's a full shell — any command you'd run locally works. Reference for
this repo's actual workflows so you're not reconstructing them from
memory on a phone away from your desk. All paths assume
`cd C:\Projects\Solence` first.

**Repo / git**
```powershell
git status
git pull
git log --oneline -10
git add -A; git commit -m "message"; git push
```

**Client + server (dev servers, tests, build)**
```powershell
npm run dev              # both, foreground — see the detach note below
npm run dev:client
npm run dev:server
npm test                 # server vitest suite
npm run build
```

**Vision service / venv / training**
```powershell
cd solence-vision
.\.venv\Scripts\Activate.ps1                              # or call .venv\Scripts\python.exe directly, no activation needed
.\.venv\Scripts\python.exe -m pip install -r requirements.txt --upgrade
.\.venv\Scripts\python.exe -m pytest tests\                # regression gate after any retrain
.\.venv\Scripts\python.exe scripts\download_datasets.py --dataset cubicasa5k
.\.venv\Scripts\python.exe scripts\convert_to_yolo.py --dataset cubicasa5k
.\.venv\Scripts\python.exe scripts\convert_to_unet_masks.py --dataset cubicasa5k
.\.venv\Scripts\python.exe scripts\train_yolo.py --dataset cubicasa5k --epochs 100
.\.venv\Scripts\python.exe scripts\train_unet.py --dataset cubicasa5k --epochs 40 --imgsz 512 --batch 2
.\.venv\Scripts\python.exe scripts\run_inference.py --image path\to\plan.png
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

**Monitoring a detached/background process**
```powershell
nvidia-smi                                  # one-shot GPU snapshot
nvidia-smi --query-gpu=memory.used,utilization.gpu --format=csv,noheader,l 5   # repeats every 5s
Get-Content train.log -Tail 50 -Wait        # live-tail a redirected log
Get-Process python*, node* | Format-Table Id, ProcessName, CPU
Stop-Process -Id <pid>                      # kill a specific runaway process
```

**Launching anything long-running so an SSH disconnect can't kill it**
```powershell
Start-Process powershell -ArgumentList '-NoExit','-Command','<your command here>' `
  -RedirectStandardOutput C:\Projects\Solence\<name>.log `
  -RedirectStandardError  C:\Projects\Solence\<name>.err.log
```
Reconnect later, `Get-Content <name>.log -Tail 50 -Wait` to check on it.
This matters more than usual over SSH specifically: a process started
directly in an SSH session can get killed when that session ends, the
same way closing a local terminal window kills what's running in it.

## 4. Optional, later: a real domain for persistent public hosting

If you ever want a **stable** public URL for all three services at
once (not random-per-restart) plus SSH via Cloudflare Access instead of
Tailscale, that needs a domain bound to Cloudflare — which is the one
piece that isn't free anywhere. Two ways to get one at $0 if you want
this later:

- **[GitHub Student Developer Pack](https://education.github.com/pack)**
  → free `.me` domain via Namecheap for a year, if you qualify with a
  school email (this looks like a DLSU project, so likely yes).
- Already have a domain sitting unused elsewhere — point its
  nameservers at Cloudflare's Free plan, same result, $0.

Full walkthrough for that setup (named tunnel, per-service ingress
rules, DNS routes, Cloudflare Access) is preserved in git history of
this file if/when you want it — ask and it'll come back into this doc.
