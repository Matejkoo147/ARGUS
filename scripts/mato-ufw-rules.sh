#!/usr/bin/env bash
# mato-server — reapply UFW rules WITH comments (one shot)
#
# UFW cannot attach comments to rules that already exist — this script resets
# and recreates them. Review/edit the comments below before running.
#
# Usage (on mato-server, over WireGuard):
#   chmod +x scripts/mato-ufw-rules.sh
#   sudo ./scripts/mato-ufw-rules.sh
#
# Backup first:
#   sudo ufw status numbered | tee ~/ufw-backup-$(date +%F).txt

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with: sudo $0"
  exit 1
fi

WG_SUBNET="10.8.0.0/24"
WG_IF="wg0"
LAN_IF="eno2"
SAMBA_LAN_IP="192.168.0.106"

echo "=============================================="
echo "  mato-server UFW — reset + rules with comments"
echo "=============================================="
echo ""
echo "WireGuard subnet: ${WG_SUBNET}"
echo "WG interface:     ${WG_IF}"
echo "LAN forward:      ${LAN_IF} → ${WG_IF}"
echo ""
echo "WARNING: ufw reset removes ALL current rules."
echo "Stay connected over WireGuard (SSH is VPN-only)."
echo ""
read -r -p "Continue? [y/N] " ans
[[ "${ans}" =~ ^[yY]$ ]] || { echo "Aborted."; exit 0; }

echo "==> Backing up current rules..."
ufw status numbered | tee "/root/ufw-backup-$(date +%Y%m%d-%H%M%S).txt" || true

echo "==> Resetting UFW..."
ufw --force reset

echo "==> Defaults..."
ufw default deny incoming
ufw default allow outgoing
ufw default deny routed

echo "==> Applying rules..."

# —— VPN clients only (10.8.0.0/24) ——
ufw allow from "${WG_SUBNET}" to any port 22 proto tcp comment 'SSH — WireGuard clients only'
ufw allow from "${WG_SUBNET}" to any port 80 proto tcp comment 'HTTP — web via VPN only'
ufw allow from "${WG_SUBNET}" to any port 9090 proto tcp comment 'Cockpit — server admin UI via VPN'
ufw allow from "${WG_SUBNET}" to any port 8443 proto tcp comment 'HTTPS admin (e.g. UniFi) via VPN'
ufw allow from "${WG_SUBNET}" to any port 139 proto tcp comment 'Samba (NetBIOS) via VPN'
ufw allow from "${WG_SUBNET}" to any port 445 proto tcp comment 'Samba (SMB) via VPN'

# —— Samba from one LAN host ——
ufw allow from "${SAMBA_LAN_IP}" to any port 139 proto tcp comment "Samba — LAN host ${SAMBA_LAN_IP}"
ufw allow from "${SAMBA_LAN_IP}" to any port 445 proto tcp comment "Samba — LAN host ${SAMBA_LAN_IP}"

# —— Must be reachable from the internet / anywhere ——
ufw allow 51820/udp comment 'WireGuard VPN — tunnel (public)'
ufw allow 32400/tcp comment 'Plex Media Server'
ufw allow 25565/tcp comment 'Minecraft server'
ufw allow 5520/udp comment 'UDP 5520 — edit comment if you know the service'
ufw allow 52586/tcp comment 'TCP 52586 — edit comment if you know the service'
ufw allow 52586/udp comment 'UDP 52586 — edit comment if you know the service'
ufw allow 11434/tcp comment 'Ollama API — edit to VPN-only if desired'
ufw allow 11434/udp comment 'Ollama API (UDP)'

# —— Only on WireGuard interface (VPN tunnel traffic) ——
ufw allow in on "${WG_IF}" comment 'Allow all traffic on WireGuard interface'
ufw allow in on "${WG_IF}" to any port 3000 proto tcp comment 'resell-radar (or app on :3000) via WG'
ufw allow in on "${WG_IF}" to any port 5000 proto tcp comment 'App on :5000 via WG — edit label'
ufw allow in on "${WG_IF}" to any port 7000 proto tcp comment 'App on :7000 via WG — edit label'
ufw allow in on "${WG_IF}" to any port 8000 proto tcp comment 'App on :8000 via WG — edit label'
ufw allow in on "${WG_IF}" to any port 9080 proto tcp comment 'ARGUS — home security UI via WG only'

# —— Route forwarding (your eno2 ↔ wg0 rules) ——
ufw route allow in on "${LAN_IF}" out on "${WG_IF}" comment "Forward ${LAN_IF} → ${WG_IF}"
ufw route allow in on "${WG_IF}" out on "${LAN_IF}" comment "Forward ${WG_IF} → ${LAN_IF}"

echo "==> Enabling UFW..."
ufw --force enable

echo ""
echo "Done. Verbose status (comments shown):"
echo ""
ufw status verbose

echo ""
echo "Numbered list:"
ufw status numbered
