#!/usr/bin/env bash
# Quick HA ↔ ARGUS connectivity check on mato-server
set -euo pipefail

echo "=== Home Assistant container ==="
docker ps --filter name=homeassistant --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true

echo ""
echo "=== ARGUS container ==="
docker ps --filter name=argus --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true

echo ""
echo "=== Network ha-argus ==="
if docker network inspect ha-argus >/dev/null 2>&1; then
  docker network inspect ha-argus --format '{{range .Containers}}{{.Name}} {{.IPv4Address}}{{"\n"}}{{end}}'
else
  echo "MISSING — run: cd ~/apps/homeassistant && docker compose up -d"
fi

echo ""
echo "=== HA on host :8123 (401 without token = OK) ==="
ha_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:8123/api/ || echo "000")
if [ "$ha_code" = "200" ] || [ "$ha_code" = "401" ]; then
  echo "OK — HA responding (HTTP ${ha_code})"
else
  echo "FAILED (HTTP ${ha_code})"
fi

echo ""
echo "=== HA from ARGUS container (401 without token = OK) ==="
cd "${HOME}/apps/argus"
out=$(docker compose exec -T argus wget -S -O /dev/null -T 15 http://homeassistant:8123/api/ 2>&1 || true)
if echo "$out" | grep -qE 'HTTP/1\.[01] (200|401)'; then
  echo "OK — Home Assistant reachable"
else
  echo "FAILED"
  echo "$out" | tail -5
fi

echo ""
echo "=== ARGUS nginx /api/ha proxy (401 without token = OK) ==="
out=$(docker compose exec -T argus wget -S -O /dev/null -T 15 http://127.0.0.1:8080/api/ha/api/ 2>&1 || true)
if echo "$out" | grep -qE 'HTTP/1\.[01] (200|401)'; then
  if echo "$out" | grep -qi 'content-type:.*text/html'; then
    echo "FAILED — proxy returned HTML (path rewrite broken); git pull && ./scripts/argus-update.sh"
  else
    echo "OK — /api/ha proxy reaches Home Assistant"
  fi
else
  echo "FAILED"
  echo "$out" | tail -8
fi

echo ""
echo "=== ARGUS .env HA upstream ==="
grep ARGUS_HA_UPSTREAM "${HOME}/apps/argus/.env" 2>/dev/null || echo "(no .env)"
