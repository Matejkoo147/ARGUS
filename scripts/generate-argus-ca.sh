#!/usr/bin/env bash
# Generate a private CA + ARGUS server cert for trusted HTTPS on iPhone/iPad.
#
# Why: iOS loads /static/favicon-180.png in Safari, but "Add to Home Screen"
# refuses apple-touch-icon over self-signed HTTPS (shows letter "A").
# TradingBot works because it uses plain HTTP on :5000.
#
# After running this script:
#   1. argus-update build
#   2. AirDrop tls/argus-ca.crt to iPhone → Install profile
#   3. Settings → General → About → Certificate Trust Settings → enable ARGUS CA
#   4. Delete old ARGUS shortcut, add again from https://10.8.0.1:9443
#
# Usage (on mato-server):
#   cd ~/apps/argus && chmod +x scripts/generate-argus-ca.sh && ./scripts/generate-argus-ca.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TLS="${ROOT}/tls"
DAYS=825
BIND_IP="${ARGUS_BIND_IP:-10.8.0.1}"

mkdir -p "${TLS}"

if [ -f "${TLS}/argus-ca.key" ] && [ -f "${TLS}/argus.crt" ]; then
  echo "TLS already exists in tls/ (delete tls/argus-* to regenerate)."
  echo "CA for iPhone: ${TLS}/argus-ca.crt"
  exit 0
fi

echo "==> Creating private CA..."
openssl genrsa -out "${TLS}/argus-ca.key" 4096
openssl req -x509 -new -nodes -key "${TLS}/argus-ca.key" -sha256 -days "${DAYS}" \
  -out "${TLS}/argus-ca.crt" \
  -subj "/CN=ARGUS Home CA/O=ARGUS/C=SK"

echo "==> Creating server key + CSR for ${BIND_IP}..."
openssl genrsa -out "${TLS}/argus.key" 2048
openssl req -new -key "${TLS}/argus.key" \
  -out "${TLS}/argus.csr" \
  -subj "/CN=argus/O=ARGUS/C=SK"

cat > "${TLS}/argus.ext" <<EOF
subjectAltName = IP:${BIND_IP},IP:127.0.0.1,DNS:argus.local
extendedKeyUsage = serverAuth
keyUsage = digitalSignature, keyEncipherment
EOF

echo "==> Signing server cert with CA..."
openssl x509 -req -in "${TLS}/argus.csr" \
  -CA "${TLS}/argus-ca.crt" -CAkey "${TLS}/argus-ca.key" -CAcreateserial \
  -out "${TLS}/argus.crt" -days "${DAYS}" -sha256 \
  -extfile "${TLS}/argus.ext"

chmod 600 "${TLS}/argus-ca.key" "${TLS}/argus.key"
rm -f "${TLS}/argus.csr" "${TLS}/argus.ext" "${TLS}/argus-ca.srl"

echo ""
echo "Done."
echo "  Server cert : tls/argus.crt  (nginx uses this on next argus-update)"
echo "  Server key  : tls/argus.key"
echo "  iPhone CA   : tls/argus-ca.crt  ← AirDrop this to your iPhone"
echo ""
echo "On iPhone:"
echo "  1. Install argus-ca.crt (Settings → Profile Downloaded → Install)"
echo "  2. Settings → General → About → Certificate Trust Settings"
echo "  3. Enable full trust for 'ARGUS Home CA'"
echo "  4. argus-update build"
echo "  5. Delete old ARGUS shortcut → Add to Home Screen from https://${BIND_IP}:9443"
