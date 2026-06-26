# ESP32-CAM → Home Assistant → ARGUS

Connect one **ESP32-CAM** to **Home Assistant** on `mato-server`, then view the live feed in **ARGUS** (Dashboard, Cameras tab) and build automations in HA.

ARGUS does **not** talk to the ESP32 directly. Flow:

```
ESP32-CAM  →  Wi‑Fi (LAN)  →  Home Assistant  →  ARGUS (camera_proxy over HTTPS)
```

---

## What you need

### Hardware

| Item | Notes |
|------|--------|
| **ESP32-CAM** (AI-Thinker module) | Most common; has OV2640 camera |
| **USB‑to‑TTL adapter** | CP2102 or CH340, **3.3 V logic** |
| **Jumper wires** | Female–female |
| **5 V power supply** | **≥ 2 A** (camera peaks current; USB from PC is often too weak for runtime) |
| **Micro‑USB cable** | For programmer (not always on ESP32-CAM board) |

Optional: breadboard, external antenna ESP32-CAM if Wi‑Fi is weak.

### Software (pick one flashing path)

| Tool | Where |
|------|--------|
| **ESPHome** (recommended) | Flash + HA integration in one step |
| **Home Assistant** | Already on `mato-server` (`http://192.168.0.104:8123`) |
| **ARGUS** | `https://argus.local:9443` after deploy |

### Network

- ESP32-CAM must join the **same LAN** as `mato-server` (e.g. `192.168.0.x`).
- HA runs in Docker on that server — the camera is reached over **LAN IP**, not WireGuard.
- Your laptop uses ARGUS over **WireGuard**; HA proxy still serves the stream.

---

## Part 1 — Wire the ESP32-CAM for flashing

**AI-Thinker ESP32-CAM** (typical):

| USB‑TTL | ESP32-CAM |
|---------|-----------|
| GND | GND |
| 3.3 V | 3.3 V (use 3.3 V only — **not 5 V** on 3.3 V pin) |
| TX | U0R (GPIO3) |
| RX | U0T ( GPIO1) |

**Enter flash mode:**

1. Connect **GPIO0 to GND** (hold “FLASH” button if your board has one).
2. Press **RESET** (or power cycle).
3. Release GPIO0 **after** upload starts.

GPIO0 pin is usually labeled on the board; grounding it = download mode.

---

## Part 2 — Install ESPHome (on your Windows PC)

Easiest: flash from your laptop, then HA discovers the camera on LAN.

```powershell
pip install esphome
```

**Windows path rule:** the project folder must **not contain spaces**. If the repo lives under `MV Security HA-App`, either:

- Copy config to `C:\Users\matej\argus-esphome` and run from there, or
- Use the helper script from the repo:

```powershell
cd "C:\Users\matej\Desktop\MV Security HA-App\deploy\esphome"
.\flash.ps1
```

That copies `argus-cam-1.yaml` + `secrets.yaml` to `C:\Users\matej\argus-esphome` and runs `esphome run`.

### Web dashboard (easiest day-to-day)

From PowerShell:

```powershell
cd "C:\Users\matej\Desktop\MV Security HA-App\deploy\esphome"
.\dashboard.ps1
```

Opens **http://localhost:6052** in your browser:

1. Click **ARGUS Cam 1** (or your YAML name)
2. **INSTALL** — first time over USB (GPIO0 → GND, RESET, pick COM port in the popup)
3. **LOGS** — live serial output in the browser
4. Later: **WIRELESS INSTALL** / **UPDATE** — OTA without USB

Edit YAML in the repo, run `.\dashboard.ps1` again to sync files to `C:\Users\matej\argus-esphome`, then refresh the dashboard.

Or use **ESPHome Web**: https://web.esphome.io (Chrome, USB cable).

On **mato-server** (optional):

```bash
pip install esphome
# or
docker run --rm -v "${PWD}:/config" -it ghcr.io/esphome/esphome
```

---

## Part 3 — ESPHome config (copy this)

Create `~/argus-cam-1.yaml` (or `C:\Users\matej\argus-cam-1.yaml`):

