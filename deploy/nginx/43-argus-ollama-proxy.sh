#!/bin/sh
set -eu

OUT="/etc/nginx/argus/ollama-proxy-locations.conf"
TEMPLATE="/etc/nginx/argus-templates/ollama-proxy.conf.template"

if [ -n "${ARGUS_OLLAMA_UPSTREAM:-}" ]; then
  export ARGUS_OLLAMA_PROXY_HOST
  ARGUS_OLLAMA_PROXY_HOST="$(echo "${ARGUS_OLLAMA_UPSTREAM}" | sed -e 's|https\?://||' -e 's|/.*||')"
  echo "ARGUS: enabling Ollama proxy -> http://${ARGUS_OLLAMA_PROXY_HOST}"
  envsubst '${ARGUS_OLLAMA_PROXY_HOST}' < "${TEMPLATE}" > "${OUT}"
else
  echo "ARGUS: Ollama proxy disabled (set ARGUS_OLLAMA_UPSTREAM in .env)"
  printf '%s\n' '# Ollama proxy disabled' > "${OUT}"
fi
