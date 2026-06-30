#!/bin/sh
set -eu

SSL_OUT="/etc/nginx/conf.d/ssl.conf"
SSL_TEMPLATE="/etc/nginx/argus-templates/ssl.conf.template"
TLS_DIR="/etc/nginx/argus/tls"

if [ "${ARGUS_HTTPS:-}" != "1" ]; then
  rm -f "${SSL_OUT}"
  echo "ARGUS: HTTPS disabled (set ARGUS_HTTPS=1 for web microphone)"
  exit 0
fi

BIND_IP="${ARGUS_BIND_IP:-10.8.0.1}"
mkdir -p "${TLS_DIR}"

# Mounted from host ./tls (see docker-compose.yml)
if [ -f "${TLS_DIR}/argus.crt" ] && [ -f "${TLS_DIR}/argus.key" ]; then
  echo "ARGUS: using custom TLS cert from tls/argus.crt"
  export ARGUS_TLS_CERT="${TLS_DIR}/argus.crt"
  export ARGUS_TLS_KEY="${TLS_DIR}/argus.key"
elif [ -f "${TLS_DIR}/cert.pem" ] && [ -f "${TLS_DIR}/key.pem" ]; then
  echo "ARGUS: using custom TLS cert from tls/cert.pem"
  export ARGUS_TLS_CERT="${TLS_DIR}/cert.pem"
  export ARGUS_TLS_KEY="${TLS_DIR}/key.pem"
elif [ ! -f "${TLS_DIR}/cert.pem" ]; then
  echo "ARGUS: generating self-signed TLS cert for ${BIND_IP} (use ./scripts/generate-argus-ca.sh for iPhone icon)"
  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout "${TLS_DIR}/key.pem" \
    -out "${TLS_DIR}/cert.pem" \
    -subj "/CN=${BIND_IP}" \
    -addext "subjectAltName=IP:${BIND_IP},DNS:argus,DNS:argus.local" 2>/dev/null \
    || openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
      -keyout "${TLS_DIR}/key.pem" \
      -out "${TLS_DIR}/cert.pem" \
      -subj "/CN=${BIND_IP}"
  export ARGUS_TLS_CERT="${TLS_DIR}/cert.pem"
  export ARGUS_TLS_KEY="${TLS_DIR}/key.pem"
else
  export ARGUS_TLS_CERT="${TLS_DIR}/cert.pem"
  export ARGUS_TLS_KEY="${TLS_DIR}/key.pem"
fi

envsubst '${ARGUS_TLS_CERT} ${ARGUS_TLS_KEY}' < "${SSL_TEMPLATE}" > "${SSL_OUT}"
echo "ARGUS: HTTPS enabled on container :8443 (map host port e.g. ${ARGUS_HTTPS_PORT:-9443})"
