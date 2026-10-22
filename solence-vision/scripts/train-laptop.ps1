# Full CubiCasa5K training on the laptop (RTX 3050 Laptop, 4 GB VRAM): YOLO, then U-Net.
# Safe to re-run after a sleep/reboot: a finished model (DONE marker) is skipped, an
# interrupted one resumes from its last.pt. Logs: <SOLENCE_VISION_DATA>\logs\train-*.log
#
#   powershell -ExecutionPolicy Bypass -File solence-vision\scripts\train-laptop.ps1
#
# Fit-tested 2026-10-22: yolo26s-seg 640/2 = 8.5 min/epoch, 3.9 GB peak;
# U-Net 512/2 = 10.7 min/epoch, 1.7 GB peak.
# 'Continue', not 'Stop': in Windows PowerShell 5.1 'Stop' turns the trainers' progress
# output on stderr into a terminating error. Failures are caught by exit code instead.
$ErrorActionPreference = 'Continue'
if (-not $env:SOLENCE_VISION_DATA) { $env:SOLENCE_VISION_DATA = 'C:\SolenceData\vision' }
$data = $env:SOLENCE_VISION_DATA
$vision = Split-Path $PSScriptRoot -Parent
$py = Join-Path $vision '.venv\Scripts\python.exe'
New-Item -ItemType Directory -Force (Join-Path $data 'logs') | Out-Null
Set-Location $vision

function Invoke-Stage($name, $runDir, $last, [string[]]$fresh, [string[]]$resume) {
  $done = Join-Path $runDir 'DONE'
  if (Test-Path $done) { Write-Output "$name already finished ($done)"; return }
  $log = Join-Path $data "logs\train-$name.log"
  $argv = if (Test-Path $last) { $resume } else { $fresh }
  Write-Output "$(Get-Date -Format s) $name start: $($argv -join ' ')" | Tee-Object -Append $log
  & $py @argv *>> $log
  # Keep this file ASCII: Windows PowerShell 5.1 reads BOM-less scripts as ANSI.
  [GC]::Collect()  # release this launcher's own memory between stages
  if ($LASTEXITCODE -ne 0) { throw "$name failed (exit $LASTEXITCODE) - see $log, then re-run this script" }
  New-Item -ItemType Directory -Force $runDir | Out-Null
  Set-Content $done (Get-Date -Format s)
  Write-Output "$(Get-Date -Format s) $name done" | Tee-Object -Append $log
}

# Free memory for training: the local vision service (uvicorn from this venv)
# holds torch in RAM and is not needed while training. It is restarted at the end.
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -like '*uvicorn*app.main:app*' } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Output "$(Get-Date -Format s) stopped vision service pid $($_.ProcessId) to free memory"
  }

$yoloRun = Join-Path $data 'runs\yolo\cubicasa5k'
Invoke-Stage 'yolo' $yoloRun (Join-Path $yoloRun 'weights\last.pt') `
  @('scripts\train_yolo.py', '--dataset', 'cubicasa5k', '--model', 'yolo26s-seg.pt', '--imgsz', '640', '--batch', '2', '--epochs', '100') `
  @('scripts\train_yolo.py', '--dataset', 'cubicasa5k', '--resume', (Join-Path $yoloRun 'weights\last.pt'))

$unetRun = Join-Path $data 'runs\unet\cubicasa5k'
Invoke-Stage 'unet' $unetRun (Join-Path $unetRun 'last.pt') `
  @('scripts\train_unet.py', '--dataset', 'cubicasa5k', '--imgsz', '512', '--batch', '2', '--epochs', '40') `
  @('scripts\train_unet.py', '--dataset', 'cubicasa5k', '--imgsz', '512', '--batch', '2', '--epochs', '40', '--resume', (Join-Path $unetRun 'last.pt'))

# Both models trained: bring the vision service back up on 127.0.0.1:8000 with the new weights.
Start-Process -FilePath $py -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000' `
  -WorkingDirectory $vision -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $data 'logs\service.log') -RedirectStandardError (Join-Path $data 'logs\service.err.log')
Write-Output "$(Get-Date -Format s) training finished; vision service started on 127.0.0.1:8000"
