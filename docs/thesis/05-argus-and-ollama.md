# ARGUS on the Pi · Ollama on mato-server

## Roles

| Service | Host | Port / URL |
|---------|------|------------|
| Home Assistant | Pi 5 | `:8123` (and via ARGUS `/api/ha`) |
| ARGUS SPA + nginx | Pi 5 | `:9080` HTTP and/or `:9443` HTTPS |
| Ollama | **mato-server** | `:11434` (native) — Pi reaches it via LAN or `/api/ollama` proxy |

## Deploy outline (Pi, after OS + Docker)

Mirror the mato-server flow from `DEPLOY.md`, adapted:

```bash
# on Pi
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/Matejkoo147/ARGUS.git argus
cd argus
cp .env.example .env
# Edit:
#   ARGUS_HA_UPSTREAM=http://homeassistant:8123   # or host gateway IP
#   ARGUS_OLLAMA_UPSTREAM=http://<mato-server-lan-ip>:11434
#   ARGUS_PUBLIC_URL=http://<pi-lan-ip>:9080
```

Then:

```bash
sudo ln -sf ~/apps/argus/scripts/argus-update.sh /usr/local/bin/argus-update
argus-update build
```

Kiosk opens `http://127.0.0.1:9080` (or HTTPS if certs exist).

## Ollama settings in ARGUS UI

Settings → Ollama:

- URL: `http://<pi>:9080/api/ollama` (same-origin proxy) **or** direct LAN if HTTP allowed
- Model: same as Odysseus (e.g. `qwen2.5:3b`)
- Voice **TEST** must stay in the conversation (model + random 0–9999)

## Security notes for thesis

- Prefer LAN-only bind or VPN for ARGUS admin.
- Long-lived HA tokens; no separate ARGUS accounts.
- Document firewall rules on Pi and mato-server.

## Migration from old mato-server HA / ARGUS

Full cleanup checklist: [`08-mato-server-ollama-only.md`](08-mato-server-ollama-only.md).

1. Export HA backups from old Docker HA (if any).
2. Restore on Pi HA (or start fresh).
3. Point cameras/sensors at new HA on the Pi.
4. Stop & delete ARGUS + HA on mato-server; **leave Ollama running**.
5. Open firewall so the Pi can reach `mato-server:11434`.
6. Point ARGUS on the Pi at that Ollama URL.
