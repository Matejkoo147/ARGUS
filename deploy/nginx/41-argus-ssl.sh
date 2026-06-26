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

if [ ! -f "${TLS_DIR}/cert.pem" ]; then
  echo "ARGUS: generating self-signed TLS cert for ${BIND_IP} (browser will warn once — accept to continue)"
  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout "${TLS_DIR}/key.pem" \
    -out "${TLS_DIR}/cert.pem" \
    -subj "/CN=argus" \
    -addext "subjectAltName=IP:${BIND_IP},DNS:argus.local" 2>/dev/null \
    || openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
      -keyout "${TLS_DIR}/key.pem" \
      -out "${TLS_DIR}/cert.pem" \
      -subj "/CN=argus"
fi

envsubst < "${SSL_TEMPLATE}" > "${SSL_OUT}"
echo "ARGUS: HTTPS enabled on container :8443 (map host port e.g. ${ARGUS_HTTPS_PORT:-9443})"
