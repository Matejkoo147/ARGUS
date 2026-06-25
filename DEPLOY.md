# Deploy ARGUS on mato-server (Ubuntu + WireGuard)

Same workflow as **resell-radar** (`rr-update` on `mato-server` at `~/apps/...`).

## Architecture

```
Windows laptop (dev)          mato-server (Ubuntu)           Pi / LAN
npm run dev :5173    ──►     Docker ARGUS :8080      ──►    Home Assistant :8123
git push / rsync              WireGuard 10.8.0.1              (optional proxy)
```

- **Dev:** `npm run dev` on your laptop
- **Prod:** Docker builds the SPA and nginx serves it on port **8080**
- **VPN:** Open `http://10.8.0.1:8080` over WireGuard (adjust IP if yours differs)
- **HA proxy (optional):** nginx forwards `/api/ha/` to your Pi — no CORS setup needed

---

## One-time setup on mato-server

### 1. Clone the project

```bash
mkdir -p ~/apps
cd ~/apps
git clone <YOUR_GITHUB_OR_GIT_URL> argus
cd argus
```

If you do not use git yet, copy the folder once with `scp -r` from Windows, then init git later.

### 2. Configure environment

```bash
cp .env.example .env
nano .env
```

Example `.env`:

```env
ARGUS_PORT=8080
TZ=Europe/Bratislava
ARGUS_PUBLIC_URL=http://10.8.0.1:8080

# Pi HA reachable from mato-server (recommended):
ARGUS_HA_UPSTREAM=http://192.168.1.50:8123
```

Use your Pi’s **LAN IP** for `ARGUS_HA_UPSTREAM` (mato-server must reach it).  
If HA runs in Docker on the same host: `http://host.docker.internal:8123` (Linux may need `extra_hosts` — use LAN IP if that fails).

### 3. Install the update command

```bash
chmod +x scripts/argus-update.sh scripts/lib/deploy_common.sh
sudo ln -sf ~/apps/argus/scripts/argus-update.sh /usr/local/bin/argus-update
```

### 4. First deploy

```bash
argus-update
```

You should see: `Done. Open http://10.8.0.1:8080`

### 5. (Optional) Start on boot with systemd

```bash
sudo tee /etc/systemd/system/argus.service << 'EOF'
[Unit]
Description=ARGUS Home Security UI
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/USER/apps/argus
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=USER

[Install]
WantedBy=multi-user.target
EOF
```

Replace `USER` with your Linux username, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable argus
sudo systemctl start argus
```

---

## Daily workflow (edit on laptop → update server)

### Option A — Git (recommended, like resell-radar)

**On laptop (once):**

```powershell
cd "C:\Users\matej\Desktop\MV Security HA-App"
git init
git add .
git commit -m "Initial ARGUS"
git remote add origin <your-repo-url>
git push -u origin main
```

**After each change with Cursor:**

```powershell
git add -A
git commit -m "Describe change"
git push
ssh mato-server "argus-update"
```

Or use the helper:

```powershell
.\scripts\argus-deploy-remote.ps1 -Server mato-server
```

### Option B — Rsync (no git)

```powershell
.\scripts\argus-deploy-remote.ps1 -Server mato-server -RsyncOnly
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

## First login on VPN

1. Connect **WireGuard**
2. Open **http://10.8.0.1:8080** (or your `ARGUS_PUBLIC_URL`)
3. **Home Assistant URL:**
   - With proxy: `http://10.8.0.1:8080/api/ha`
   - Without proxy: `http://<pi-ip>:8123` + add CORS in HA `configuration.yaml`:
     ```yaml
     http:
       cors_allowed_origins:
         - http://10.8.0.1:8080
     ```
4. **Token:** HA Profile → Long-lived access token
5. **Ollama (Settings):** e.g. `http://10.0.0.1:11434` (server LAN IP from VPN)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Can’t open :8080 on VPN | `sudo ufw allow 8080`; check WireGuard routes to mato-server |
| ARGUS loads, HA won’t connect | Check `ARGUS_HA_UPSTREAM`; test from server: `curl -I $ARGUS_HA_UPSTREAM` |
| Changes not visible | Run `argus-update` (hard refresh browser: Ctrl+Shift+R) |
| `connection refused` on laptop | That’s **dev** — run `npm run dev` locally; prod is on the server |

---

## Compare to resell-radar

| | resell-radar | ARGUS |
|---|-------------|-------|
| Path | `~/apps/resell-radar` | `~/apps/argus` |
| Update cmd | `rr-update` | `argus-update` |
| VPN URL | `http://10.8.0.1:3000` | `http://10.8.0.1:8080` |
| Stack | postgres, redis, workers… | Single nginx static container |
| Data | Database volumes | Browser localStorage (HA token, settings) |
