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
echo "=== HA on host :8123 ==="
curl -sf --max-time 5 http://127.0.0.1:8123/api/ && echo "OK" || echo "FAILED (HA may still be starting)"

echo ""
echo "=== HA from ARGUS container ==="
cd "${HOME}/apps/argus"
docker compose exec -T argus wget -qO- -T 15 http://homeassistant:8123/api/ && echo "" && echo "OK" || echo "FAILED"

echo ""
echo "=== ARGUS .env HA upstream ==="
grep ARGUS_HA_UPSTREAM "${HOME}/apps/argus/.env" 2>/dev/null || echo "(no .env)"
