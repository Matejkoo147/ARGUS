# Home Assistant on mato-server

Run **Home Assistant** on the same machine as **ARGUS** (`mato-server`). ARGUS talks to HA through an internal Docker proxy — you only need WireGuard + `http://10.8.0.1:9080` on your laptop.

## Architecture

```
Laptop (WireGuard)              mato-server (Ubuntu)
─────────────────────          ─────────────────────────────────────
http://10.8.0.1:9080    →      ARGUS (Docker) :9080 on 10.8.0.1
       │                              │
       │                              │ proxy /api/ha/
       │                              ▼
       │                       Home Assistant :8123 (Docker, host network)
       │                              │
       └──────────────────────────────┘  (optional direct HA UI :8123 on LAN/VPN)
```

| Service | URL (you) | Notes |
|---------|-----------|--------|
| **ARGUS** | `http://10.8.0.1:9080` | Main UI — WireGuard only |
| **HA via ARGUS** | `http://10.8.0.1:9080/api/ha` | Use this in ARGUS login |
| **HA direct (setup)** | `http://192.168.0.104:8123` | LAN IP of mato-server — first-time wizard |

Replace `192.168.0.104` with your server’s real LAN IP (`hostname -I`).

---

## Part 1 — Install Home Assistant (one time)

SSH to mato-server:

```bash
ssh matejkoo@10.8.0.1
```

### 1. Create HA directory

```bash
mkdir -p ~/apps/homeassistant
cd ~/apps/homeassistant
```

### 2. Copy Docker Compose from ARGUS repo

If you already cloned ARGUS:

```bash
cp ~/apps/argus/deploy/homeassistant/docker-compose.yml ~/apps/homeassistant/
```

Or download only the file:

```bash
curl -fsSL https://raw.githubusercontent.com/Matejkoo147/ARGUS/main/deploy/homeassistant/docker-compose.yml \
  -o ~/apps/homeassistant/docker-compose.yml
```

### 3. Start Home Assistant

```bash
cd ~/apps/homeassistant
docker compose up -d
```

First start takes **2–5 minutes** (downloads image, creates `config/`).

Watch logs:

```bash
docker compose logs -f homeassistant
```

Stop when you see something like `Home Assistant initialized` / no more errors. Press `Ctrl+C`.

### 4. Open the setup wizard

From a PC on the **same LAN** as the server (or over VPN):

```
http://192.168.0.104:8123
```

(or `http://10.8.0.1:8123` with WireGuard connected)

Complete the wizard:

1. Create your account (e.g. **matejkoo**)
2. Set home name, location, timezone (**Europe/Bratislava**)
3. Skip optional integrations for now — you can add cameras/sensors later

### 5. Create a long-lived token for ARGUS

In Home Assistant:

1. Click your **profile** (bottom left)
2. **Bezpečnosť** / **Security** tab
3. **Prístupové tokeny s dlhou životnosťou** → **Vytvoriť token**
4. Name: `argus`
5. **Copy the token** — shown only once

### 5b. Allow ARGUS reverse proxy (fixes HTTP 400)

Edit HA config on the server:

```bash
nano ~/apps/homeassistant/config/configuration.yaml
```

Add (or merge into existing `http:` block):

```yaml
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 172.16.0.0/12
    - 10.8.0.0/24
```

Restart HA:

```bash
cd ~/apps/homeassistant
docker compose restart
```

### 6. (Optional) Install `ha-update` command

```bash
chmod +x ~/apps/argus/scripts/ha-update.sh
sudo ln -sf ~/apps/argus/scripts/ha-update.sh /usr/local/bin/ha-update
```

Updates later: `ha-update`

---

## Part 2 — Connect ARGUS to HA on the same server

ARGUS runs in Docker. HA uses **host network** on port **8123**. Use the **shared Docker network** — in `.env`:

```
ARGUS_HA_UPSTREAM=http://homeassistant:8123
```

**Do not** use `192.168.0.104` in `.env` — Docker often cannot reach the host’s LAN IP from inside a container (that caused your 504 timeout).

### 1. Edit ARGUS `.env`

```bash
nano ~/apps/argus/.env
```

Set:

