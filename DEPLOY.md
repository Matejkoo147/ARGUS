# Deploy ARGUS on mato-server (Ubuntu + WireGuard)

Same workflow as **resell-radar** (`rr-update` on `mato-server` at `~/apps/...`).

## Architecture

```
Windows laptop (dev)          mato-server (Ubuntu)
npm run dev :5173    ──►     ARGUS :9080 (WireGuard 10.8.0.1)
git push                      Home Assistant :8123 (same host, Docker)
                                    ▲
                                    └── ARGUS proxies /api/ha/
```

- **Dev:** `npm run dev` on your laptop (`http://localhost:5173`)
- **Prod:** Docker + nginx serves the SPA on host port **9080** (default; configurable via `.env`)
- **VPN:** Open `http://10.8.0.1:9080` over WireGuard (adjust IP if yours differs)
- **Home Assistant on mato-server:** see **[HA_SETUP.md](HA_SETUP.md)** (install HA + connect ARGUS)
- **HA proxy:** nginx forwards `/api/ha/` to HA on the same server — no CORS setup needed

---

## One-time setup on mato-server

### 0. Prerequisites

```bash
# Docker + compose plugin (if not installed)
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git curl
sudo usermod -aG docker $USER
# log out and back in so docker group applies
```

### 1. Clone the project

```bash
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/Matejkoo147/ARGUS.git argus
cd argus
```

### 2. Configure environment

```bash
cp .env.example .env
nano .env
```

Example `.env` for your setup:

```env
ARGUS_PORT=9080
ARGUS_BIND_IP=10.8.0.1
TZ=Europe/Bratislava
ARGUS_PUBLIC_URL=http://10.8.0.1:9080
ARGUS_HA_UPSTREAM=http://homeassistant:8123
```

`ARGUS_BIND_IP` is the WireGuard address on mato-server. Docker listens **only** on that IP — not on your public/LAN interface.

**Finding your WG IP:** `ip -4 addr show wg0` (look for `10.8.0.1/24` or similar).

### 3. Install the update command

```bash
chmod +x scripts/argus-update.sh scripts/lib/deploy_common.sh
sudo ln -sf ~/apps/argus/scripts/argus-update.sh /usr/local/bin/argus-update
```

### 4. Firewall — WireGuard only (recommended)

Docker **bypasses UFW** for published ports, so the main protection is `ARGUS_BIND_IP=10.8.0.1` in `.env` (see above). UFW rules are an extra layer.

```bash
# 1. Remove the broad rule if you added it earlier
sudo ufw status numbered
# Note the number for "9080/tcp", then:
sudo ufw delete allow 9080/tcp

# 2. Allow only on the WireGuard interface (replace wg0 if yours differs)
sudo ufw allow in on wg0 to any port 9080 proto tcp comment 'ARGUS via WireGuard'

# Optional: restrict to VPN client subnet only
sudo ufw allow from 10.8.0.0/24 to any port 9080 proto tcp comment 'ARGUS VPN clients'

sudo ufw status verbose
```

**Verify binding** after deploy:

```bash
sudo ss -tlnp | grep 9080
# Should show 10.8.0.1:9080 — NOT 0.0.0.0:9080
```

From a machine **without** WireGuard, `http://YOUR_PUBLIC_IP:9080` should **not** connect.  
With WireGuard connected, open `http://10.8.0.1:9080`.

**Label all UFW rules with comments:** see `scripts/mato-ufw-rules.sh` — backs up, resets, and reapplies your mato-server rules with descriptions. View comments with `sudo ufw status verbose`.

WireGuard clients must have a route to `10.8.0.1` (usually automatic in your WG config).

### 5. First deploy

```bash
cd ~/apps/argus
argus-update
```

You should see: `Done. Open http://10.8.0.1:9080`

### 6. (Optional) Start on boot with systemd

```bash
sudo tee /etc/systemd/system/argus.service << 'EOF'
[Unit]
Description=ARGUS Home Security UI
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/matejkoo/apps/argus
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=matejkoo

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable argus
sudo systemctl start argus
```

---

## Fix: “port is already allocated” (8080)

Something else on mato-server already uses port 8080. ARGUS now defaults to **9080**.

```bash
cd ~/apps/argus
nano .env
# Set:
#   ARGUS_PORT=9080
#   ARGUS_PUBLIC_URL=http://10.8.0.1:9080

# Stop any failed/partial ARGUS stack
docker compose down

# See what holds 8080 (optional)
sudo ss -tlnp | grep 8080

# Redeploy
argus-update
```

To use another port (e.g. `9191`), set `ARGUS_PORT=9191` and match `ARGUS_PUBLIC_URL`.

---

## Daily workflow (edit on laptop → update server)

### Git (recommended)

**On laptop after changes:**

```powershell
cd "C:\Users\matej\Desktop\MV Security HA-App"
git add -A
git commit -m "Describe change"
git push
ssh mato-server "argus-update"
```

Or:

```powershell
.\scripts\argus-deploy-remote.ps1 -Server mato-server
```

---

## argus-update commands

