# Live dashboard for the laptop training run (read-only: closing this window does NOT stop training).
#
#   powershell -ExecutionPolicy Bypass -File solence-vision\scripts\watch-training.ps1
#
# Redraws in place every few seconds: overall progress, the current epoch's
# progress bar, and a table of finished epochs. Keep this file ASCII
# (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
param([int]$RefreshSeconds = 5, [int]$Rows = 12, [switch]$Once)

if (-not $env:SOLENCE_VISION_DATA) { $env:SOLENCE_VISION_DATA = 'C:\SolenceData\vision' }
$data = $env:SOLENCE_VISION_DATA
$host.UI.RawUI.WindowTitle = 'Solence training (safe to close)'

function Read-Tail($path, [int]$bytes = 16384) {
  if (-not (Test-Path $path)) { return '' }
  $fs = [IO.File]::Open($path, 'Open', 'Read', 'ReadWrite')
  try {
    # train-laptop.ps1 logs via PowerShell 5.1 redirection, which writes UTF-16 LE.
    $bom = New-Object byte[] 2
    [void]$fs.Read($bom, 0, 2)
    $utf16 = $bom[0] -eq 0xFF -and $bom[1] -eq 0xFE
    $len = $fs.Length
    $start = [Math]::Max(0, $len - $bytes)
    if ($utf16) { $start -= $start % 2 }
    $fs.Seek($start, 'Begin') | Out-Null
    $buf = New-Object byte[] ($len - $start)
    $n = $fs.Read($buf, 0, $buf.Length)
    $enc = if ($utf16) { [Text.Encoding]::Unicode } else { [Text.Encoding]::UTF8 }
    return $enc.GetString($buf, 0, $n)
  } finally { $fs.Close() }
}

function Bar([double]$fraction, [int]$width = 40) {
  $f = [Math]::Max(0.0, [Math]::Min(1.0, $fraction))  # 0.0/1.0: int literals pick the int overload
  $full = [int][Math]::Round($f * $width)
  '[' + ('#' * $full) + ('-' * ($width - $full)) + ']' + (' {0,5:N1}%' -f ($f * 100))
}

function Show-Yolo {
  $run = Join-Path $data 'runs\yolo\cubicasa5k'
  $log = Join-Path $data 'logs\train-yolo.log'
  $text = (Read-Tail $log 262144) -replace "$([char]27)\[[0-9;]*[A-Za-z]", ''
  # Ultralytics progress line: "  12/100  3.55G  ...  640: 77% ... 1627/2100 4.2it/s 6:33<1:53"
  $m = [regex]::Matches($text, '(\d+)/(\d+)\s+([\d.]+G)\s.*?(\d+)/(\d+)\s+([\d.]+)it/s\s+([\d:.]+s?)(?:<([\d:.]+s?))?')
  $epochs = 100
  Write-Host 'YOLO  yolo26s-seg  640px  batch 2' -ForegroundColor Cyan
  if ($m.Count) {
    $x = $m[$m.Count - 1]
    $epoch = [int]$x.Groups[1].Value; $epochs = [int]$x.Groups[2].Value
    $batch = [int]$x.Groups[4].Value; $batches = [int]$x.Groups[5].Value
    Write-Host ('  overall  ' + (Bar ((($epoch - 1) + $batch / $batches) / $epochs)) + "   epoch $epoch/$epochs")
    Write-Host ('  epoch    ' + (Bar ($batch / $batches)) + "   $batch/$batches  $($x.Groups[6].Value) it/s  eta $(if ($x.Groups[8].Success) { $x.Groups[8].Value } else { 'validating' })  GPU $($x.Groups[3].Value)")
  } else {
    Write-Host '  (starting up or validating...)'
  }
  $csv = Join-Path $run 'results.csv'
  if (Test-Path $csv) {
    $rowsData = Import-Csv $csv | ForEach-Object {
      $o = @{}; foreach ($p in $_.PSObject.Properties) { $o[$p.Name.Trim()] = $p.Value.Trim() }; [pscustomobject]$o
    }
    Write-Host ''
    Write-Host '  done epochs   mAP50 box   mAP50 mask   mAP50-95 mask   val seg loss' -ForegroundColor DarkGray
    $rowsData | Select-Object -Last $Rows | ForEach-Object {
      Write-Host ('  {0,11}   {1,9:N3}   {2,10:N3}   {3,13:N3}   {4,12:N3}' -f $_.epoch,
        [double]$_.'metrics/mAP50(B)', [double]$_.'metrics/mAP50(M)', [double]$_.'metrics/mAP50-95(M)', [double]$_.'val/seg_loss')
    }
  }
  if (Test-Path (Join-Path $run 'DONE')) { Write-Host '  FINISHED' -ForegroundColor Green }
}

function Show-Unet {
  $run = Join-Path $data 'runs\unet\cubicasa5k'
  $text = Read-Tail (Join-Path $data 'logs\train-unet.log') 65536
  Write-Host 'U-Net  walls  512px  batch 2' -ForegroundColor Cyan
  $m = [regex]::Matches($text, 'epoch (\d+)/(\d+) loss ([\d.]+) val_loss ([\d.]+)')
  if (-not $m.Count) { Write-Host '  (starts after YOLO)'; return }
  $last = $m[$m.Count - 1]
  Write-Host ('  overall  ' + (Bar ([int]$last.Groups[1].Value / [int]$last.Groups[2].Value)) + "   epoch $($last.Groups[1].Value)/$($last.Groups[2].Value)")
  Write-Host ''
  Write-Host '  done epochs   train loss   val loss' -ForegroundColor DarkGray
  $m | Select-Object -Last $Rows | ForEach-Object {
    Write-Host ('  {0,11}   {1,10}   {2,8}' -f $_.Groups[1].Value, $_.Groups[3].Value, $_.Groups[4].Value)
  }
  if (Test-Path (Join-Path $run 'DONE')) { Write-Host '  FINISHED' -ForegroundColor Green }
}

while ($true) {
  $failed = Select-String -Path (Join-Path $data 'logs\launcher.log') -Pattern 'failed' -ErrorAction SilentlyContinue
  Clear-Host
  Write-Host ("Solence training   {0:yyyy-MM-dd HH:mm:ss}   (refresh {1}s, Ctrl+C or close to exit)" -f (Get-Date), $RefreshSeconds)
  Write-Host ''
  Show-Yolo
  Write-Host ''
  Show-Unet
  if ($failed) { Write-Host ''; Write-Host "TRAINING STOPPED: $($failed[-1].Line)" -ForegroundColor Red }
  if ($Once) { break }
  Start-Sleep $RefreshSeconds
}
