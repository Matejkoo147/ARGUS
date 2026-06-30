# ESP32-CAM → Home Assistant → ARGUS

ARGUS does **not** talk to the ESP32 directly. Flow:

```
ESP32-CAM  →  Wi‑Fi  →  Home Assistant (Generic Camera)  →  ARGUS
```

**Firmware:** Arduino sketch in [`deploy/arduino/argus-cam-1/argus-cam-1.ino`](./deploy/arduino/argus-cam-1/argus-cam-1.ino)  
**Full steps:** [`deploy/arduino/README.md`](./deploy/arduino/README.md)

---

## What you need

| Item | Notes |
|------|--------|
| **ESP32-CAM** (AI-Thinker) | OV2640 camera module |
| **USB‑to‑TTL** | CH340 / CP2102, 3.3 V logic |
| **5 V / 2 A power** | For runtime — FTDI 3.3 V alone is not enough |
| **Arduino IDE** | With esp32 board package |
| **Home Assistant** | On `mato-server` |
| **ARGUS** | `https://argus.local:9443` |

---

## Quick start

### 1. Arduino IDE (once)

- Boards Manager URL: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
- Install **esp32** boards
- Board: **AI Thinker ESP32-CAM**
- Upload speed: **115200**

### 2. Edit WiFi in the sketch

Open `deploy/arduino/argus-cam-1/argus-cam-1.ino`:

```cpp
const char* WIFI_SSID = "YourWiFi";
const char* WIFI_PASS = "your-password";
```

### 3. Flash

| USB-TTL | ESP32-CAM |
|---------|-----------|
| GND | GND |
| 3.3V | 3.3V |
| TX | U0R (GPIO3) |
| RX | U0T (GPIO1) |
| GPIO0 | GND (jumper — **only while uploading**) |

Press **RESET** → **Upload** → remove GPIO0 → **RESET** again.

### 4. Serial Monitor (115200)

Press **RESET**. Note the IP:

```
IP address: 192.168.0.xxx
```

Browser test: `http://192.168.0.xxx/`

### 5. Home Assistant

**Settings → Devices & services → Add integration → Generic Camera**

| Field | URL |
|-------|-----|
| Still image | `http://192.168.0.xxx/capture` |
| Stream | `http://192.168.0.xxx/stream` |

Use the camera’s **IP** (not `.local` — Docker HA often can’t resolve mDNS).

### 6. ARGUS

**Settings → Home cameras → CAM 1** → select the new `camera.*` entity → **Save**.

---

## Power (critical)

- **Upload:** USB-TTL 3.3 V is OK
- **Running:** **5 V / 2 A** on the board **5 V** pin + common GND
- Red blinking on OV module or `Camera init failed` in Serial → power or ribbon cable

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Upload fails | GPIO0→GND, RESET, slower upload (115200) |
| Serial empty | Press RESET with Serial Monitor open; check TX/RX |
| `I2C hardware timeout` | Board not **AI Thinker ESP32-CAM**, GPIO0 grounded, bad ribbon, or 5V on wrong pin |
| `PSRAM found: NO` | Wrong board selected in Arduino IDE |
| HA grey / no image | Wrong IP; use `:81/stream` for stream URL |
| ARGUS blank | Assign camera entity in Settings |

---

## Later: Reolink IP camera

For a stable thesis demo, a **Reolink / ONVIF** camera is easier:

1. HA → **ONVIF** integration
2. ARGUS → assign `camera.*` in Settings

No USB flashing required.

---

## Stack reference

| Service | URL |
|---------|-----|
| Home Assistant | `http://192.168.0.104:8123` |
| ARGUS | `https://argus.local:9443` |
| HA URL in ARGUS | `https://argus.local:9443/api/ha` |
