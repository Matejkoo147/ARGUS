# Setup changelog (chronological)

## 2026-08-05 — Planning

- Locked **Option B:** Raspberry Pi OS + Docker (HA + ARGUS + landscape kiosk); Ollama on mato-server.
- Locked **thesis install path:** flash **microSD** with USB **card reader** on PC + **Ethernet** first boot.
- Documented Active Cooler + Touch Display 2 connections; fan is firmware PWM.

## 2026-08-06 — Case / cover logo (CAD)

- ARGUS emblem vectors for engraving into RPi wall-mount `pi_cover` (Printables STLs).
- Files under `Diplomová práca/3D model - RPI wall mount s logom/logo/`.

## 2026-08-07 — Hardware live + Pi OS

- Active Cooler installed; Touch Display 2 on; touch working; Ethernet working.
- Raspberry Pi OS on microSD; apt upgraded.
- Documented teardown of ARGUS/HA on mato-server → **Ollama only** (`08-mato-server-ollama-only.md`).
- HA Docker running on Pi (`homeassistant` Up :8123).
- Added Chromium **labwc kiosk** scripts so ARGUS is the boot/startup screen; HA remains backend-only.

## Next actions

1. Finish ARGUS deploy on Pi (`.env`, `argus-update build`).
2. Install kiosk: `./scripts/pi-install-kiosk.sh` → reboot → screenshot **P-ARGUS**.
3. Voice TEST + Ollama from mato-server.