```yaml
esphome:
  name: argus-cam-1
  friendly_name: ARGUS Cam 1
  min_version: 2024.6.0

esp32:
  board: esp32cam
  framework:
    type: arduino

psram:
  mode: quad
  speed: 80MHz

# --- CHANGE THESE ---
wifi:
  ssid: "YOUR_WIFI_NAME"
  password: "YOUR_WIFI_PASSWORD"
  ap:
    ssid: "Argus-Cam-1 Fallback"
    password: "argus1234"

api:
  encryption:
    key: "GENERATE_WITH_ESPHOME_WIZARD_OR_REPLACE_ME_32_CHARS_BASE64="

ota:
  - platform: esphome
    password: "pick_a_strong_ota_password"

logger:

# Home Assistant sees this as camera.argus_cam_1
esp32_camera:
  name: ARGUS Cam 1
  external_clock:
    pin: GPIO0
    frequency: 20MHz
  i2c_pins:
    sda: GPIO26
    scl: GPIO27
  data_pins: [GPIO5, GPIO18, GPIO19, GPIO21, GPIO36, GPIO39, GPIO34, GPIO35]
  vsync_pin: GPIO25
  href_pin: GPIO23
  pixel_clock_pin: GPIO22
  power_down_pin: GPIO32
  resolution: 800x600
  jpeg_quality: 10
  max_framerate: 10 fps
  idle_framerate: 0.1 fps

# Optional: status LED (many AI-Thinker boards — GPIO33 flash LED)
status_led:
  pin: GPIO33
```

Create `secrets.yaml` next to the YAML file (ESPHome has **no** `esphome secrets` command). Copy from `secrets.yaml.example`, then generate a key in **PowerShell**:

```powershell
$b = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
[Convert]::ToBase64String($b)
```

Paste that output as `api_encryption_key` in `secrets.yaml`.

**First-time compile + flash (USB):**

```powershell
cd C:\Users\matej\argus-esphome
esphome run argus-cam-1.yaml
```

Or from the repo: `.\deploy\esphome\flash.ps1`

Pick the COM port (Windows: `COM3`, etc.). Keep GPIO0 grounded until flashing starts.

### One config, many cameras?

| What | Reuse? |
|------|--------|
| `secrets.yaml` (Wi‑Fi, API key style) | Yes — same file for every cam |
| `argus-cam-1.yaml` | **One physical ESP32 per file** — duplicate as `argus-cam-2.yaml` with `name: argus-cam-2` |
| `esphome run` | Run **once per board** (first time over USB) |
| Later updates | **OTA** to that same board (`esphome run --device argus-cam-1.local`) |

You do **not** flash once and swap SD-style between boards — each ESP32 stores its own firmware and hostname. For a second camera, copy the YAML, change `name` / `friendly_name`, flash the second board.

**After first flash:** power the board with **5 V 2 A**, remove GPIO0 jumper, press RESET. It should join Wi‑Fi.

---

## Part 4 — Add camera to Home Assistant

### If you use ESPHome integration (recommended)

1. Open HA: `http://192.168.0.104:8123` (or VPN).
2. **Settings → Devices & services → Add integration → ESPHome**.
3. Enter host: `argus-cam-1.local` or the camera’s **LAN IP** (check your router DHCP list).
4. Paste the **API encryption key** from your YAML (same as in `api.encryption.key`).
5. Finish — you should get entity **`camera.argus_cam_1`** (name may vary slightly).

### Verify in HA

1. **Settings → Devices & services → ESPHome → ARGUS Cam 1**.
2. Open the **camera** entity → **Show camera** — you should see a live image.
3. **Developer tools → States** → search `camera.` — note exact `entity_id`.

If the stream is blank:

- Power supply too weak → use 5 V 2 A adapter.
- Wrong board pins → confirm **AI-Thinker** (not M5Stack or other pinout).
- Firewall on server blocking ESPHome API (usually LAN is fine).

---

## Part 5 — Show live feed in ARGUS

1. Connect **WireGuard** on your laptop.
2. Open **`https://argus.local:9443`** and log in (HA long‑lived token).
3. **Settings → Home cameras**:
   - **CAM 1:** `camera.argus_cam_1` (or your entity id)
   - **CAM 2:** leave empty or second camera later
4. **Save**.
5. **Home (Dashboard)** — top row should show **LIVE** snapshots (refreshes every ~2 s).
6. **Cameras** tab — full grid of all HA cameras.

