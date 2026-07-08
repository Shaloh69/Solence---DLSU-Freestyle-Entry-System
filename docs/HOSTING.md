# Hosting Solence via Cloudflare Tunnel

Exposes all three local services (client, API, vision) under your own
domain — **free**, no port forwarding, no static IP — plus SSH access
to the host machine itself so you can `git pull`, manage the Python
venv, or kick off a training run from anywhere.

Every command below is PowerShell, run on the machine that's actually
running the services (your main PC).

> **Security note on "remote commands":** this guide gets you real
> remote terminal access via **SSH tunneled through Cloudflare**, not a
> custom "run command" HTTP endpoint added to the app. An in-app
> remote-code-execution feature reachable from a public domain is a
> backdoor by definition — SSH is the standard, audited tool for
> exactly this job, and Cloudflare Access (§4 below) adds a login wall
> in front of it.

## 0. Prerequisites — and the actual cost of "free"

**Cloudflare's Tunnel, Access, and Free-plan proxy are genuinely $0.**
A **domain name is not** — nobody gives those away for free, including
Cloudflare Registrar (they sell at cost, no markup, but "at cost" is
still real money). Two ways to get the full setup below without paying
anything:

1. **[GitHub Student Developer Pack](https://education.github.com/pack)**
   → free `.me` domain via Namecheap (1 year, genuinely $0) if you
   qualify with a school email. Add that domain to Cloudflare's Free
   plan (also $0) and follow §1 onward exactly as written.
2. Already have a domain sitting somewhere unused? Add it to Cloudflare
   (Free plan) and point its nameservers there — same result, $0.

**No domain at all, or just want to test right now?** Skip to **§5
Quick Tunnel** — genuinely zero setup, but the URL is random and
changes every run, and quick tunnels don't support the multi-hostname
config or SSH ingress (no persistent remote-admin access, no custom
subdomains). Fine for a one-off demo link, not for the workflow this
guide is built around.

Avoid the old "free `.tk`/`.ml`/`.cf`" giveaway registrars if you see
them recommended elsewhere — that program has largely collapsed and
those domains get seized or abuse-flagged unpredictably; not worth
building anything real on.

Replace `yourdomain.com` everywhere below with your real domain.

## 1. Install `cloudflared`

```powershell
winget install --id Cloudflare.cloudflared
cloudflared --version
```

## 2. Authenticate and create the tunnel

```powershell
cloudflared tunnel login
# Browser opens — pick yourdomain.com in your Cloudflare account.

cloudflared tunnel create solence
# Prints a Tunnel ID and writes C:\Users\<you>\.cloudflared\<tunnel-id>.json
```

## 3. Configure ingress (one hostname per service)

Create `C:\Users\<you>\.cloudflared\config.yml`:

```yaml
tunnel: <tunnel-id>
credentials-file: C:\Users\<you>\.cloudflared\<tunnel-id>.json

ingress:
  - hostname: app.yourdomain.com
    service: http://localhost:3000
  - hostname: api.yourdomain.com
    service: http://localhost:4000
  - hostname: vision.yourdomain.com
    service: http://localhost:8000
  - hostname: ssh.yourdomain.com
    service: ssh://localhost:22
  - service: http_status:404
```

WebSockets (the API's `/ws` realtime gateway) work over this with no
extra config — Cloudflare Tunnel proxies the `Upgrade` header
automatically for a plain `http://` ingress target.

Route DNS for each hostname (once per hostname):

```powershell
cloudflared tunnel route dns solence app.yourdomain.com
cloudflared tunnel route dns solence api.yourdomain.com
cloudflared tunnel route dns solence vision.yourdomain.com
cloudflared tunnel route dns solence ssh.yourdomain.com
```

## 4. Enable SSH on the host + lock it down

```powershell
# Enable Windows' built-in OpenSSH server
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic   # survives reboots
```

**Add a Cloudflare Access application in front of `ssh.yourdomain.com`**
(Cloudflare dashboard → Zero Trust → Access → Applications → Add an
application → Self-hosted): require login (email OTP, or Google/GitHub)
for *your* email address specifically before the tunnel even accepts a
connection to that hostname. This is a second, independent login layer
on top of your Windows account/SSH key — the tunnel URL leaking isn't
enough on its own to reach a shell.

Prefer an SSH key over a password:

```powershell
ssh-keygen -t ed25519 -C "solence-remote"
# public key -> C:\ProgramData\ssh\administrators_authorized_keys
# (or %USERPROFILE%\.ssh\authorized_keys for a non-admin account),
# then restrict its ACL per the OpenSSH-Server docs.
```

## 5. Quick Tunnel (no domain, no Access, testing only)

For a throwaway public URL to one service with zero setup:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Prints a random `https://<random-words>.trycloudflare.com` that proxies
to `localhost:3000`. Fine for a quick demo link; the URL isn't stable
and there's no SSH/Access layer, so don't use it for the remote-admin
workflow below.

## 6. Run it

```powershell
cloudflared tunnel run solence
```

Leave this running (or install it as a background Windows service so it
survives logout/reboot and you don't have to keep a terminal open):

```powershell
cloudflared service install
Start-Service cloudflared
```

Or from the repo root: `npm run tunnel` (added to the root
`package.json`, same `cloudflared tunnel run solence` command).

## 7. Using it remotely

From **any other machine**, once Access grants you a session:

```powershell
ssh you@ssh.yourdomain.com
```

From that shell, exactly the workflows this was built for:

```powershell
cd C:\Projects\Solence
git pull
cd solence-vision
.\.venv\Scripts\python.exe -m pip install -r requirements.txt --upgrade
.\.venv\Scripts\python.exe scripts\train_unet.py --dataset cubicasa5k --epochs 40 --imgsz 512 --batch 2
```

**One gotcha:** a long training run started directly in an SSH session
can get killed when you disconnect (same as closing a local terminal
window). Detach it first so it survives your SSH session ending:

```powershell
Start-Process powershell -ArgumentList '-NoExit','-Command', `
  '.\.venv\Scripts\python.exe scripts\train_unet.py --dataset cubicasa5k --epochs 40' `
  -RedirectStandardOutput C:\Projects\Solence\solence-vision\train.log
```

Then reconnect later and `Get-Content train.log -Tail 50 -Wait` to
watch it, or check `nvidia-smi` for GPU activity, without needing the
original session alive.

## 8. Command reference — everything you'd normally run locally

Once you're in over SSH (`ssh you@ssh.yourdomain.com`), any command you
run locally works the same way — it's a full shell, not a restricted
one. The set below covers this repo's actual day-to-day workflows so
you're not reconstructing them from memory on a phone/laptop away from
your desk. All paths assume `cd C:\Projects\Solence` first.

**Repo / git**
```powershell
git status
git pull
git log --oneline -10
git add -A; git commit -m "message"; git push
```

**Client + server (dev servers, tests, build)**
```powershell
npm run dev              # both, foreground — see note below on detaching
npm run dev:client
npm run dev:server
npm test                 # server vitest suite
npm run build
```
Dev servers are long-running like training — use the `Start-Process`
detach pattern from §7 (or the visible-window pattern below) so
closing the SSH session doesn't kill them.

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

**Tunnel / service management (on the host)**
```powershell
cloudflared tunnel list
cloudflared tunnel info solence
Get-Service cloudflared, sshd
Restart-Service cloudflared
```

**Launching anything long-running so an SSH disconnect can't kill it**
— the same detach pattern from §7, generalized:
```powershell
Start-Process powershell -ArgumentList '-NoExit','-Command','<your command here>' `
  -RedirectStandardOutput C:\Projects\Solence\<name>.log `
  -RedirectStandardError  C:\Projects\Solence\<name>.err.log
```
Reconnect later, `Get-Content <name>.log -Tail 50 -Wait` to check on it.

## Front-end/back-end env vars once tunneled

- `client/.env.local`: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
- `server/.env`: `CORS_ORIGINS=https://app.yourdomain.com`
- `solence-vision`: no env change needed — only the Express server
  calls it, and that can stay `localhost` if both run on the same host;
  only add its ingress hostname if you want to hit it directly from
  outside for testing.
