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

preflight_bind_ip() {
  local ip="${ARGUS_BIND_IP:-10.8.0.1}"
  if ip -4 addr show 2>/dev/null | grep -q "inet ${ip}/"; then
    echo "==> Bind IP ${ip} is present on this host."
    return 0
  fi
  echo ""
  echo "WARNING: ${ip} is NOT assigned on this host (WireGuard down or wrong ARGUS_BIND_IP?)."
  echo "  sudo wg show"
  echo "  ip -4 addr show wg0"
  echo "  sudo systemctl start wg-quick@wg0   # if needed"
  echo ""
}

http_probe() {
  local url="$1"
  if curl -sf "${url}" >/dev/null 2>&1; then
    return 0
  fi
  if command -v wget >/dev/null 2>&1 && wget -qO- "${url}" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

wait_for_argus() {
  local max_attempts="${1:-24}"
  local port="${ARGUS_PORT:-9080}"
  local host="${ARGUS_BIND_IP:-127.0.0.1}"
  local i

  preflight_bind_ip

  echo "==> Waiting for ARGUS on ${host}:${port} (up to $((max_attempts * 5))s)..."
  for i in $(seq 1 "$max_attempts"); do
    if http_probe "http://${host}:${port}/health"; then
      echo "    ARGUS healthy."
      return 0
    fi
    if [ "$i" -eq "$max_attempts" ]; then
      echo ""
      echo "ERROR: ARGUS did not become healthy at http://${host}:${port}/health"
      echo "  docker compose ps"
      echo "  docker compose logs argus --tail=80"
      echo "  sudo ss -tlnp | grep ${port}"
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
  http_probe "http://${host}:${port}/health" && echo ok || echo "    (health check failed)"

  echo "==> Listening:"
  ss -tlnp 2>/dev/null | grep ":${port} " || sudo ss -tlnp 2>/dev/null | grep ":${port} " || true

  echo "==> Container status:"
  $COMPOSE ps

  if [ -n "${ARGUS_HA_UPSTREAM:-}" ]; then
    echo "==> HA proxy enabled: ${ARGUS_HA_UPSTREAM}"
    echo "    In ARGUS Settings, use HA URL: ${ARGUS_PUBLIC_URL:-http://127.0.0.1:${port}}/api/ha"
    echo "==> HA reachability from container:"
    if $COMPOSE exec -T argus wget -qO- --timeout=8 "${ARGUS_HA_UPSTREAM}/api/" >/dev/null 2>&1; then
      echo "    OK — container can reach Home Assistant"
    else
      echo "    FAILED — container cannot reach ${ARGUS_HA_UPSTREAM}"
      echo "    If HA runs on this server, set: ARGUS_HA_UPSTREAM=http://homeassistant:8123"
      echo "    Ensure both stacks use Docker network ha-argus (see HA_SETUP.md)."
      echo "    Test: docker compose exec argus wget -qO- --timeout=8 ${ARGUS_HA_UPSTREAM}/api/"
    fi
  else
    echo "==> HA proxy disabled — set HA URL to your Pi/LAN address in ARGUS Settings"
  fi
}

print_access_hint() {
  local url port
  port="${ARGUS_PORT:-9080}"
  url="${ARGUS_PUBLIC_URL:-http://10.8.0.1:${port}}"

  echo ""
  echo "Done. Open (WireGuard must be connected):"
  echo "  ${url}"
  echo ""
  echo "  NOT http://localhost:${port} — ARGUS listens on ${ARGUS_BIND_IP:-10.8.0.1} only."
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
