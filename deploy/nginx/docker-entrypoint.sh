#!/bin/sh
set -eu

OUT="/etc/nginx/argus/ha-proxy-locations.conf"
TEMPLATE="/etc/nginx/argus-templates/ha-proxy.conf.template"

if [ -n "${ARGUS_HA_UPSTREAM:-}" ]; then
  echo "ARGUS: enabling HA proxy -> ${ARGUS_HA_UPSTREAM}"
  envsubst '${ARGUS_HA_UPSTREAM}' < "${TEMPLATE}" > "${OUT}"
else
  echo "ARGUS: no ARGUS_HA_UPSTREAM — HA proxy disabled (use direct HA URL + CORS)"
  printf '%s\n' '# HA proxy disabled' > "${OUT}"
fi
