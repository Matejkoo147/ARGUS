#!/usr/bin/env bash
# Home Assistant — update helper for mato-server
#
# Install once:
#   mkdir -p ~/apps/homeassistant
#   cp deploy/homeassistant/docker-compose.yml ~/apps/homeassistant/
#   cd ~/apps/homeassistant && docker compose up -d
#   sudo ln -sf ~/apps/argus/scripts/ha-update.sh /usr/local/bin/ha-update
#
# Usage:
#   ha-update          Pull latest HA image and restart
#   ha-update logs     Follow logs
#   ha-update ps       Status

set -euo pipefail

HA_DIR="${HA_DIR:-$HOME/apps/homeassistant}"
COMPOSE="docker compose"

if [ ! -f "${HA_DIR}/docker-compose.yml" ]; then
  echo "ERROR: ${HA_DIR}/docker-compose.yml not found."
  echo "See HA_SETUP.md in the ARGUS repo."
  exit 1
fi

cd "${HA_DIR}"
cmd="${1:-update}"

case "$cmd" in
  update|"")
    echo "==> Home Assistant — pull & restart"
    $COMPOSE pull
    $COMPOSE up -d
    echo ""
    echo "HA UI (on LAN):  http://$(hostname -I | awk '{print $1}'):8123"
    echo "HA UI (VPN):     http://10.8.0.1:8123  (if WireGuard up)"
    echo "ARGUS proxy URL: http://10.8.0.1:9080/api/ha"
    ;;
  logs)
    $COMPOSE logs -f homeassistant
    ;;
  ps)
    $COMPOSE ps
    ;;
  stop)
    $COMPOSE down
    ;;
  *)
    echo "Usage: ha-update [update|logs|ps|stop]"
    exit 1
    ;;
esac
