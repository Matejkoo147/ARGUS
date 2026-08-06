# mato-server cleanup — Ollama only

**Goal:** Remove ARGUS + Home Assistant Docker from the home server.  
**Keep:** Ollama (and anything unrelated: WireGuard, Odysseus, etc.).

Do this **after** you have (or accept losing) any HA data you care about. Prefer exporting an HA backup first if you will restore on the Pi.

---

## 0) Before you delete — optional HA backup

If old HA on mato-server still has useful config:

1. Open old HA UI → Settings → System → Backups → Download.  
2. Or copy the config folder:

```bash
ssh mato-server
sudo tar -czvf ~/ha-backup-$(date +%F).tar.gz -C ~/apps/homeassistant config
# copy that file to your PC / Pi before deleting
```

Screenshot for thesis: backup dialog or `ls` of the tarball (**optional**).

---

## 1) See what is running

```bash
ssh mato-server

docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
systemctl is-enabled argus 2>/dev/null; systemctl status argus --no-pager 2>/dev/null | head -15
ls ~/apps
```

You typically care about containers named like `argus`, `homeassistant`, maybe `whisper`.

**Do not stop** whatever runs **Ollama** (often a systemd service `ollama`, not Docker).

```bash
systemctl status ollama --no-pager 2>/dev/null | head -20
# or
ss -tlnp | grep 11434
```

---

## 2) Stop ARGUS stack

```bash
cd ~/apps/argus 2>/dev/null && docker compose --profile stt down || true
# if argus-update exists:
argus-update stop 2>/dev/null || true
cd ~/apps/argus && docker compose down --remove-orphans 2>/dev/null || true
```

Disable systemd unit if you enabled it:

```bash
sudo systemctl disable --now argus 2>/dev/null || true
sudo rm -f /etc/systemd/system/argus.service
sudo systemctl daemon-reload
```

Remove the helper symlink (optional):

```bash
sudo rm -f /usr/local/bin/argus-update
```

---

## 3) Stop Home Assistant on mato-server

```bash
cd ~/apps/homeassistant 2>/dev/null && docker compose down --remove-orphans || true
docker rm -f homeassistant 2>/dev/null || true
```

---

## 4) Remove unused Docker network / images (optional)

```bash
docker network rm ha-argus 2>/dev/null || true
docker images | grep -E 'argus|home-assistant|whisper' || true
# only remove ARGUS-related images, not unrelated ones:
docker rmi argus-home-security:latest 2>/dev/null || true
```

---

## 5) Delete app folders (when sure)

```bash
# KEEP the HA backup tarball if you made one in ~
rm -rf ~/apps/argus
rm -rf ~/apps/homeassistant
```

Repo on GitHub stays — you only delete the **server copy**. Dev on the laptop (`Desktop/MV Security HA-App`) stays for Pi deploy.

---

## 6) Firewall — drop ARGUS ports, keep Ollama for the Pi

```bash
sudo ufw status numbered
# Delete rules that allow 9080 / 9443 for ARGUS (numbers change — check first)
# Example (do NOT copy blindly):
#   sudo ufw delete <number>
```

Allow the **Pi** to reach Ollama (replace with Pi LAN IP or whole LAN):

```bash
# Example: LAN subnet
sudo ufw allow from 192.168.0.0/24 to any port 11434 proto tcp comment 'Ollama for ARGUS Pi'

# Or only the Pi:
# sudo ufw allow from 192.168.0.XX to any port 11434 proto tcp comment 'Ollama ARGUS Pi only'

sudo ufw status verbose
```

Confirm Ollama listens (often `127.0.0.1` only — then the Pi **cannot** reach it). If needed, set Ollama to listen on LAN:

```bash
# Common approach — check how you installed Ollama
# Environment: OLLAMA_HOST=0.0.0.0:11434
sudo systemctl edit ollama
# add:
# [Service]
# Environment="OLLAMA_HOST=0.0.0.0:11434"
sudo systemctl daemon-reload
sudo systemctl restart ollama
ss -tlnp | grep 11434
```

**Screenshot for thesis (P-SERVER):** `ollama list` + `ss -tlnp | grep 11434` showing LAN listen.

---

## 7) Verify cleanup

```bash
docker ps
# should NOT show argus / homeassistant

curl -s http://127.0.0.1:11434/api/tags | head
# should still list models

ss -tlnp | grep -E '9080|9443|8123' || echo 'ARGUS/HA ports free'
```

From the **Pi** (after it is on the same LAN):

```bash
curl -s http://<mato-server-lan-ip>:11434/api/tags | head
```

---

## Thesis note

Old architecture: ARGUS + HA + Ollama on mato-server.  
New architecture: **Pi = HA + ARGUS kiosk**, **mato-server = Ollama only**.  
Document this migration in the thesis “deployment evolution” section; keep one screenshot of the emptied `docker ps` and one of Ollama still healthy.
