#!/usr/bin/env bash
# Generate a private CA + ARGUS server cert for trusted HTTPS on iPhone/iPad.
#
# iOS "Add to Home Screen" needs a VALID HTTPS connection for apple-touch-icon.
# Browsing https://10.8.0.1:9443 with an untrusted / hostname-mismatched cert → letter "A".
#
# Usage (on mato-server):
#   ./scripts/generate-argus-ca.sh          # first time
#   ./scripts/generate-argus-ca.sh --force  # regenerate (after IP change etc.)
#
# iPhone — install ONLY tls/argus-ca.crt (the CA root), NOT argus.crt:
#   1. AirDrop argus-ca.crt → Install profile
#   2. Settings → General → About → Certificate Trust Settings → ON for "ARGUS Home CA"
#   3. argus-update build
#   4. Safari padlock on https://10.8.0.1:9443 must NOT say "certificate is not valid"
#   5. Delete old shortcut → Add to Home Screen

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TLS="${ROOT}/tls"
DAYS=825
BIND_IP="${ARGUS_BIND_IP:-10.8.0.1}"
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -h|--help)
      echo "Usage: $0 [--force]"
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

mkdir -p "${TLS}"

if [ -f "${TLS}/argus-ca.key" ] && [ -f "${TLS}/argus.crt" ] && [ "${FORCE}" -eq 0 ]; then
  echo "TLS already exists in tls/ (use --force to regenerate)."
  echo "CA for iPhone (install this ONLY): ${TLS}/argus-ca.crt"
  exit 0
fi

echo "==> Creating private CA..."
openssl genrsa -out "${TLS}/argus-ca.key" 4096
openssl req -x509 -new -nodes -key "${TLS}/argus-ca.key" -sha256 -days "${DAYS}" \
  -out "${TLS}/argus-ca.crt" \
  -subj "/CN=ARGUS Home CA/O=ARGUS/C=SK"

echo "==> Creating server cert for https://${BIND_IP}:9443 ..."
openssl genrsa -out "${TLS}/argus.key" 2048
openssl req -new -key "${TLS}/argus.key" \
  -out "${TLS}/argus.csr" \
  -subj "/CN=${BIND_IP}/O=ARGUS/C=SK"

cat > "${TLS}/argus.ext" <<EOF
subjectAltName = IP:${BIND_IP},IP:127.0.0.1,DNS:argus,DNS:argus.local
extendedKeyUsage = serverAuth
keyUsage = digitalSignature, keyEncipherment
basicConstraints = CA:FALSE
EOF

openssl x509 -req -in "${TLS}/argus.csr" \
  -CA "${TLS}/argus-ca.crt" -CAkey "${TLS}/argus-ca.key" -CAcreateserial \
  -out "${TLS}/argus.crt" -days "${DAYS}" -sha256 \
  -extfile "${TLS}/argus.ext"

chmod 600 "${TLS}/argus-ca.key" "${TLS}/argus.key"
rm -f "${TLS}/argus.csr" "${TLS}/argus.ext" "${TLS}/argus-ca.srl"

echo ""
echo "==> Certificate details:"
openssl x509 -in "${TLS}/argus.crt" -noout -subject -issuer -ext subjectAltName

echo ""
echo "Done."
echo "  Server cert : tls/argus.crt   (nginx uses this — do NOT install on iPhone)"
echo "  Server key  : tls/argus.key"
echo "  iPhone CA   : tls/argus-ca.crt  ← install ONLY this file on iPhone"
echo ""
echo "On iPhone:"
echo "  1. Remove old ARGUS profiles if you installed argus.crt (leaf) by mistake"
echo "  2. Install argus-ca.crt only"
echo "  3. Settings → General → About → Certificate Trust Settings → enable ARGUS Home CA"
echo "  4. argus-update build"
echo "  5. Open https://${BIND_IP}:9443 → padlock must be valid (no red X)"
echo "  6. Add to Home Screen"
