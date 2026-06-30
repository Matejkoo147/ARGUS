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
  chmod +x scripts/argus-update.sh scripts/lib/deploy_common.sh scripts/mato-ufw-rules.sh scripts/check-ha-link.sh scripts/ha-update.sh scripts/generate-argus-ca.sh 2>/dev/null || true
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
  if curl -sf --max-time 10 "${url}" >/dev/null 2>&1; then
    return 0
  fi
  if command -v wget >/dev/null 2>&1 && wget -qO- -T 10 "${url}" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

# Busybox wget in Alpine (nginx image) uses -T, not --timeout.
# HA /api/ returns 401 without a token — that still means HA is reachable.
wget_probe_in_argus() {
  local url="$1"
  local out
  out=$($COMPOSE exec -T argus wget -S -O /dev/null -T 15 "${url}" 2>&1 || true)
  if echo "$out" | grep -qE 'HTTP/1\.[01] (200|401)'; then
    return 0
  fi
  return 1
}

check_ollama_proxy_from_argus() {
  local out
  out=$($COMPOSE exec -T argus wget -S -O /dev/null -T 15 http://127.0.0.1:8080/api/ollama/api/tags 2>&1 || true)
  if echo "$out" | grep -qE 'HTTP/1\.[01] 502'; then
    echo "    FAILED — nginx /api/ollama proxy cannot reach upstream Ollama (502)"
    echo "    On host: curl http://127.0.0.1:11434/api/tags"
    echo "    Try .env: ARGUS_OLLAMA_UPSTREAM=http://172.17.0.1:11434 then argus-update build"
    return 1
  fi
  if echo "$out" | grep -qE 'HTTP/1\.[01] 200'; then
    echo "    OK — /api/ollama proxy reaches Ollama (tags)"
    out=$($COMPOSE exec -T argus wget -qO- -T 60 --header='Content-Type: application/json' \
      --post-data='{"model":"qwen2.5:3b","stream":false,"messages":[{"role":"user","content":"ping"}]}' \
      http://127.0.0.1:8080/api/ollama/api/chat 2>&1 || true)
    if echo "$out" | grep -qiE '403|forbidden'; then
      echo "    WARN — /api/chat returned 403 (Origin); redeploy for nginx Origin strip fix"
      return 1
    fi
    if echo "$out" | grep -q '"message"'; then
      echo "    OK — /api/ollama proxy chat works"
      return 0
    fi
    echo "    WARN — /api/chat probe inconclusive (model may still work from browser after redeploy)"
    return 0
  fi
  echo "    FAILED — could not probe /api/ollama proxy"
  echo "$out" | tail -5 | sed 's/^/      /'
  return 1
}

check_ha_proxy_from_argus() {
  local out
  out=$($COMPOSE exec -T argus wget -S -O /dev/null -T 15 http://127.0.0.1:8080/api/ha/api/ 2>&1 || true)
  if echo "$out" | grep -qE 'HTTP/1\.[01] 500'; then
    echo "    FAILED — nginx /api/ha proxy error (run: argus-update logs)"
    echo "$out" | tail -3 | sed 's/^/      /'
    return 1
  fi
  if echo "$out" | grep -qE 'HTTP/1\.[01] (200|401)'; then
    if echo "$out" | grep -qi 'content-type:.*text/html'; then
      echo "    FAILED — proxy returned HTML instead of JSON"
      return 1
    fi
    echo "    OK — /api/ha proxy reaches Home Assistant"
    return 0
  fi
  echo "    FAILED — could not probe /api/ha proxy"
  echo "$out" | tail -5 | sed 's/^/      /'
  return 1
}

check_ha_docker_network() {
  if ! docker network inspect ha-argus >/dev/null 2>&1; then
    echo "    Network ha-argus missing — start HA first: cd ~/apps/homeassistant && docker compose up -d"
    return 1
  fi
  if ! docker network inspect ha-argus 2>/dev/null | grep -q '"homeassistant"'; then
    echo "    homeassistant not on ha-argus network"
    return 1
  fi
  if ! docker network inspect ha-argus 2>/dev/null | grep -q 'argus-argus-1\|"argus"'; then
    echo "    argus container not on ha-argus network — redeploy ARGUS after HA is up"
    return 1
  fi
  return 0
}

wait_for_ha_from_argus() {
  local upstream="${ARGUS_HA_UPSTREAM:-}"
  local max="${1:-36}"
  local i url

  [ -n "${upstream}" ] || return 0
  url="${upstream%/}/api/"

  echo "==> Waiting for Home Assistant at ${url} (up to $((max * 5))s)..."
  check_ha_docker_network || true

  for i in $(seq 1 "$max"); do
    if wget_probe_in_argus "${url}"; then
      echo "    Home Assistant reachable from ARGUS container."
      return 0
    fi
    if [ "$i" -eq "$max" ]; then
      echo ""
      echo "    FAILED — ARGUS cannot reach Home Assistant (UFW is NOT the cause for Docker network)."
      echo "    1. HA still starting?  cd ~/apps/homeassistant && docker compose logs -f homeassistant"
      echo "    2. On host:             curl -s --max-time 5 http://127.0.0.1:8123/api/"
      echo "    3. From ARGUS:          docker compose exec argus wget -qO- -T 15 http://homeassistant:8123/api/"
      echo "    4. Network:             docker network inspect ha-argus"
      return 1
    fi
    sleep 5
  done
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

check_icon_assets_from_argus() {
  local icon out ct
  for icon in static/favicon-180.png static/favicon.ico apple-touch-icon.png; do
    out=$($COMPOSE exec -T argus wget -S -O /dev/null -T 10 "http://127.0.0.1:8080/${icon}" 2>&1 || true)
    if ! echo "$out" | grep -qE 'HTTP/1\.[01] 200'; then
      echo "    FAILED — /${icon} not reachable (iOS will show generic A icon)"
      echo "$out" | tail -3 | sed 's/^/      /'
      return 1
    fi
    ct=$(echo "$out" | grep -i 'content-type:' | tail -1)
    if echo "$ct" | grep -qi 'text/html'; then
      echo "    FAILED — /${icon} returns HTML instead of binary (rebuild with: docker compose build --no-cache)"
      return 1
    fi
  done
  out=$($COMPOSE exec -T argus wget -S -O /dev/null -T 10 "http://127.0.0.1:8080/static/manifest.json" 2>&1 || true)
  if ! echo "$out" | grep -qE 'HTTP/1\.[01] 200'; then
    echo "    FAILED — /static/manifest.json not reachable"
    return 1
  fi
  ct=$(echo "$out" | grep -i 'content-type:' | tail -1)
  if echo "$ct" | grep -qi 'text/html'; then
    echo "    FAILED — /static/manifest.json returns HTML instead of JSON"
    return 1
  fi
  echo "    OK — /static/ icons + manifest.json served correctly (TradingBot layout)"
  return 0
}

check_tls_cert_hint() {
  if [ "${ARGUS_HTTPS:-}" != "1" ]; then
    return 0
  fi
  local cert issuer subject sans bind_ip
  bind_ip="${ARGUS_BIND_IP:-10.8.0.1}"
  cert=$($COMPOSE exec -T argus sh -c 'test -f /etc/nginx/argus/tls/argus.crt && echo argus.crt || echo cert.pem' 2>/dev/null || echo cert.pem)
  issuer=$($COMPOSE exec -T argus sh -c "openssl x509 -in /etc/nginx/argus/tls/${cert} -noout -issuer 2>/dev/null" || true)
  subject=$($COMPOSE exec -T argus sh -c "openssl x509 -in /etc/nginx/argus/tls/${cert} -noout -subject 2>/dev/null" || true)
  sans=$($COMPOSE exec -T argus sh -c "openssl x509 -in /etc/nginx/argus/tls/${cert} -noout -ext subjectAltName 2>/dev/null" || true)
  echo "    cert file: tls/${cert}"
  echo "    subject  : ${subject:-unknown}"
  echo "    issuer   : ${issuer:-unknown}"
  if echo "$issuer" | grep -qi 'ARGUS Home CA'; then
    if echo "$subject" | grep -q "${bind_ip}" || echo "$sans" | grep -q "${bind_ip}"; then
      echo "    OK — CA-signed cert includes ${bind_ip} (enable Certificate Trust on iPhone)"
    else
      echo "    WARN — cert missing IP ${bind_ip} in CN/SAN → run: ./scripts/generate-argus-ca.sh --force"
    fi
    return 0
  fi
  echo "    WARN — auto self-signed cert (iPhone icon needs ./scripts/generate-argus-ca.sh --force)"
}

post_deploy_checks() {
  local port="${ARGUS_PORT:-9080}"
  local host="${ARGUS_BIND_IP:-127.0.0.1}"

  echo "==> Health:"
  http_probe "http://${host}:${port}/health" && echo ok || echo "    (health check failed)"

  echo "==> Listening:"
  ss -tlnp 2>/dev/null | grep ":${port} " || sudo ss -tlnp 2>/dev/null | grep ":${port} " || true
  if [ "${ARGUS_HTTPS:-}" = "1" ]; then
    local https_port="${ARGUS_HTTPS_PORT:-9443}"
    ss -tlnp 2>/dev/null | grep ":${https_port} " || sudo ss -tlnp 2>/dev/null | grep ":${https_port} " || true
    echo "==> HTTPS: enabled (microphone) — https://${host}:${https_port}"
    echo "==> TLS cert (iPhone icon needs CA-signed + trusted):"
    check_tls_cert_hint || true
  fi

  echo "==> Container status:"
  $COMPOSE ps

  echo "==> Home-screen icons (iOS Add to Home Screen):"
  check_icon_assets_from_argus || true

  if [ -n "${ARGUS_HA_UPSTREAM:-}" ]; then
    echo "==> HA proxy enabled: ${ARGUS_HA_UPSTREAM}"
    echo "    In ARGUS Settings, use HA URL: ${ARGUS_PUBLIC_URL:-http://127.0.0.1:${port}}/api/ha"
    echo "==> HA reachability from container:"
    if wget_probe_in_argus "${ARGUS_HA_UPSTREAM%/}/api/"; then
      echo "    OK — container can reach Home Assistant"
    else
      echo "    FAILED — run: docker compose exec argus wget -qO- -T 15 ${ARGUS_HA_UPSTREAM%/}/api/"
      check_ha_docker_network || true
    fi
    echo "==> HA proxy path (/api/ha → HA /api/):"
    check_ha_proxy_from_argus || true
  else
    echo "==> HA proxy disabled — set HA URL to your Pi/LAN address in ARGUS Settings"
  fi

  if [ -n "${ARGUS_OLLAMA_UPSTREAM:-}" ]; then
    echo "==> Ollama proxy enabled: ${ARGUS_OLLAMA_UPSTREAM}"
    echo "    In ARGUS Settings, use Ollama URL: ${ARGUS_PUBLIC_URL:-http://127.0.0.1:${port}}/api/ollama"
    echo "==> Ollama proxy path (/api/ollama → Ollama /api/):"
    check_ollama_proxy_from_argus || true
  else
    echo "==> Ollama proxy disabled — add ARGUS_OLLAMA_UPSTREAM to .env for HTTPS Ollama"
  fi
}

print_access_hint() {
  local url port https_port
  port="${ARGUS_PORT:-9080}"
  https_port="${ARGUS_HTTPS_PORT:-9443}"
  url="${ARGUS_PUBLIC_URL:-}"
  if [ -z "${url}" ]; then
    if [ "${ARGUS_HTTPS:-}" = "1" ]; then
      url="https://${ARGUS_BIND_IP:-10.8.0.1}:${https_port}"
    else
      url="http://${ARGUS_BIND_IP:-10.8.0.1}:${port}"
    fi
  fi

  echo ""
  echo "Done. Open (WireGuard must be connected):"
  echo "  ${url}"
  if [ "${ARGUS_HTTPS:-}" = "1" ]; then
    echo "  (HTTPS — microphone needs secure context)"
    echo "  iPhone icon shows A? Install tls/argus-ca.crt — see DEPLOY.md"
  fi
  echo ""
  echo "  HTTP fallback: http://${ARGUS_BIND_IP:-10.8.0.1}:${port}"
  echo "  NOT http://localhost:${port} — ARGUS listens on ${ARGUS_BIND_IP:-10.8.0.1} only."
  echo ""
  echo "First time:"
  echo "  1. Connect with your Home Assistant long-lived token"
  if [ -n "${ARGUS_HA_UPSTREAM:-}" ]; then
    echo "  2. HA URL: ${url}/api/ha"
  else
    echo "  2. HA URL: http://YOUR_PI_IP:8123 (add ARGUS URL to HA CORS if needed)"
  fi
  echo "  3. Ollama URL (Settings): ${url}/api/ollama"
  if [ -n "${ARGUS_OLLAMA_UPSTREAM:-}" ]; then
    echo "     (proxy upstream: ${ARGUS_OLLAMA_UPSTREAM})"
  else
    echo "     Add ARGUS_OLLAMA_UPSTREAM=http://host.docker.internal:11434 to .env"
  fi
  if [ "${ARGUS_HTTPS:-}" = "1" ]; then
    echo "  4. Ollama on host: OLLAMA_HOST=0.0.0.0:11434 (systemctl restart ollama)"
  fi
}
