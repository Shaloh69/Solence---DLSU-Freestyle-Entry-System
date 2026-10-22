# Machines

| Machine | Role | Reached as |
|---|---|---|
| **Laptop** | Claude Code, development, commits, pushes; vision service + model training (RTX 3050 Laptop, 4 GB VRAM; §6) | `localhost` |
| **FormLabs3B** | Hosts web + API, GPU perf checks (`check:motion`, `check:render`), Cloudflare tunnel (Phase D) | `formlabs3b` on the tailnet (MagicDNS) |

Code only moves laptop → GitHub → FormLabs3B (`git pull`). Nothing is
edited directly on FormLabs3B.

## 1. Put FormLabs3B on the same tailnet as the laptop

Your tailnet is the one shown at console.tailscale.com (the
`ecocharge123@…` account, Free plan). Tailscale is already installed on
FormLabs3B; it just has to sign in to *this* tailnet.

**Option A — auth key (best for a server, no browser on FormLabs3B):**

1. On the laptop: admin console → **Settings → Keys → Generate auth
   key**. One-off, **Pre-approved** on, expiry 1 day. Copy the
   `tskey-auth-…` value (it's case-sensitive and shown once).
2. On FormLabs3B, PowerShell **as Administrator**:
   ```powershell
   tailscale status                 # see where it is signed in now
   tailscale logout                 # only if it shows another account/tailnet
   tailscale up --auth-key=tskey-auth-PASTE --hostname=formlabs3b --unattended
   tailscale status                 # should now list your laptop and the other machines
   ```

**Option B — browser sign-in:** on FormLabs3B right-click the
Tailscale tray icon → Log out (if signed in elsewhere) → Log in → sign in
with an account that belongs to this tailnet and pick this tailnet if
asked. Then tray → **Preferences → Run unattended** → Yes. Rename it to
`formlabs3b` in the admin console (machine row → … → Edit machine name).

## 2. Keep it connected

- Admin console → **Machines** → `formlabs3b` row → **…** → **Disable
  key expiry** (otherwise it drops off after 180 days).
- Unattended mode (step 1) keeps it on the tailnet when nobody is signed
  in to Windows. Check `services.msc` → Tailscale = Automatic, Running.
- Windows power plan: never sleep (Settings → System → Power).

## 3. Check from the laptop

```powershell
tailscale ping formlabs3b
ping formlabs3b
```

If `formlabs3b` doesn't resolve, use its `100.x.y.z` address from the
Machines page and check **DNS → MagicDNS** is enabled.

## 4. SSH into FormLabs3B (one time, on FormLabs3B as Administrator)

Tailscale's own SSH server does not run on Windows, so use Windows
OpenSSH (traffic still goes over the tailnet):

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
# Allow SSH + the app ports only from the tailnet (100.64.0.0/10):
New-NetFirewallRule -DisplayName "Solence via Tailscale" -Direction Inbound -Protocol TCP `
  -LocalPort 22,3000,4000,8000 -RemoteAddress 100.64.0.0/10 -Action Allow
```

From the laptop: `ssh <your-windows-username>@formlabs3b`.

## 5. Repo on FormLabs3B

```powershell
cd C:\Projects
git clone https://github.com/Shaloh69/Solence---DLSU-Freestyle-Entry-System Solence
cd Solence
git checkout revamp
npm install; npm run install:all; npm run gate
nvidia-smi                                   # confirm the GPU
```

Long jobs are started detached and logged — see `docs/HOSTING.md` §3 —
so closing SSH doesn't kill them. Phase D turns web and API into Windows
services and adds the Cloudflare tunnel.

## 6. Vision service + training on the laptop

The vision service and model training run on the laptop (item V0):

- venv with the CUDA torch build: `solence-vision/requirements.txt` header.
- Datasets and training runs live under `SOLENCE_VISION_DATA`
  (default `C:\SolenceData\vision` — D: is too small); final weights in
  `solence-vision/models/` (gitignored).
- 4 GB VRAM limits: `yolo26s-seg --imgsz 640 --batch 2`, U-Net
  `--imgsz 512 --batch 2` (`m`-seg does not fit). Keep the laptop plugged
  in and awake during a run; resume from `last.pt` if it stops.
- Serve on `127.0.0.1:8000`; `server/.env` has
  `VISION_URL=http://localhost:8000`.
- CubiCasa5K is CC BY-NC-SA: weights trained on it are research/demo-only.
  V5 retrains on ResPlan (CC BY 4.0) before the hosted app may serve them;
  Phase D decides how FormLabs3B's API reaches the laptop over Tailscale.
