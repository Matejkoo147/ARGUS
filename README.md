# ARGUS — All-Seeing Guardian

**ARGUS** is a custom cyberpunk web interface for [Home Assistant](https://www.home-assistant.io/), built for a smart home security thesis on Raspberry Pi 5. It replaces the default HA UI with a neon HUD inspired by the KAIROS trading bot — while keeping full Home Assistant functionality underneath.

> *ARGUS Panoptes* (Ἄργος) — the hundred-eyed giant of Greek myth, chosen by Hera to watch over Io. Nothing escapes his gaze. You address the AI voice assistant as **"ARGUS"**.

## Logo

The ARGUS emblem is a central all-seeing eye surrounded by eight satellite watcher eyes — your perimeter cameras and sensors as one vigilant network. The SVG lives in `src/components/ArgusLogo.tsx` and `public/favicon.svg`; swap it anytime for your thesis casing engrave or 3D print.

## Features

- **Cyberpunk HUD** — Orbitron + JetBrains Mono, neon cyan/green/red, corner brackets, scanline grid (matches KAIROS)
- **ARGUS logo** — multi-eye SVG emblem with neon glow
- **Full HA backend** — WebSocket API: live states, service calls, logbook, cameras
- **Security dashboard** — Arm/disarm, motion/door status, sensor breakdown, health ring
- **Devices** — All HA entities, toggle lights/switches/locks/covers
- **Cameras** — Live proxy feeds from HA
- **Sensors** — PIR, doors, BLE accelerometer tags
- **Voice** — Browser speech + TTS; ready for ESP32 mic / HA Assist
- **Automations** — Trigger HA automations & scripts
- **History** — HA logbook viewer

## Quick Start

### 1. Home Assistant (Pi 5)

Install [Home Assistant OS](https://www.home-assistant.io/installation/raspberrypi) on your Raspberry Pi 5. Add your sensors, cameras, ESP32, BLE tags through normal HA integrations.

### 2. Create an access token

In HA: **Profile → Security → Long-Lived Access Tokens → Create Token**

### 3. Run ARGUS (development)

```bash
cd "MV Security HA-App"
npm install
npm run dev
```

Open `http://localhost:5173`, enter your HA URL (e.g. `http://192.168.1.50:8123`) and token.

### 4. Production build (thesis / kiosk)

```bash
npm run build
```

Serve the `dist/` folder with nginx, Caddy, or the HA **nginx** add-on.

**Production on Ubuntu (mato-server + WireGuard):** see **[DEPLOY.md](./DEPLOY.md)** — Docker + `argus-update` (same pattern as resell-radar `rr-update`).

**Home Assistant on mato-server:** see **[HA_SETUP.md](./HA_SETUP.md)** — install HA next to ARGUS and fix the login/proxy URL.

**ESP32-CAM live feed:** see **[ESP32_CAM.md](./ESP32_CAM.md)** — flash firmware, add to HA, assign cameras in ARGUS.

Example nginx on the Pi:

```nginx
server {
    listen 8080;
    root /opt/argus/dist;
    try_files $uri $uri/ /index.html;
}
```

## CORS (if needed)

If the browser blocks API calls, add to `configuration.yaml`:

```yaml
http:
  cors_allowed_origins:
    - http://localhost:5173
    - http://192.168.1.x:8080
```

Restart Home Assistant after changes.

## Thesis Hardware Map

```
┌─────────────────────────────────────────────┐
│  Raspberry Pi 5 — Home Assistant OS         │
│  ┌─────────────┐    ┌──────────────────┐   │
│  │ ARGUS UI    │◄──►│ HA Core + API    │   │
│  │ (this app)  │ WS │ Automations      │   │
│  └─────────────┘    └────────┬─────────┘   │
└────────────────────────────────┼─────────────┘
         │           │           │           │
    PIR sensors   ESP32 mic   BLE tags    AI camera
    Door contacts  + speaker  accelerometer  (Frigate)
    Siren relay    voice AI
```

### Voice (ESP32)

1. Flash ESP32 with ESPHome (microphone + speaker).
2. Add to Home Assistant.
3. Pipe to [Home Assistant Assist](https://www.home-assistant.io/voice_control/) or your LLM.
4. ARGUS Voice tab already sends arm/disarm/status commands — extend with Assist webhooks.

### BLE accelerometer tags

Use `ble_monitor`, `BTHome`, or ESPHome `ble_client` — entities appear automatically in **Sensors**.

## Project Structure

```
src/
  components/     ArgusLogo, app shell, connect screen, cyber widgets
  context/        HA WebSocket state management
  lib/            Home Assistant API client
  pages/          Dashboard, devices, cameras, voice, etc.
  styles/         Cyberpunk CSS (KAIROS-inspired)
public/
  favicon.svg     ARGUS multi-eye emblem
```

## Talk to ARGUS

Examples once voice is connected:

- *"ARGUS, status"*
- *"Arm away"*
- *"Disarm"*
- *"Any motion?"*
- *"How many cameras online?"*

## License

Thesis / personal project — use freely for your master thesis demonstration.