| Command | Action |
|---------|--------|
| `argus-update` | `git pull` → rebuild Docker → health check |
| `argus-update build` | Rebuild without pull |
| `argus-update logs` | `docker compose logs -f argus` |
| `argus-update ps` | Container status |
| `argus-update stop` | Stop stack |

---

## HTTPS for web microphone (recommended)

Browsers block the microphone on plain `http://10.8.0.1:9080`. Enable built-in TLS:

```env
ARGUS_HTTPS=1
ARGUS_HTTPS_PORT=9443
ARGUS_PUBLIC_URL=https://10.8.0.1:9443
```

Then `argus-update`. Open **https://10.8.0.1:9443**, accept the self-signed certificate once.

### iPhone home screen icon shows “A” (not the ARGUS eye)

**This is not an icon file bug.** iOS Safari loads `https://10.8.0.1:9443/static/favicon-180.png` when you open that URL, but **Add to Home Screen refuses apple-touch-icon over untrusted HTTPS** and falls back to the first letter of “ARGUS”.

**TradingBot (Kairos) works** because it uses plain **HTTP on `10.8.0.1:5000`** — no TLS. ARGUS uses **HTTPS on :9443** for the web microphone (secure context).

**Quick proof:** open `http://10.8.0.1:9080/` → Share → Add to Home Screen. The eye icon should appear (shortcut opens HTTP; voice mic still needs HTTPS).

**Fix (recommended):** install a **private CA** on your iPhone so `:9443` is fully trusted:

```bash
cd ~/apps/argus
./scripts/generate-argus-ca.sh --force   # CN + SAN match https://10.8.0.1:9443
argus-update build
```

**On iPhone — critical steps:**

1. Install **only** `tls/argus-ca.crt` (the CA root). **Do not** install `argus.crt` (server leaf) as a profile.
2. **Settings → General → About → Certificate Trust Settings** → turn **ON** for **ARGUS Home CA** (installing the profile alone is not enough).
3. Open `https://10.8.0.1:9443` → tap padlock → must **not** say “This certificate is not valid”.
4. Delete old ARGUS shortcut → Add to Home Screen again.

If the padlock still shows invalid, the home-screen icon will stay **A** even when `/apple-touch-icon.png` loads fine in Safari.

- **HA URL in ARGUS:** `https://10.8.0.1:9443/api/ha` (auto-filled from browser URL)
- **Ollama CORS:** add both origins if needed:
  `Environment="OLLAMA_ORIGINS=http://10.8.0.1:9080,https://10.8.0.1:9443"`

**Without HTTPS:** type commands in the text box, or SSH tunnel:  
`ssh -L 9080:10.8.0.1:9080 matejkoo@10.8.0.1` → open `http://localhost:9080`

---

## First login over WireGuard

1. Connect **WireGuard** on your laptop/phone
2. Open **https://10.8.0.1:9443** (or `ARGUS_PUBLIC_URL` from `.env`)
3. **Home Assistant URL** in ARGUS:
   - **With proxy (recommended):** `https://10.8.0.1:9443/api/ha`
   - **Without proxy:** `http://<pi-lan-ip>:8123` and add CORS in HA `configuration.yaml`:
     ```yaml
     http:
       cors_allowed_origins:
         - http://10.8.0.1:9080
     ```
4. **Token:** Home Assistant → Profile → Security → Long-lived access token
5. **Display name:** auto-detected (e.g. `matejkoo`) or set manually in Settings
6. **Ollama (Settings):** e.g. `http://10.0.0.1:11434` (server LAN IP reachable over VPN)

### Verify HA proxy from server

```bash
# Should return HTTP headers from Home Assistant
curl -sI "$(grep ARGUS_HA_UPSTREAM .env | cut -d= -f2)"

# After deploy — health + proxy
curl -sf http://127.0.0.1:9080/health
curl -sI http://127.0.0.1:9080/api/ha/
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Bind for …:8080 failed` | Change `ARGUS_PORT=9080` in `.env`, run `docker compose down`, then `argus-update` |
| Can’t open :9080 on VPN | Confirm WG connected; `ip addr show wg0`; check `ss` shows `10.8.0.1:9080` |
| ARGUS loads, HA won’t connect / 504 timeout | Container can’t reach `ARGUS_HA_UPSTREAM`. HA on **same server**: `http://host.docker.internal:8123`. HA on **Pi**: use Pi LAN IP. HA only on **your laptop** won’t work — HA must run on LAN reachable from mato-server. Test: `docker compose exec argus wget -qO- --timeout=8 $ARGUS_HA_UPSTREAM/api/` |
| Changes not visible | `argus-update` on server; hard refresh browser (Ctrl+Shift+R) |
| Mic “network error” | Chrome speech needs internet; type commands manually or use SEND |
| Navbar shows USER | Settings → Display name → `matejkoo` → Save & Connect |

---

## Compare to resell-radar

| | resell-radar | ARGUS |
|---|-------------|-------|
| Path | `~/apps/resell-radar` | `~/apps/argus` |
| Update cmd | `rr-update` | `argus-update` |
| VPN URL | `http://10.8.0.1:3000` | `http://10.8.0.1:9080` |
| Stack | postgres, redis, workers… | Single nginx static container |
| Data | Database volumes | Browser localStorage (HA token, settings) |
