#!/bin/sh
set -eu

if [ -n "${ARGUS_HA_UPSTREAM:-}" ]; then
  echo "ARGUS: enabling HA proxy -> ${ARGUS_HA_UPSTREAM}"
  envsubst '${ARGUS_HA_UPSTREAM}' \
    < /etc/nginx/templates/ha-proxy.conf.template \
    > /etc/nginx/conf.d/ha-proxy-locations.conf
else
  echo "ARGUS: no ARGUS_HA_UPSTREAM — HA proxy disabled (use direct HA URL + CORS)"
  printf '%s\n' '# HA proxy disabled' > /etc/nginx/conf.d/ha-proxy-locations.conf
fi
