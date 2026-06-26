# Sync ESPHome configs to a no-space path and open the web dashboard.
# Browser UI: compile, USB flash, OTA update, live logs — no CLI needed after this.
$ErrorActionPreference = "Stop"
$src = $PSScriptRoot
$dest = "C:\Users\matej\argus-esphome"

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Get-ChildItem $src -Filter "*.yaml" | Copy-Item -Destination $dest -Force
if (Test-Path (Join-Path $src "secrets.yaml")) {
  Copy-Item (Join-Path $src "secrets.yaml") $dest -Force
}

Write-Host "ESPHome dashboard -> http://localhost:6052" -ForegroundColor Cyan
Write-Host "Config folder: $dest" -ForegroundColor Cyan
Write-Host "Edit YAML in repo, re-run this script to sync, then refresh dashboard." -ForegroundColor Yellow
Set-Location $dest
esphome dashboard $dest --open-ui
