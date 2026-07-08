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

## 0. Prerequisites

- A domain added to Cloudflare on the **Free plan** (Cloudflare itself
  doesn't give away domain names, but the Tunnel/Access features used
  here are free once *any* domain's nameservers point at Cloudflare —
  transfer an existing domain or register a cheap one anywhere and add
  it to your Cloudflare account first).
- No domain yet / just want to test? Skip to **§5 Quick Tunnel** for a
  zero-config `*.trycloudflare.com` URL — no Cloudflare account setup
  needed at all, but the URL changes every run and there's no SSH option.

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

## Front-end/back-end env vars once tunneled

- `client/.env.local`: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
- `server/.env`: `CORS_ORIGINS=https://app.yourdomain.com`
- `solence-vision`: no env change needed — only the Express server
  calls it, and that can stay `localhost` if both run on the same host;
  only add its ingress hostname if you want to hit it directly from
  outside for testing.
