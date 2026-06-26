# ESP-IDF / PlatformIO fail if the project path contains spaces.
# This script copies config to C:\Users\matej\argus-esphome and runs esphome from there.
$ErrorActionPreference = "Stop"
$src = $PSScriptRoot
$dest = "C:\Users\matej\argus-esphome"
$name = if ($args[0]) { $args[0] } else { "argus-cam-1.yaml" }

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item (Join-Path $src $name) $dest -Force
if (Test-Path (Join-Path $src "secrets.yaml")) {
  Copy-Item (Join-Path $src "secrets.yaml") $dest -Force
}

Set-Location $dest
Write-Host "Building and flashing from: $dest" -ForegroundColor Cyan
Write-Host "GPIO0 -> GND, press RESET, then pick COM port." -ForegroundColor Yellow
esphome run $name
