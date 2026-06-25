#!/usr/bin/env bash
# Shared helpers for argus-update (expects COMPOSE to be set by caller)

# Deploy tree should match GitHub — discard accidental server-side edits before pull.
git_sync_deploy() {
  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"
  git fetch origin
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    echo "    Local edits on server — resetting tracked files to match origin/${branch}..."
    git reset --hard "HEAD"
  fi
  git reset --hard "origin/${branch}"
  chmod +x scripts/argus-update.sh scripts/lib/deploy_common.sh scripts/mato-ufw-rules.sh 2>/dev/null || true
}

wait_for_argus() {
  local max_attempts="${1:-24}"
  local port="${ARGUS_PORT:-9080}"
  local host="${ARGUS_BIND_IP:-127.0.0.1}"
  local i

  echo "==> Waiting for ARGUS on ${host}:${port} (up to $((max_attempts * 5))s)..."
  for i in $(seq 1 "$max_attempts"); do
    if curl -sf "http://${host}:${port}/health" >/dev/null 2>&1; then
      echo "    ARGUS healthy."
      return 0
    fi
    if [ "$i" -eq "$max_attempts" ]; then
      echo "ERROR: ARGUS did not become healthy. Logs:"
      $COMPOSE logs argus --tail=80
      return 1
    fi
    sleep 5
  done
}

post_deploy_checks() {
  local port="${ARGUS_PORT:-9080}"
  local host="${ARGUS_BIND_IP:-127.0.0.1}"

  echo "==> Health:"
  curl -sf "http://${host}:${port}/health" && echo || echo "    (health check failed)"

  echo "==> Container status:"
  $COMPOSE ps

  if [ -n "${ARGUS_HA_UPSTREAM:-}" ]; then
    echo "==> HA proxy enabled: ${ARGUS_HA_UPSTREAM}"
    echo "    In ARGUS Settings, use HA URL: ${ARGUS_PUBLIC_URL:-http://127.0.0.1:${port}}/api/ha"
  else
    echo "==> HA proxy disabled — set HA URL to your Pi/LAN address in ARGUS Settings"
  fi
}

print_access_hint() {
  local url port
  port="${ARGUS_PORT:-9080}"
  url="${ARGUS_PUBLIC_URL:-http://10.8.0.1:${port}}"

  echo ""
  echo "Done. Open ${url}"
  echo ""
  echo "First time:"
  echo "  1. Connect with your Home Assistant long-lived token"
  if [ -n "${ARGUS_HA_UPSTREAM:-}" ]; then
    echo "  2. HA URL: ${url}/api/ha"
  else
    echo "  2. HA URL: http://YOUR_PI_IP:8123 (add ARGUS URL to HA CORS if needed)"
  fi
  echo "  3. Ollama URL (Settings): http://10.0.0.1:11434 or your server LAN IP"
}
