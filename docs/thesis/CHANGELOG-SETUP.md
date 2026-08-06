# Setup changelog (chronological)

## 2026-08-05 — Planning

- Locked **Option B:** Raspberry Pi OS + Docker (HA + ARGUS + landscape kiosk); Ollama on mato-server.
- Locked **thesis install path:** flash **microSD** with USB **card reader** on PC + **Ethernet** first boot.
- Documented Active Cooler + Touch Display 2 connections; fan is firmware PWM.

## 2026-08-06 — Case / cover logo (CAD)

- ARGUS emblem vectors for engraving into RPi wall-mount `pi_cover` (Printables STLs).
- Files under `Diplomová práca/3D model - RPI wall mount s logom/logo/`.

## 2026-08-07 — Hardware live + Pi OS

- Active Cooler installed.
- Touch Display 2 connected and **on**; touch working.
- Ethernet via adapter — working.
- Raspberry Pi OS on microSD; desktop visible.
- `sudo apt update` / `full-upgrade` done.
- **Next:** catch-up thesis photos → landscape → Docker → HA → ARGUS.

## Next actions

1. Catch-up screenshots/photos (see session guide below).
2. Rotate display to **landscape** (persist + verify touch).
3. Install Docker.
4. Start Home Assistant container → onboarding screenshots.
5. Clone ARGUS, configure `.env` for Pi LAN + Ollama on mato-server, `argus-update build`.
6. Open ARGUS on the Pi browser → Voice TEST → kiosk later.