ARGUS uses HA’s `camera_proxy` API — no extra CORS or ESP32 config.

---

## Part 6 — Test automations (Home Assistant)

ESPHome camera alone does **not** include motion detection. Start with a **manual test**, then add motion (PIR GPIO or Frigate later).

### A) Test notification when you press a button

**Settings → Automations → Create automation → Empty**

```yaml
alias: ARGUS — test camera online
description: Fires when ARGUS Cam 1 starts streaming
mode: single
trigger:
  - platform: state
    entity_id: camera.argus_cam_1
    to: "streaming"
action:
  - service: notify.persistent_notification
    data:
      title: ARGUS Cam 1
      message: Camera is streaming — check ARGUS Dashboard
```

Or trigger manually: **Developer tools → Services** → `camera.snapshot`:

```yaml
service: camera.snapshot
target:
  entity_id: camera.argus_cam_1
data:
  filename: "/config/www/snapshot_argus.jpg"
```

Then open `http://192.168.0.104:8123/local/snapshot_argus.jpg`.

### B) Motion later (optional PIR on ESP32)

Add to ESPHome YAML:

```yaml
binary_sensor:
  - platform: gpio
    pin: GPIO13
    name: ARGUS Cam 1 PIR
    device_class: motion
```

Wire a **3.3 V PIR module** to GPIO13, GND, 3.3 V.

HA automation:

```yaml
alias: ARGUS — motion on cam 1
trigger:
  - platform: state
    entity_id: binary_sensor.argus_cam_1_pir
    to: "on"
action:
  - service: camera.snapshot
    target:
      entity_id: camera.argus_cam_1
    data:
      filename: "/config/www/motion_{{ now().strftime('%Y%m%d_%H%M%S') }}.jpg"
  - service: notify.persistent_notification
    data:
      message: "Motion at ARGUS Cam 1 — snapshot saved"
```

ARGUS **Alerts bell** will also pick up motion/door events from HA logbook when they appear.

### C) View automations in ARGUS

**ARGUS → Automations** tab lists HA automations (read‑only overview). Create/edit automations in **Home Assistant → Settings → Automations**.

---

## Part 7 — Power for permanent install

- Do **not** run the camera long‑term from the FTDI 3.3 V pin only — use a **5 V 2 A** supply to the board’s 5 V input (where your board expects it).
- Keep antenna away from metal case.
- If stream drops: lower resolution in YAML (`640x480`) or `max_framerate: 5 fps`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| ESPHome won’t flash | GPIO0 → GND during boot; try another USB cable/port |
| Wi‑Fi won’t connect | 2.4 GHz only (no 5 GHz); check SSID/password in YAML |
| HA can’t find device | Use camera IP in ESPHome integration; ping from mato-server |
| HA camera works, ARGUS blank | Re‑login ARGUS; check Settings → CAM 1 entity; hard refresh |
| ARGUS “No camera assigned” | Settings → assign `camera.*` to CAM 1 / CAM 2 |
| Slow/stutter feed | Normal for ESP32; lower resolution/framerate in YAML |
| Ollama/voice unrelated | Camera uses HA only |

**Check from mato-server:**

```bash
ping argus-cam-1.local
# or ping <camera-lan-ip>
```

---

## Quick checklist

- [ ] ESP32-CAM flashed with ESPHome YAML (Wi‑Fi + `esp32_camera`)
- [ ] Camera visible in HA (`camera.*` entity, live view works)
- [ ] ARGUS logged in with HA token
- [ ] ARGUS **Settings → Home cameras** → CAM 1 assigned
- [ ] Dashboard shows **LIVE** feed
- [ ] (Optional) HA automation or snapshot test works

---

## Alternative: Arduino sketch (not recommended)

Raw Arduino + `esp32-camera` + RTSP/MJPEG requires **FFmpeg generic camera** or **MQTT** in HA — more work than ESPHome. Use ESPHome unless you have a specific reason not to.

---

## Your stack reference

| Service | URL |
|---------|-----|
| Home Assistant | `http://192.168.0.104:8123` |
| ARGUS | `https://argus.local:9443` |
| HA URL inside ARGUS | `https://argus.local:9443/api/ha` |

Entity after setup (typical): **`camera.argus_cam_1`**
