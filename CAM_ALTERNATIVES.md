# Camera options for ARGUS + Home Assistant

ARGUS shows whatever Home Assistant exposes as a `camera.*` entity. Assign it in **Settings → Home cameras**.

---

## Comparison

| Option | Reliability | Setup |
|--------|-------------|--------|
| **IP camera (Reolink / ONVIF / RTSP)** | Best | Plug in, add HA integration |
| **ESP32-CAM + Arduino** | OK with good power | [`deploy/arduino/README.md`](./deploy/arduino/README.md) |

---

## Recommended later: Reolink / IP camera

1. Camera on same LAN as `mato-server`
2. HA → **Add integration** → **ONVIF** or **Generic Camera** (RTSP)
3. ARGUS → Settings → assign `camera.*` to CAM 1

No USB, no GPIO0, no flashing.

---

## ESP32-CAM (current)

Use the Arduino sketch — see **[ESP32_CAM.md](./ESP32_CAM.md)** and **`deploy/arduino/`**.

**Hardware rules:** 5 V / 2 A power, ribbon cable seated, GPIO0 off after flash.
