# mato-server — force-remove ARGUS/HA that survive reboot

Deleting `~/apps/argus` does **not** stop containers. They keep running with `restart: unless-stopped`, and a **systemd unit** may start them again on boot.

Your `~/apps/argus` only has `tls` left → no `docker-compose.yml` → `docker compose down` fails. Remove containers **by name** instead.

---

## 1) See what is alive

```bash
docker ps -a --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
systemctl list-units --type=service --all | grep -iE 'argus|home.?assistant|hass'
systemctl list-unit-files | grep -iE 'argus|home.?assistant|hass'
ls -la /etc/systemd/system/ | grep -iE 'argus|home|hass'
ls ~/apps
```

Paste that output if anything is unclear.

---

## 2) Disable systemd (so reboot does not bring them back)

```bash
sudo systemctl disable --now argus 2>/dev/null || true
sudo systemctl disable --now homeassistant 2>/dev/null || true
sudo systemctl disable --now hass 2>/dev/null || true

# Find any leftover unit files
sudo ls /etc/systemd/system/*argus* /etc/systemd/system/*home* /lib/systemd/system/*argus* 2>/dev/null

sudo rm -f /etc/systemd/system/argus.service
sudo rm -f /etc/systemd/system/homeassistant.service
sudo systemctl daemon-reload
sudo systemctl reset-failed
```

Also remove the update helper if present:

```bash
sudo rm -f /usr/local/bin/argus-update
sudo rm -f /usr/local/bin/ha-update
```

---

## 3) Stop & delete Docker containers (works without compose file)

```bash
# List names
docker ps -a --format '{{.Names}}'

# Stop everything ARGUS / HA / whisper-related (safe if name missing)
docker stop argus homeassistant whisper 2>/dev/null || true
docker rm -f argus homeassistant whisper 2>/dev/null || true

# If names differ (e.g. argus-argus-1), remove by filter:
docker ps -a --filter name=argus --format '{{.ID}} {{.Names}}'
docker ps -a --filter name=home --format '{{.ID}} {{.Names}}'
docker ps -a --filter name=whisper --format '{{.ID}} {{.Names}}'

# Remove matching containers
docker ps -aq --filter name=argus | xargs -r docker rm -f
docker ps -aq --filter name=homeassistant | xargs -r docker rm -f
docker ps -aq --filter name=whisper | xargs -r docker rm -f
```

---

## 4) Remove images & network (optional)

```bash
docker network rm ha-argus 2>/dev/null || true
docker images | grep -iE 'argus|home-assistant|whisper'
docker rmi argus-home-security:latest 2>/dev/null || true
# Only remove HA image if you are sure:
# docker rmi ghcr.io/home-assistant/home-assistant:stable
```

---

## 5) Clean leftover folders

```bash
rm -rf ~/apps/argus
rm -rf ~/apps/homeassistant
ls ~/apps
```

---

## 6) Prove reboot will not resurrect them

```bash
docker ps -a
sudo reboot
```

After login:

```bash
docker ps -a
# should NOT show argus / homeassistant

# Ollama must still work:
curl -s http://127.0.0.1:11434/api/tags | head
systemctl is-active ollama
```

---

## If they still come back

Something else is starting them (another compose project, Portainer, cron):

```bash
sudo grep -Rns 'argus\|homeassistant\|9080\|8123' /etc/systemd/system /etc/cron* ~/apps 2>/dev/null | head -50
docker inspect $(docker ps -aq) --format '{{.Name}} restart={{.HostConfig.RestartPolicy.Name}}' 2>/dev/null
```

Send that output and we finish the cleanup.
