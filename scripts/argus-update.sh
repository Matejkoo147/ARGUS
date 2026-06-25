#!/usr/bin/env bash
# ARGUS — deploy helper for mato-server (same pattern as resell-radar rr-update)
#
# Install once on Ubuntu:
#   mkdir -p ~/apps && cd ~/apps
#   git clone <your-repo-url> argus && cd argus
#   cp .env.example .env   # edit ARGUS_HA_UPSTREAM, ARGUS_PUBLIC_URL
#   chmod +x scripts/argus-update.sh scripts/lib/deploy_common.sh
#   sudo ln -sf ~/apps/argus/scripts/argus-update.sh /usr/local/bin/argus-update
#
# Usage:
#   argus-update          Pull, rebuild, restart (daily use)
#   argus-update logs     Follow container logs
#   argus-update ps       Container status
#   argus-update build    Rebuild without git pull

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
# shellcheck source=lib/deploy_common.sh
source "$SCRIPT_DIR/lib/deploy_common.sh"

COMPOSE="docker compose -f docker-compose.yml"
cd "$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

cmd="${1:-update}"

case "$cmd" in
  update|"")
    echo "==> ARGUS — routine update"
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      echo "==> Pulling latest code..."
      git_sync_deploy
    else
      echo "==> Not a git repo — skipping pull (use git clone or rsync from your laptop)"
    fi

    echo "==> Rebuilding and restarting..."
    if ! $COMPOSE up -d --build; then
      echo ""
      echo "ERROR: docker compose failed."
      echo "  Port in use? Edit .env → ARGUS_PORT=9080 (or another free port), then:"
      echo "    docker compose down && argus-update build"
      echo "  Check: sudo ss -tlnp | grep -E '8080|9080'"
      exit 1
    fi

    if [ -n "${ARGUS_HA_UPSTREAM:-}" ]; then
      wait_for_ha_from_argus 36 || true
    fi

    wait_for_argus 24
    post_deploy_checks
    print_access_hint
    ;;

  build)
    echo "==> ARGUS — rebuild only"
    $COMPOSE up -d --build
    if [ -n "${ARGUS_HA_UPSTREAM:-}" ]; then
      wait_for_ha_from_argus 36 || true
    fi

    wait_for_argus 24
    post_deploy_checks
    print_access_hint
    ;;

  logs)
    $COMPOSE logs -f argus
    ;;

  ps)
    $COMPOSE ps
    ;;

  check)
    bash "$SCRIPT_DIR/check-ha-link.sh"
    ;;

  stop)
    $COMPOSE down
    ;;

  *)
    echo "Usage: argus-update [update|build|logs|ps|check|stop]"
    exit 1
    ;;
esac