```env
ARGUS_PORT=9080
ARGUS_BIND_IP=10.8.0.1
ARGUS_PUBLIC_URL=http://10.8.0.1:9080
TZ=Europe/Bratislava

ARGUS_HA_UPSTREAM=http://homeassistant:8123
```

Save (`Ctrl+O`, Enter, `Ctrl+X`).

### 2. Redeploy ARGUS

```bash
cd ~/apps/argus
git pull
./scripts/argus-update.sh
```

You should see:

```
==> HA reachability from container:
    OK — container can reach Home Assistant
```

If it says **FAILED**:

```bash
# Is HA running?
docker ps | grep homeassistant
curl -s --max-time 5 http://127.0.0.1:8123/api/

# Test from ARGUS container
cd ~/apps/argus
docker compose exec argus wget -qO- --timeout=8 http://homeassistant:8123/api/
```

### 3. Log in to ARGUS (laptop, WireGuard on)

Open: **http://10.8.0.1:9080**

| Field | Value |
|-------|--------|
| **Home Assistant URL** | `http://10.8.0.1:9080/api/ha` |
| **Token** | token `argus` from step 5 above |

Click **AUTHENTICATE VIA HA**.

---

## Part 3 — Firewall (recommended)

- **ARGUS `9080`** — WireGuard only (already in `DEPLOY.md`)
- **HA `8123`** — optional: allow only LAN + VPN, not the public internet

Examples:

```bash
# HA UI from VPN subnet only
sudo ufw allow from 10.8.0.0/24 to any port 8123 proto tcp comment 'Home Assistant via VPN'

# HA UI from home LAN (adjust subnet)
sudo ufw allow from 192.168.0.0/24 to any port 8123 proto tcp comment 'Home Assistant LAN'
```

ARGUS proxy still works as long as HA listens on `localhost:8123` on the host (host network mode does this).

---

## Migrate from HA on your laptop

If you already used HA in Docker on Windows with a `config` folder:

1. **Stop** laptop HA
2. **Copy** the whole `config` directory to the server:

   ```powershell
   # From Windows (adjust paths)
   scp -r "\\path\to\your\ha\config" matejkoo@10.8.0.1:~/apps/homeassistant/
   ```

   Or use WinSCP / rsync.

3. On server:

   ```bash
   cd ~/apps/homeassistant
   docker compose down
   # ensure config/ is in place with configuration.yaml, .storage, etc.
   docker compose up -d
   ```

4. Open `http://192.168.0.104:8123` — your users, entities, and tokens should be there (existing tokens still work).

---

## Daily commands

| Task | Command |
|------|---------|
| Update ARGUS | `argus-update` |
| Update Home Assistant | `ha-update` |
| HA logs | `ha-update logs` |
| ARGUS logs | `argus-update logs` |
| Restart HA | `cd ~/apps/homeassistant && docker compose restart` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `504` / `upstream timed out` on login | Use `ARGUS_HA_UPSTREAM=http://homeassistant:8123` and shared `ha-argus` network. Recreate HA without `network_mode: host`. |
| `VERIFYING IDENTITY...` forever | Run container test (Part 2 step 2) |
| HA UI won’t open | `docker compose ps` in `~/apps/homeassistant`; wait 5 min on first boot |
| ARGUS works, no entities | Add integrations in HA first; ARGUS only displays what HA has |
| `<!DOCTYPE` / HTML instead of JSON | Nginx proxy path bug — `git pull && ./scripts/argus-update.sh`; run `./scripts/check-ha-link.sh` |
| HTTP 400 on login | Add `trusted_proxies` to HA `configuration.yaml` (see HA_SETUP §5b); redeploy ARGUS; create a **new** token |
| Bluetooth / `hci0` errors in logs | Harmless for web UI. For BLE devices, add `cap_add: NET_ADMIN, NET_RAW` to compose (see `deploy/homeassistant/docker-compose.yml`) and `docker compose up -d --force-recreate` |

---

## After setup — add devices

In Home Assistant (web UI at `:8123`):

- **Settings → Devices & services → Add integration**
- Cameras, motion sensors, alarm panel, etc.

They appear automatically in ARGUS after HA discovers them.

For thesis / ARGUS voice: configure **Ollama** in ARGUS Settings (`http://10.8.0.1:11434` or your Ollama host).
