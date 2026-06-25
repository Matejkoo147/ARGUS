#!/bin/sh
set -eu

OUT="/etc/nginx/argus/ha-proxy-locations.conf"
TEMPLATE="/etc/nginx/argus-templates/ha-proxy.conf.template"

if [ -n "${ARGUS_HA_UPSTREAM:-}" ]; then
  export ARGUS_HA_PROXY_HOST ARGUS_HA_HOST
  ARGUS_HA_PROXY_HOST="$(echo "${ARGUS_HA_UPSTREAM}" | sed -e 's|https\?://||' -e 's|/.*||')"
  ARGUS_HA_HOST="${ARGUS_HA_PROXY_HOST}"
  echo "ARGUS: enabling HA proxy -> http://${ARGUS_HA_PROXY_HOST} (Host: ${ARGUS_HA_HOST})"
  envsubst '${ARGUS_HA_PROXY_HOST} ${ARGUS_HA_HOST}' < "${TEMPLATE}" > "${OUT}"
else
  echo "ARGUS: no ARGUS_HA_UPSTREAM — HA proxy disabled (use direct HA URL + CORS)"
  printf '%s\n' '# HA proxy disabled' > "${OUT}"
fi
