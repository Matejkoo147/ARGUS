# USB recovery flash for ESP32-CAM (Windows).
# Usage:
#   .\recover-usb.ps1 -ComPort COM6
#   .\recover-usb.ps1 -ComPort COM6 -WifiOnly
param(
  [switch]$WifiOnly,
  [Parameter(Mandatory = $false)]
  [string]$ComPort = "COM6"
)

$ErrorActionPreference = "Stop"
$src = $PSScriptRoot
$dest = "C:\Users\matej\argus-esphome"
$name = if ($WifiOnly) { "argus-cam-1-wifi-test.yaml" } else { "argus-cam-1.yaml" }

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Get-ChildItem $src -Filter "*.yaml" | Copy-Item -Destination $dest -Force
if (Test-Path (Join-Path $src "secrets.yaml")) {
  Copy-Item (Join-Path $src "secrets.yaml") $dest -Force
} else {
  Write-Host "ERROR: secrets.yaml missing. Copy secrets.yaml.example to secrets.yaml and fill WiFi + keys." -ForegroundColor Red
  exit 1
}

Set-Location $dest

# Force array — single COM port from GetPortNames() is otherwise treated as a string of characters
$ports = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object)

Write-Host ""
Write-Host "=== ESP32-CAM USB recovery ===" -ForegroundColor Cyan
Write-Host "Detected COM ports: $($ports -join ', ')" -ForegroundColor Cyan
Write-Host "Using COM port: $ComPort" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Wire: GND, 3.3V, USB-TTL TX->U0R (GPIO3), RX->U0T (GPIO1)" -ForegroundColor Yellow
Write-Host "2. GPIO0 -> GND, press RESET, keep GPIO0 until upload starts" -ForegroundColor Yellow
Write-Host "3. After flash: remove GPIO0, press RESET" -ForegroundColor Yellow
Write-Host "4. Turn OFF WireGuard when pinging 192.168.0.x" -ForegroundColor Yellow
Write-Host ""

if ($ports -notcontains $ComPort) {
  Write-Host "WARNING: $ComPort not in detected ports. Pick one of: $($ports -join ', ')" -ForegroundColor Red
  if ($ports.Count -ge 1) {
    $ComPort = $ports[-1]
    Write-Host "Falling back to $ComPort" -ForegroundColor Yellow
  }
}

esphome run $name --device $ComPort --no-logs

Write-Host ""
Write-Host "Flash done. Waiting 5s for reboot..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "=== SERIAL LOGS on $ComPort ===" -ForegroundColor Green
Write-Host "Press RESET on the ESP32 now if you see no text below." -ForegroundColor Green
Write-Host ""

# Must pass COM6 explicitly — esphome treats bare letters as hostnames
esphome logs $name --device $ComPort

Write-Host ""
Write-Host "=== Next steps ===" -ForegroundColor Cyan
Write-Host "  WiFi failed? Connect phone to 'Argus-Cam-1 Fallback' (password = ap_password in secrets.yaml)" -ForegroundColor White
Write-Host "  Got an IP? ping it (WireGuard OFF), then HA -> ESPHome -> IP : 6053 -> encryption key" -ForegroundColor White
if ($WifiOnly) {
  Write-Host "  Then dashboard -> WIRELESS INSTALL full argus-cam-1.yaml" -ForegroundColor White
}
