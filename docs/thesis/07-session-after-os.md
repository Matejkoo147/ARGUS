# Session guide — after Pi OS is up (2026-08-07)

You already have: cooler, Touch Display 2, Ethernet, Pi OS, apt upgraded, touch working.

## A) Screenshots / photos — do these now (catch-up)

Shoot even if assembly is already done (close-ups are fine).

| When | ID | What |
|------|-----|------|
| **Now** | P-COOLER | Cooler on the board (top + FAN cable) |
| **Now** | P-DSI | Ribbon into display + into Pi DISP; GPIO power to J1 |
| **Now** | P-ETH | Ethernet adapter / cable plugged in |
| **Now** | P-PSU | 27 W PSU connected |
| **Now** | P-STORAGE | microSD in the Pi |
| **Now** | P-BOOT | Desktop on the Touch Display (portrait is OK — label “before landscape”) |
| **Now** | — | Terminal: `hostname; hostname -I; cat /etc/os-release \| head -4` (screenshot) |
| Optional | P-IMAGER | If you still have Imager screenshots from flashing — keep them |
| Optional | P-UNBOX | Unboxing if you still can recreate |

Save under `docs/thesis/photos/` later (or a phone album named ARGUS-thesis).

---

## B) Landscape (do this before Docker)

### Screenshot **before**
- Whole desktop in **portrait** (you may already have P-BOOT).

### Rotate (Bookworm desktop)

1. **Preferences → Screen Configuration** (or right-click desktop → Display / Screen Configuration).
2. Right-click the DSI / Touch Display entry → **Orientation** → try **Right** or **Left** (90° / 270°) until the long edge is horizontal and the UI looks landscape.
3. **Apply** → **OK** → make sure it asks to keep changes.
4. Physically turn the display/mount to match.
5. **Test touch:** tap icons — if X/Y are wrong, try the other 90° direction.

### Persist (if it resets after reboot)

On many Bookworm images Screen Configuration already writes config. If not, after it works, reboot once and confirm it sticks. Paste the working method into `04-landscape-touch-display.md`.

### Screenshot **after**
| ID | What |
|----|------|
| P-MOUNT | Pi + display in landscape on the desk/stand |
| — | Desktop fully landscape |
| — | Browser → `chrome://version` or any page; DevTools console: `innerWidth` / `innerHeight` ≈ **1280×720** (or similar landscape) |

---

## C) Install Docker (next)

On the Pi (SSH or Terminal on the display):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

**Log out and back in** (or reboot) so `docker` works without sudo.

```bash
docker --version
docker compose version
```

**Screenshot:** those two version lines in the terminal.

---

## D) Home Assistant on the Pi

```bash
mkdir -p ~/apps/homeassistant
cd ~/apps/homeassistant
# After ARGUS is cloned you can copy the compose file; or:
curl -fsSL https://raw.githubusercontent.com/Matejkoo147/ARGUS/main/deploy/homeassistant/docker-compose.yml \
  -o docker-compose.yml

docker network create ha-argus 2>/dev/null || true
docker compose up -d
```

Wait ~1–2 minutes, then on the Pi browser or laptop:

`http://<pi-ip>:8123`

### Screenshots (important for thesis)
| ID | What |
|----|------|
| P-HA | HA onboarding / create user |
| — | HA Overview empty or with first integration |

Create your HA user, then create a **Long-Lived Access Token** (Profile → Security) — you will paste it into ARGUS later. **Do not put the token in git/photos** — crop/redact.

---

## E) ARGUS on the Pi

```bash
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/Matejkoo147/ARGUS.git argus
cd argus
cp .env.example .env
nano .env
```

Set at least (use your real IPs):

```env
ARGUS_PORT=9080
ARGUS_HTTPS=0
ARGUS_BIND_IP=0.0.0.0
TZ=Europe/Bratislava
ARGUS_PUBLIC_URL=http://127.0.0.1:9080
ARGUS_HA_UPSTREAM=http://homeassistant:8123
ARGUS_OLLAMA_UPSTREAM=http://<MATO-SERVER-LAN-IP>:11434
```

Notes:
- `ARGUS_BIND_IP=0.0.0.0` = reachable on the Pi and from your laptop on LAN (mato-server used WireGuard-only; Pi kiosk needs this).
- Start with **HTTP** (`ARGUS_HTTPS=0`) to simplify; add HTTPS later for mic if needed.
- Ollama stays on **mato-server** — that host must allow the Pi to reach `:11434` (firewall).

```bash
chmod +x scripts/argus-update.sh scripts/lib/deploy_common.sh
sudo ln -sf ~/apps/argus/scripts/argus-update.sh /usr/local/bin/argus-update
docker network create ha-argus 2>/dev/null || true
argus-update build
```

Open on the Pi: `http://127.0.0.1:9080`  
Login with HA URL `http://127.0.0.1:9080/api/ha` + token.

### Screenshots
| ID | What |
|----|------|
| P-ARGUS | ARGUS Home in **landscape** on the touch panel |
| P-VOICE | Voice → **TEST** → reply with model + number |
| P-SERVER | mato-server Ollama running / `ollama list` (from server) |
| P-TOPO | Simple diagram: Pi (HA+ARGUS) ↔ Ethernet ↔ mato-server (Ollama) |

---

## Suggested order tonight

1. Catch-up hardware photos (5–10 min)  
2. Landscape + verify touch + screenshots  
3. Docker install + reboot  
4. If energy left: HA container + onboarding (P-HA)  
5. ARGUS can be next session if it’s late  

Stop after any step and message what you see (especially landscape / Docker errors).
