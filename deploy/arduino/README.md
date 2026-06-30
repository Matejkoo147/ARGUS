# ARGUS Cam 1 — Arduino IDE

Sketch: **`argus-cam-1/argus-cam-1.ino`**

Full guide: **[ESP32_CAM.md](../../ESP32_CAM.md)** (repo root)

## What you need

- Arduino IDE 2.x
- USB-TTL (CH340 / CP2102), 3.3 V
- **5 V / 2 A** power for normal use (phone charger + wire to 5V pin)
- AI-Thinker ESP32-CAM

## 1. Arduino IDE setup (once)

1. **File → Preferences → Additional boards manager URLs:**
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
2. **Tools → Board → Boards Manager** → install **esp32** (Espressif Systems)
3. Set **Tools** exactly like this:

| Setting | Value |
|---------|--------|
| **Board** | **AI Thinker ESP32-CAM** |
| **Port** | Your COM port (e.g. COM7) |
| **Upload speed** | **115200** (use 921600 only if upload is stable) |
| **CPU Frequency** | 240 MHz (WiFi/BT) |
| **Core Debug Level** | None |
| **Flash Frequency** | **80 MHz** |
| **Flash Mode** | **QIO** |
| **Flash Size** | **4 MB (32 Mb)** |
| **Partition Scheme** | **Huge APP (3MB No OTA/1MB SPIFFS)** |
| **PSRAM** | **Enabled** (if shown — required for camera) |
| **Arduino Runs On** | Core 1 |
| **Events Run On** | Core 1 |
| **Erase All Flash Before Sketch Upload** | Disabled (enable once if upload acts weird) |
| **Programmer** | Esptool |

Your screenshot (**80 MHz**, **QIO**, **Huge APP**) is **correct**.

**Wrong board** (e.g. “ESP32 Dev Module”) → I2C timeout, no PSRAM, camera fails.

## 2. Open the sketch

Open this folder in Arduino IDE:

```
deploy/arduino/argus-cam-1/argus-cam-1.ino
```

Edit at the top:

```cpp
const char* WIFI_SSID = "Mato Extender";
const char* WIFI_PASS = "your-password";
```

## 3. Wire for upload

| USB-TTL | ESP32-CAM |
|---------|-----------|
| GND | GND |
| 3.3V | 3.3V |
| TX | U0R (GPIO3) |
| RX | U0T (GPIO1) |
| GPIO0 | GND (jumper, flash only) |

Press **RESET**, click **Upload** in Arduino IDE. When upload starts, remove GPIO0 jumper.

## 4. After upload

1. **Serial Monitor** → 115200 baud → press **RESET**
2. You should see:
   ```
   WiFi connected
   IP address: 192.168.0.xxx
   ```
3. Browser on same WiFi: `http://192.168.0.xxx/` → live stream

If you see `Camera init failed` → **5 V 2 A** on 5V pin + reseat ribbon cable.

## 5. Home Assistant

**Settings → Devices & services → Add integration → Generic Camera**

| Field | URL |
|-------|-----|
| Name | ARGUS Cam 1 |
| Still image URL | `http://192.168.0.xxx/capture` |
| Stream source URL | `http://192.168.0.xxx/stream` |

(Use your real IP from Serial Monitor.)

## 6. ARGUS

**Settings → Home cameras → CAM 1** → pick `camera.argus_cam_1` (or the generic camera entity) → Save.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Upload fails | GPIO0→GND, RESET, slower upload speed |
| Serial empty | Press RESET with Serial Monitor open; check TX/RX |
| Red LED / init failed | 5V 2A power, ribbon cable |
| HA no picture | Use `/stream` on port 80 (same IP, no :81) |
