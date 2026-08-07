#!/usr/bin/env bash
# ARGUS kiosk — wait for local UI, then open Chromium fullscreen.
# Used from ~/.config/labwc/autostart on Raspberry Pi OS (Bookworm+ / labwc).
set -euo pipefail

URL="${ARGUS_KIOSK_URL:-http://127.0.0.1:9080}"
LOG="${HOME}/.cache/argus-kiosk.log"
mkdir -p "$(dirname "$LOG")"

{
  echo "==== $(date -Iseconds) kiosk start ===="
  echo "URL=$URL"
} >>"$LOG"

# Wait until ARGUS nginx answers (Docker may still be starting)
for i in $(seq 1 60); do
  if curl -fsS --max-time 2 "$URL" >/dev/null 2>&1; then
    echo "ARGUS up after ${i}s" >>"$LOG"
    break
  fi
  sleep 2
done

# Avoid Chromium “restore pages?” / crash dialogs
PREF="${HOME}/.config/chromium/Default/Preferences"
if [[ -f "$PREF" ]]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$PREF" 2>/dev/null || true
  sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$PREF" 2>/dev/null || true
fi

CHROMIUM=""
for c in chromium chromium-browser; do
  if command -v "$c" >/dev/null 2>&1; then
    CHROMIUM="$(command -v "$c")"
    break
  fi
done

if [[ -z "$CHROMIUM" ]]; then
  echo "No chromium binary found" >>"$LOG"
  exit 1
fi

# lwrespawn restarts Chromium if it exits (labwc; @prefix does not work)
if [[ -x /usr/bin/lwrespawn ]]; then
  exec /usr/bin/lwrespawn "$CHROMIUM" \
    --kiosk \
    --app="$URL" \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --no-first-run \
    --password-store=basic \
    --check-for-update-interval=31536000 \
    --ozone-platform=wayland
else
  exec "$CHROMIUM" \
    --kiosk \
    --app="$URL" \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --no-first-run \
    --password-store=basic \
    --check-for-update-interval=31536000 \
    --ozone-platform=wayland
fi
