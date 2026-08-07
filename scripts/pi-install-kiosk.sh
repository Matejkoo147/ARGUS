#!/usr/bin/env bash
# Install ARGUS as the Pi desktop startup screen (labwc + Chromium kiosk).
# Run ON the Raspberry Pi as the desktop user (e.g. pi), after ARGUS is reachable on :9080.
#
#   chmod +x scripts/pi-install-kiosk.sh
#   ./scripts/pi-install-kiosk.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/scripts/pi-argus-kiosk.sh"
DEST="${HOME}/bin/pi-argus-kiosk.sh"
AUTOSTART_DIR="${HOME}/.config/labwc"
AUTOSTART="${AUTOSTART_DIR}/autostart"
URL="${ARGUS_KIOSK_URL:-http://127.0.0.1:9080}"

if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC — run from a cloned ARGUS repo."
  exit 1
fi

mkdir -p "${HOME}/bin" "$AUTOSTART_DIR"
cp -f "$SRC" "$DEST"
chmod +x "$DEST"

MARKER_BEGIN="# --- ARGUS kiosk begin ---"
MARKER_END="# --- ARGUS kiosk end ---"

BLOCK=$(cat <<EOF
${MARKER_BEGIN}
# Wait for Docker/ARGUS then open fullscreen UI (HA stays backend-only)
${DEST} &
${MARKER_END}
EOF
)

if [[ -f "$AUTOSTART" ]] && grep -q "ARGUS kiosk begin" "$AUTOSTART"; then
  # Replace existing block
  tmp="$(mktemp)"
  awk -v b="$MARKER_BEGIN" -v e="$MARKER_END" '
    $0==b {skip=1; next}
    $0==e {skip=0; next}
    !skip {print}
  ' "$AUTOSTART" >"$tmp"
  printf '%s\n' "$BLOCK" >>"$tmp"
  mv "$tmp" "$AUTOSTART"
else
  {
    echo ""
    printf '%s\n' "$BLOCK"
  } >>"$AUTOSTART"
fi
chmod +x "$AUTOSTART" 2>/dev/null || true

echo "==> Ensuring graphical auto-login (raspi-config noninteractive if available)..."
if command -v raspi-config >/dev/null 2>&1; then
  sudo raspi-config nonint do_boot_behaviour B4 || true
fi

echo ""
echo "Installed ARGUS kiosk autostart."
echo "  Script:    $DEST"
echo "  Autostart: $AUTOSTART"
echo "  URL:       $URL"
echo ""
echo "Make sure ARGUS Docker is running and set to start on boot:"
echo "  docker update --restart unless-stopped \$(docker ps -aq --filter name=argus) 2>/dev/null || true"
echo "  cd ~/apps/argus && docker compose up -d"
echo ""
echo "Test now (without reboot):"
echo "  $DEST &"
echo "Reboot to verify: sudo reboot"
echo ""
echo "Screenshot for thesis: P-ARGUS — ARGUS fullscreen right after boot."
