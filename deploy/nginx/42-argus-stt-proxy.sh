#!/bin/sh
set -eu

OUT="/etc/nginx/argus/stt-proxy-locations.conf"
TEMPLATE="/etc/nginx/argus-templates/stt-proxy.conf.template"

if [ -n "${ARGUS_STT_UPSTREAM:-}" ]; then
  export ARGUS_STT_PROXY_HOST
  ARGUS_STT_PROXY_HOST="$(echo "${ARGUS_STT_UPSTREAM}" | sed -e 's|https\?://||' -e 's|/.*||')"
  echo "ARGUS: enabling STT proxy -> http://${ARGUS_STT_PROXY_HOST}"
  envsubst '${ARGUS_STT_PROXY_HOST}' < "${TEMPLATE}" > "${OUT}"
else
  echo "ARGUS: STT proxy disabled (enable: docker compose --profile stt up -d)"
  printf '%s\n' '# STT proxy disabled' > "${OUT}"
fi
